
'use client';

import React, { useMemo, use, useState, useEffect } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, User as AppUser, OrderPayment, ShiftTransaction, Expense } from '@/lib/definitions';
import {
  ArrowRight,
  Clock,
  User,
  Calendar,
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Repeat,
  Eye,
  BadgePercent,
  Receipt,
  Hash,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RotateCcw,
  Loader2,
  Edit3,
  Lock,
  PlusCircle,
  Package
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useDatabase } from '@/firebase';
import { ref, update, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { OrderItemsPreviewDialog } from '@/components/order-items-preview-dialog';

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString()} ج.م`;

const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-EG-u-nu-latn', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

function ShiftDetailsPageContent({ id }: { id: string }) {
  const { data: shifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts');
  const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: allExpenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['shifts:reopen', 'expenses:add'] as const);
  const db = useDatabase();
  const { toast } = useToast();
  
  const [isReopening, setIsReopening] = useState(false);
  const [newClosingBalance, setNewClosingBalance] = useState<string>('');
  
  const isLoading = isLoadingShifts || isLoadingOrders || isLoadingExpenses || isLoadingPermissions;

  const shift = useMemo(() => {
    if (isLoading || !shifts) return undefined;
    return shifts.find((s) => s.id === id);
  }, [shifts, id, isLoading]);

  const reopenStatus = useMemo(() => {
    if (!shift || !shifts) return { canResume: false, isLatest: false, hasOtherOpen: false };
    
    const cashierShifts = shifts
        .filter(s => s.cashier.id === shift.cashier.id)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    const latestShift = cashierShifts[0];
    const isLatest = latestShift?.id === shift.id;
    const hasOtherOpen = cashierShifts.some(s => !s.endTime && s.id !== shift.id);
    
    return {
        canResume: isLatest && !hasOtherOpen,
        isLatest,
        hasOtherOpen
    };
  }, [shift, shifts]);

  useEffect(() => {
    if (shift?.closingBalance !== undefined) {
        setNewClosingBalance(shift.closingBalance.toString());
    }
  }, [shift]);

  const handleUpdateClosingBalance = async () => {
    if (!shift || !db) return;
    const amount = parseFloat(newClosingBalance);
    if (isNaN(amount)) {
        toast({ variant: "destructive", title: "مبلغ غير صالح" });
        return;
    }

    setIsReopening(true);
    try {
        await update(ref(db, `shifts/${shift.id}`), {
            closingBalance: amount,
            updatedAt: new Date().toISOString()
        });
        toast({ title: "تم تعديل مبلغ الإغلاق بنجاح" });
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
    } finally {
        setIsReopening(false);
    }
  };

  const handleResumeShift = async () => {
    if (!shift || !db || !reopenStatus.canResume) return;
    setIsReopening(true);
    try {
        const shiftRef = ref(db, `shifts/${shift.id}`);
        await update(shiftRef, {
            endTime: null,
            closingBalance: null,
            reopenedAt: new Date().toISOString()
        });
        toast({ title: "تم فك إقفال الوردية بنجاح", description: "الوردية الآن مفتوحة لاستكمال العمل." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
    } finally {
        setIsReopening(false);
    }
  };

  const shiftTransactions = useMemo((): ShiftTransaction[] => {
    if (!shift || !orders) return [];

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

    const eventsInShift: Omit<ShiftTransaction, 'id' | 'transactionCode'>[] = [];

    // Process all orders
    orders.forEach(order => {
        if (order.status === 'Cancelled') return;

        const creationDate = new Date(order.createdAt || order.orderDate);
        
        // Strict ID Link
        const orderIsLinked = order.shiftId === shift.id;
        
        // Legacy Fallback
        const isLegacyMatch = !order.shiftId && 
                             order.processedByUserId === shift.cashier.id && 
                             creationDate >= shiftStartTime && 
                             creationDate <= shiftEndTime;
        
        if (orderIsLinked || isLegacyMatch) {
            const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
            eventsInShift.push({
                date: creationDate.toISOString(),
                category: 'order',
                description: `فاتورة ${order.transactionType === 'Sale' ? 'بيع' : 'إيجار'} (${order.customerName})`,
                by: order.sellerName,
                orderId: order.id,
                orderCode: order.orderCode,
                orderSubtotal: subtotal,
                discountMovement: 0,
                paymentMovement: 0,
                method: 'آجل',
                type: order.transactionType,
                items: order.items,
            } as any);
        }

        // 2. Discount Entry
        if (order.discountAmount && order.discountAmount > 0) {
            const dDateStr = order.discountAppliedDate || order.createdAt || order.orderDate;
            const dDate = new Date(dDateStr);
            const discountIsLinked = order.shiftId === shift.id;
            
            if (discountIsLinked || (!order.shiftId && order.processedByUserId === shift.cashier.id && dDate >= shiftStartTime && dDate <= shiftEndTime)) {
                eventsInShift.push({
                    date: dDate.toISOString(),
                    category: 'discount',
                    description: `خصم على الطلب ${order.orderCode}`,
                    by: order.processedByUserName || 'نظام',
                    orderId: order.id,
                    orderCode: order.orderCode,
                    discountMovement: order.discountAmount,
                    paymentMovement: 0,
                    method: '-',
                    items: order.items,
                });
            }
        }
        
        // 3. Payment Entries
        if (order.payments) {
            Object.values(order.payments).forEach(p => {
                const pDate = new Date(p.date);
                const paymentIsLinked = p.shiftId === shift.id;

                if (paymentIsLinked || (!p.shiftId && p.userId === shift.cashier.id && pDate >= shiftStartTime && pDate <= shiftEndTime)) {
                    eventsInShift.push({
                        date: p.date,
                        category: 'payment',
                        description: `دفعة مستلمة - ${order.customerName} (طلب ${order.orderCode})`,
                        by: p.userName,
                        orderId: order.id,
                        orderCode: order.orderCode,
                        paymentMovement: p.amount,
                        method: p.method,
                        items: order.items,
                    });
                }
            });
        } else if (order.paid > 0 && (orderIsLinked || isLegacyMatch)) {
            eventsInShift.push({
                date: (order.createdAt || order.orderDate) as string,
                category: 'payment',
                description: `دفعة مقدمة - ${order.customerName}`,
                by: order.processedByUserName,
                orderId: order.id,
                orderCode: order.orderCode,
                paymentMovement: order.paid,
                method: 'Cash',
                items: order.items,
            });
        }
    });

    // 4. Expenses
    allExpenses.forEach(expense => {
        const eDate = new Date(expense.date);
        const expenseIsLinked = expense.shiftId === shift.id;

        if (expenseIsLinked || (!expense.shiftId && expense.userId === shift.cashier.id && eDate >= shiftStartTime && eDate <= shiftEndTime)) {
            eventsInShift.push({
                date: expense.date,
                category: 'expense',
                description: `مصروف: ${expense.description}`,
                by: expense.userName,
                paymentMovement: 0,
                expenseMovement: expense.amount,
                method: 'Cash',
            });
        }
    });

    eventsInShift.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return eventsInShift.map((tx, index) => ({ 
        ...tx, 
        id: `${tx.orderId || 'exp'}-${tx.date}-${tx.category}-${index}`, 
        transactionCode: `TX-${eventsInShift.length - index}`
    }));
  }, [shift, orders, allExpenses]);

  const totals = useMemo(() => {
      let salesGross = 0;
      let rentalsGross = 0;
      let received = 0;
      let discounts = 0;
      let expenses = 0;

      shiftTransactions.forEach(tx => {
          if (tx.category === 'order') {
              if ((tx as any).type === 'Sale') salesGross += (tx.orderSubtotal || 0);
              else rentalsGross += (tx.orderSubtotal || 0);
          } else if (tx.category === 'payment') {
              received += (tx.paymentMovement || 0);
          } else if (tx.category === 'discount') {
              discounts += (tx.discountMovement || 0);
          } else if (tx.category === 'expense') {
              expenses += (tx.expenseMovement || 0);
          }
      });

      return { 
          grossRevenue: salesGross + rentalsGross,
          netRevenue: received - expenses, // Primary metric for drawer
          salesGross,
          rentalsGross,
          received, 
          discounts, 
          expenses 
      };
  }, [shiftTransactions]);

  if (isLoading) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="جاري التحميل..." showBackButton><Skeleton className="h-8 w-48" /></PageHeader>
            <div className="grid md:grid-cols-2 gap-8">
                <Card><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>
            </div>
        </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="الوردية غير موجودة" showBackButton />
        <Card><CardContent className="p-8 text-center text-muted-foreground">لم يتم العثور على البيانات.</CardContent></Card>
      </div>
    );
  }

  const cashInDrawer = (shift.openingBalance || 0) + totals.received - totals.expenses;
  const difference = (shift.closingBalance || 0) - cashInDrawer;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`الوردية رقم ${shift.shiftCode || shift.id.slice(-6).toUpperCase()} - ${shift.cashier?.name}`} showBackButton>
          {shift.endTime && permissions.canShiftsReopen && (
              <div className="flex flex-wrap gap-2">
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="outline" className="gap-2">
                              <Edit3 className="h-4 w-4" />
                              تعديل مبلغ الإغلاق
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl" className="text-right">
                          <AlertDialogHeader>
                              <AlertDialogTitle>تعديل مبلغ الإغلاق</AlertDialogTitle>
                              <AlertDialogDescription>تصحيح المبلغ الفعلي للدرج المسجل عند الإقفال.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4 space-y-4">
                              <div className="p-3 bg-muted rounded-md text-xs">
                                  <p>المتوقع بالدرج: <strong>{formatCurrency(cashInDrawer)}</strong></p>
                                  <p>المسجل حالياً: <strong>{formatCurrency(shift.closingBalance || 0)}</strong></p>
                              </div>
                              <div className="space-y-2">
                                  <Label>المبلغ الفعلي الصحيح</Label>
                                  <Input type="number" value={newClosingBalance} onChange={(e) => setNewClosingBalance(e.target.value)} />
                              </div>
                          </div>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleUpdateClosingBalance(); }} disabled={isReopening}>
                                  {isReopening ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="ml-2 h-4 w-4"/>}
                                  حفظ التعديل
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>

                  {reopenStatus.canResume && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="gap-2 text-amber-600 border-amber-200">
                                <RotateCcw className="h-4 w-4" />
                                إعادة فتح للاستكمال
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl" className="text-right">
                            <AlertDialogHeader>
                                <AlertDialogTitle>إعادة فتح الوردية</AlertDialogTitle>
                                <AlertDialogDescription>سيتم مسح بيانات الإقفال وتصبح الوردية نشطة مرة أخرى.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.preventDefault(); handleResumeShift(); }} disabled={isReopening} className="bg-amber-600">
                                    تأكيد الفتح
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  )}
              </div>
          )}
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
             <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary"/>
                الملخص المالي (الدرج)
            </CardTitle>
            {permissions.canExpensesAdd && (
                <AddExpenseDialog targetShift={shift} trigger={
                    <Button variant="destructive" size="sm" className="gap-1.5 shadow-sm">
                        <PlusCircle className="h-4 w-4" />
                        إضافة مصروف لهذه الوردية
                    </Button>
                } />
            )}
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3 text-blue-500"/> إجمالي المحصل (كاش)</p>
                        <p className="font-bold text-lg text-blue-600">{formatCurrency(totals.received)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive"/> إجمالي المصروفات</p>
                        <p className="font-bold text-lg text-destructive">{formatCurrency(totals.expenses)}</p>
                    </div>
                     <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><BadgePercent className="h-3 w-3 text-amber-600"/> الخصومات المطبقة</p>
                        <p className="font-bold text-lg text-amber-600">{formatCurrency(totals.discounts)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-green-50 border border-green-100">
                        <p className="text-xs text-green-700 font-semibold">صافي النقدية بالدرج</p>
                        <p className="font-bold text-lg text-green-700">{formatCurrency(cashInDrawer)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">قيمة فواتير المبيعات</p>
                        <p className="font-semibold text-foreground">{formatCurrency(totals.salesGross)}</p>
                    </div>
                    <div className="text-center border-r">
                        <p className="text-xs text-muted-foreground">قيمة فواتير الإيجارات</p>
                        <p className="font-semibold text-foreground">{formatCurrency(totals.rentalsGross)}</p>
                    </div>
                </div>
            </div>
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
                        <p className="text-xs text-primary font-semibold">الرصيد الافتتاحي</p>
                        <p className="font-mono font-bold text-lg">{formatCurrency(shift.openingBalance || 0)}</p>
                    </div>
                     <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
                        <p className="text-xs text-muted-foreground">المتوقع فعلياً بالدرج</p>
                        <p className="font-mono font-bold text-lg text-primary">{formatCurrency(cashInDrawer)}</p>
                    </div>
                    {shift.endTime && (
                         <>
                            <div className="p-3 rounded-md bg-muted/50">
                                <p className="text-xs text-muted-foreground">الرصيد المُدخل عند الإغلاق</p>
                                <p className="font-mono font-bold text-lg">{formatCurrency(shift.closingBalance || 0)}</p>
                            </div>
                             <div className={cn('p-3 rounded-md space-y-1 flex flex-col items-center justify-center', difference !== 0 ? (difference < 0 ? 'bg-orange-500/10 text-orange-600' : 'bg-green-500/10 text-green-600') : 'bg-muted/50')}>
                                <p className="text-xs">{difference < 0 ? 'العجز' : difference > 0 ? 'الزيادة' : 'الفرق'}</p>
                                <p className="font-mono font-bold text-lg">{formatCurrency(difference)}</p>
                            </div>
                         </>
                     )}
                </div>
                <div className="grid gap-2 text-sm p-4 border rounded-lg bg-background">
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">الموظف</span>
                        <span className="font-medium">{shift.cashier?.name}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">وقت الفتح</span>
                        <span className="text-xs font-mono">{formatDate(shift.startTime)}</span>
                    </div>
                     {shift.endTime && (
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">وقت الإغلاق</span>
                            <span className="text-xs font-mono">{formatDate(shift.endTime)}</span>
                        </div>
                     )}
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary"/>
                سجل حركات الوردية ({shiftTransactions.length})
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right w-[120px]">الوقت</TableHead>
                        <TableHead className="text-right">البيان</TableHead>
                        <TableHead className="text-center">كود الطلب</TableHead>
                        <TableHead className="text-center">أصناف الطلب</TableHead>
                        <TableHead className="text-center">قيمة الفاتورة</TableHead>
                        <TableHead className="text-center">الخصم/المصروف</TableHead>
                        <TableHead className="text-center">المحصل (كاش)</TableHead>
                        <TableHead className="text-center">الطريقة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {shiftTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                            <TableCell className="text-right text-[10px] font-mono">
                                {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                                <div className="flex items-center gap-2">
                                    {tx.category === 'expense' && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                                    {tx.category === 'payment' && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
                                    {tx.category === 'order' && <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />}
                                    {tx.category === 'discount' && <BadgePercent className="h-3.5 w-3.5 text-amber-600" />}
                                    <span>{tx.description}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                {tx.orderId ? (
                                    <OrderDetailsDialog orderId={tx.orderId}>
                                        <Button variant="link" className="font-mono p-0 h-auto text-xs">{tx.orderCode}</Button>
                                    </OrderDetailsDialog>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                                {tx.items ? <OrderItemsPreviewDialog items={tx.items} /> : '-'}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{tx.orderSubtotal ? formatCurrency(tx.orderSubtotal) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-destructive">
                                {(tx.category === 'discount' && tx.discountMovement) ? formatCurrency(tx.discountMovement) : (tx.category === 'expense' && tx.expenseMovement) ? formatCurrency(tx.expenseMovement) : '-'}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-green-600 font-bold">{(tx.category === 'payment' && tx.paymentMovement) ? formatCurrency(tx.paymentMovement) : '-'}</TableCell>
                            <TableCell className="text-center">
                                {tx.method ? <Badge variant="outline" className="text-[10px]">{tx.method}</Badge> : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                    {shiftTransactions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">لا توجد حركات مسجلة.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ShiftDetailsPage({ params }: PageProps) {
    const { id } = use(params);
    return (
        <AppLayout>
            <AuthGuard>
                <ShiftDetailsPageContent id={id} />
            </AuthGuard>
        </AppLayout>
    )
}
