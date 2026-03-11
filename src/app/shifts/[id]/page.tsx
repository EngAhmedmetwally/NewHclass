
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
  PlusCircle
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
import { ref, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { AddExpenseDialog } from '@/components/add-expense-dialog';

const formatCurrency = (amount: number) => `${amount.toLocaleString()} ج.م`;

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

  // Logic to determine if full Resume is allowed
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

    // 1. Orders and related movements
    orders.forEach(order => {
        const creationDate = new Date(order.createdAt || order.orderDate);
        const orderExplicitlyInShift = order.shiftId === shift.id;
        const orderTimeInRange = creationDate >= shiftStartTime && creationDate <= shiftEndTime;
        const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
        
        if (orderExplicitlyInShift || orderTimeInRange) {
            eventsInShift.push({
                date: creationDate.toISOString(),
                category: 'order',
                description: `طلب ${order.transactionType === 'Sale' ? 'بيع' : 'إيجار'} (${order.customerName})`,
                by: order.sellerName,
                orderId: order.id,
                orderCode: order.orderCode,
                orderSubtotal: subtotal,
                discountMovement: 0,
                paymentMovement: 0,
                newRemaining: subtotal,
                method: 'آجل',
            });
        }

        if (order.discountAmount && order.discountAmount > 0) {
            const dDate = order.discountAppliedDate ? new Date(order.discountAppliedDate) : creationDate;
            const discountInShift = (order.shiftId === shift.id) || (dDate >= shiftStartTime && dDate <= shiftEndTime);
            
            if (discountInShift) {
                eventsInShift.push({
                    date: dDate.toISOString(),
                    category: 'discount',
                    description: `خصم على الطلب ${order.orderCode}`,
                    by: order.processedByUserName || 'سيستم',
                    orderId: order.id,
                    orderCode: order.orderCode,
                    orderSubtotal: undefined,
                    discountMovement: order.discountAmount,
                    paymentMovement: 0,
                    method: '-',
                });
            }
        }
        
        if(order.payments) {
            Object.values(order.payments).forEach(p => {
                const pDate = new Date(p.date);
                const paymentInShift = (p.shiftId === shift.id) || (pDate >= shiftStartTime && pDate <= shiftEndTime);
                
                if (paymentInShift) {
                    eventsInShift.push({
                        date: pDate.toISOString(),
                        category: 'payment',
                        description: `دفعة من ${order.customerName} للطلب ${order.orderCode}`,
                        by: p.userName,
                        orderId: order.id,
                        orderCode: order.orderCode,
                        orderSubtotal: undefined,
                        discountMovement: 0,
                        paymentMovement: p.amount,
                        method: p.method,
                    });
                }
            });
        } else if (order.paid > 0 && !order.payments) {
             if (orderExplicitlyInShift || orderTimeInRange) {
                eventsInShift.push({
                    date: creationDate.toISOString(),
                    category: 'payment',
                    description: `دفعة (افتتاحية) من ${order.customerName}`,
                    by: order.processedByUserName,
                    orderId: order.id,
                    orderCode: order.orderCode,
                    orderSubtotal: undefined,
                    discountMovement: 0,
                    paymentMovement: order.paid,
                    method: 'Cash',
                });
             }
        }
    });

    // 2. Expenses
    allExpenses.filter(e => e.shiftId === shift.id).forEach(expense => {
        eventsInShift.push({
            date: expense.date,
            category: 'expense',
            description: `مصروف: ${expense.description} (${expense.category})`,
            by: expense.userName,
            orderId: undefined,
            orderCode: undefined,
            orderSubtotal: undefined,
            discountMovement: 0,
            paymentMovement: 0,
            expenseMovement: expense.amount,
            method: 'Cash',
        });
    });

    eventsInShift.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return eventsInShift.map((tx, index) => ({ 
        ...tx, 
        id: `${tx.orderId || 'exp'}-${tx.date}-${tx.category}-${Math.random()}`, 
        transactionCode: `TX-${eventsInShift.length - index}`
    }));
  }, [shift, orders, allExpenses]);


  if (isLoading) {
      return (
        <div className="flex flex-col gap-8">
            <PageHeader title="جاري تحميل تفاصيل الوردية..." showBackButton>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-24" />
                </div>
            </PageHeader>
            <Card><CardHeader><Skeleton className="h-64 w-full" /></CardHeader></Card>
            <Card><CardHeader><Skeleton className="h-48 w-full" /></CardHeader></Card>
        </div>
      )
  }

  if (!shift) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">الوردية غير موجودة</h3>
          <p className="text-sm text-muted-foreground">
            لم نتمكن من العثور على الوردية التي تبحث عنها.
          </p>
          <Link href="/shifts">
            <Button className="mt-4 gap-1">
              <ArrowRight className="h-4 w-4" />
              العودة إلى الورديات
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalRevenue = (shift.salesTotal || 0) + (shift.rentalsTotal || 0);
  const totalReceived = (shift.cash || 0) + (shift.vodafoneCash || 0) + (shift.instaPay || 0);
  // Expected physical cash in drawer = Opening + Cash received during shift - Physical expenses/refunds
  const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0);
  const difference = (shift.closingBalance || 0) - cashInDrawer;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`وردية رقم ${shift.shiftCode || shift.id.slice(-6).toUpperCase()} - ${shift.cashier?.name}`} showBackButton>
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
                              <AlertDialogTitle>تعديل مبلغ الدرج المسجل</AlertDialogTitle>
                              <AlertDialogDescription>
                                  استخدم هذا الخيار لتصحيح المبلغ الذي أدخله الموظف عند الإغلاق دون إعادة فتح الوردية للعمل.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4 space-y-4">
                              <div className="p-3 bg-muted rounded-md text-xs">
                                  <p>النقدية المتوقعة بالدرج: <strong>{formatCurrency(cashInDrawer)}</strong></p>
                                  <p>المبلغ المسجل حالياً: <strong>{formatCurrency(shift.closingBalance || 0)}</strong></p>
                              </div>
                              <div className="space-y-2">
                                  <Label>المبلغ الصحيح بالدرج</Label>
                                  <Input 
                                    type="number" 
                                    value={newClosingBalance} 
                                    onChange={(e) => setNewClosingBalance(e.target.value)} 
                                    placeholder="أدخل المبلغ الفعلي..."
                                  />
                              </div>
                          </div>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => { e.preventDefault(); handleUpdateClosingBalance(); }}
                                disabled={isReopening}
                              >
                                  {isReopening ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="ml-2 h-4 w-4"/>}
                                  حفظ التعديل
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                            disabled={!reopenStatus.canResume}
                          >
                              {reopenStatus.canResume ? <RotateCcw className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              إعادة فتح للاستكمال
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl" className="text-right">
                          <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد فك إقفال الوردية</AlertDialogTitle>
                              <AlertDialogDescription>
                                  {!reopenStatus.isLatest ? (
                                      <span className="text-destructive font-bold">لا يمكن إعادة فتح وردية قديمة للاستكمال. يمكنك فقط تعديل مبلغ الإغلاق الخاص بها.</span>
                                  ) : reopenStatus.hasOtherOpen ? (
                                      <span className="text-destructive font-bold">لا يمكن إعادة فتح هذه الوردية لوجود وردية أخرى مفتوحة لهذا الموظف حالياً.</span>
                                  ) : (
                                      <>
                                          هل أنت متأكد من رغبتك في إعادة فتح هذه الوردية؟ 
                                          <br /><br />
                                          - سيتم مسح بيانات الإغلاق وستعود الوردية للحالة "المفتوحة".
                                          <br />
                                          - سيتمكن الموظف من إضافة حركات جديدة عليها.
                                      </>
                                  )}
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              {reopenStatus.canResume && (
                                <AlertDialogAction 
                                    onClick={(e) => { e.preventDefault(); handleResumeShift(); }}
                                    disabled={isReopening}
                                    className="bg-amber-600 hover:bg-amber-700"
                                >
                                    {isReopening ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <RotateCcw className="ml-2 h-4 w-4"/>}
                                    تأكيد الفتح والاستكمال
                                </AlertDialogAction>
                              )}
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          )}
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
             <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary"/>
                الملخص المالي للوردية
            </CardTitle>
            {permissions.canExpensesAdd && (
                <AddExpenseDialog targetShift={shift} trigger={
                    <Button variant="default" size="sm" className="gap-1.5 bg-destructive hover:bg-destructive/90 text-white shadow-md">
                        <PlusCircle className="h-4 w-4" />
                        إضافة مصروف لهذه الوردية
                    </Button>
                } />
            )}
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500"/> إجمالي الإيرادات (صافي)</p>
                        <p className="font-bold text-lg">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3 text-blue-500"/> إجمالي المحصل (كاش+إلكتروني)</p>
                        <p className="font-bold text-lg">{formatCurrency(totalReceived)}</p>
                    </div>
                     <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><BadgePercent className="h-3 w-3 text-amber-600"/> الخصومات المطبقة</p>
                        <p className="font-bold text-lg text-amber-600">{formatCurrency(shift.discounts || 0)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive"/> إجمالي المصروفات</p>
                        <p className="font-bold text-lg text-destructive">{formatCurrency(shift.refunds || 0)}</p>
                    </div>
                </div>
                 <div className="p-4 rounded-lg border">
                    <p className="text-sm font-semibold mb-2">تفاصيل المقبوضات حسب الوسيلة</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <p>كاش: <span className="font-mono font-medium">{formatCurrency(shift.cash || 0)}</span></p>
                        <p>فودافون: <span className="font-mono font-medium">{formatCurrency(shift.vodafoneCash || 0)}</span></p>
                        <p>إنستا باي: <span className="font-mono font-medium">{formatCurrency(shift.instaPay || 0)}</span></p>
                    </div>
                </div>
            </div>
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                     <div className="p-3 rounded-md bg-primary/10 border border-primary/20 space-y-1">
                        <p className="text-xs text-primary font-semibold">الرصيد الافتتاحي</p>
                        <p className="font-mono font-bold text-lg">{formatCurrency(shift.openingBalance || 0)}</p>
                    </div>
                     <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground">صافي المتوقع بالدرج</p>
                        <p className="font-mono font-bold text-lg text-primary">{formatCurrency(cashInDrawer)}</p>
                    </div>
                    {shift.endTime && (
                         <>
                            <div className="p-3 rounded-md bg-muted/50 space-y-1">
                                <p className="text-xs text-muted-foreground">الرصيد الفعلي (المُدخل)</p>
                                <p className="font-mono font-bold text-primary text-lg">{formatCurrency(shift.closingBalance || 0)}</p>
                            </div>
                             <div className={cn('p-3 rounded-md space-y-1 flex flex-col items-center justify-center', difference !== 0 ? (difference < 0 ? 'bg-orange-500/10 text-orange-400 dark:text-orange-300' : 'bg-green-500/10 text-green-600') : 'bg-muted/50')}>
                                <p className="text-xs">{difference !== 0 ? (difference < 0 ? 'العجز' : 'الزيادة') : 'الفرق'}</p>
                                <p className="font-mono font-bold text-lg">{formatCurrency(difference)}</p>
                                {difference === 0 && <CheckCircle2 className="h-5 w-5 text-green-600"/>}
                                {difference !== 0 && <AlertTriangle className="h-5 w-5"/>}
                            </div>
                         </>
                     )}
                </div>
                <div className="grid gap-4 text-sm p-4 border rounded-lg bg-background">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">الحالة</span>
                        {shift.endTime ? <Badge variant="secondary">مغلقة</Badge> : <Badge className="bg-green-500 text-white">مفتوحة</Badge>}
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4"/> الموظف</span>
                        <span className="font-medium">{shift.cashier?.name}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> وقت الفتح</span>
                        <span className="text-left text-xs font-mono">{formatDate(shift.startTime)}</span>
                    </div>
                     {shift.endTime && (
                         <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> وقت الإغلاق</span>
                            <span className="text-left text-xs font-mono">{formatDate(shift.endTime)}</span>
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
                الحركات المالية في الوردية ({shiftTransactions.length})
            </CardTitle>
            <CardDescription>قائمة بجميع الحركات المالية (طلبات، دفعات، خصومات، مصروفات) خلال هذه الوردية.</CardDescription>
        </CardHeader>
        <CardContent>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right w-[150px]">الوقت</TableHead>
                        <TableHead className="text-center">رقم المستند</TableHead>
                        <TableHead className="text-right">البيان</TableHead>
                        <TableHead className="text-center">كود الطلب</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">الخصم/المصروف</TableHead>
                        <TableHead className="text-center">المدفوع</TableHead>
                        <TableHead className="text-center">طريقة الدفع</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {shiftTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                            <TableCell className="text-right text-[10px] font-mono whitespace-nowrap">
                                {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">{tx.transactionCode}</TableCell>
                            <TableCell className="text-right text-sm">
                                <div className="flex items-center gap-2">
                                    {tx.category === 'expense' && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                                    {tx.category === 'payment' && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
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
                            <TableCell className="text-center font-mono text-xs">{tx.orderSubtotal ? formatCurrency(tx.orderSubtotal) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-destructive">
                                {tx.discountMovement ? formatCurrency(tx.discountMovement) : tx.expenseMovement ? formatCurrency(tx.expenseMovement) : '-'}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-green-600 font-bold">{tx.paymentMovement ? formatCurrency(tx.paymentMovement) : '-'}</TableCell>
                            <TableCell className="text-center">
                                {tx.method ? <Badge variant="outline" className="text-[10px]">{tx.method}</Badge> : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                    {shiftTransactions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                لم يتم تسجيل أي حركات مالية في هذه الوردية بعد.
                            </TableCell>
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
