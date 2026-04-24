
'use client';

import React, { useMemo, use, useState, useEffect } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, User as AppUser, OrderPayment, ShiftTransaction, Expense, SaleReturn } from '@/lib/definitions';
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
  Package,
  Undo,
  Landmark,
  ArrowUpRight,
  Phone,
  Smartphone,
  Banknote,
  CreditCard
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
import { PostShiftDialog } from '@/components/post-shift-dialog';

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
  const { data: saleReturns, isLoading: isLoadingReturns } = useRtdbList<SaleReturn>('saleReturns');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['shifts:reopen', 'expenses:add', 'shifts:post'] as const);
  const db = useDatabase();
  const { toast } = useToast();
  
  const [isReopening, setIsReopening] = useState(false);
  const [newClosingBalance, setNewClosingBalance] = useState<string>('');
  
  const isLoading = isLoadingShifts || isLoadingOrders || isLoadingExpenses || isLoadingPermissions || isLoadingReturns;

  const shift = useMemo(() => {
    if (isLoading || !shifts) return undefined;
    return shifts.find((s) => s.id === id);
  }, [shifts, id, isLoading]);

  const reopenStatus = useMemo(() => {
    if (!shift || !shifts || shift.isPosted) return { canResume: false, isLatest: false, hasOtherOpen: false };
    
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
    if (!shift || !db || shift.isPosted) return;
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
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(Date.now() + 86400000 * 365);

    const eventsInShift: Omit<ShiftTransaction, 'id' | 'transactionCode'>[] = [];

    orders.forEach(order => {
        const creationDate = new Date(order.createdAt || order.orderDate);
        const orderIsLinked = order.shiftId === shift.id;
        const isLegacyMatch = !order.shiftId && 
                             order.processedByUserId === shift.cashier.id && 
                             creationDate >= shiftStartTime && 
                             creationDate <= shiftEndTime;
        
        if (orderIsLinked || isLegacyMatch) {
            const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
            eventsInShift.push({
                date: creationDate.toISOString(),
                category: 'order',
                description: `فاتورة ${order.transactionType === 'Sale' ? 'بيع' : 'إيجار'} (${order.customerName})${order.status === 'Cancelled' ? ' [ملغاة]' : ''}`,
                by: order.sellerName,
                orderId: order.id,
                orderCode: order.orderCode,
                orderSubtotal: subtotal,
                discountMovement: 0,
                paymentMovement: 0,
                expenseMovement: 0,
                method: 'آجل',
                type: order.transactionType,
                items: order.items,
                orderTotal: order.total,
                orderPaid: order.paid,
                newRemaining: order.remainingAmount,
                isCancelled: order.status === 'Cancelled'
            } as any);
        }

        if (order.status !== 'Cancelled' || order.paid > 0) {
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
                      orderSubtotal: 0,
                      discountMovement: order.discountAmount,
                      paymentMovement: 0,
                      expenseMovement: 0,
                      method: '-',
                      items: order.items,
                      orderTotal: order.total,
                      orderPaid: order.paid,
                      newRemaining: order.remainingAmount,
                  });
              }
          }
          
          const hasDetailedPayments = order.payments && Object.keys(order.payments).length > 0;
          if (hasDetailedPayments) {
              Object.values(order.payments!).forEach(p => {
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
                          orderSubtotal: 0,
                          discountMovement: 0,
                          paymentMovement: p.amount,
                          expenseMovement: 0,
                          method: p.method,
                          items: order.items,
                          orderTotal: order.total,
                          orderPaid: order.paid,
                          newRemaining: order.remainingAmount,
                      });
                  }
              });
          } else if (order.paid > 0 && (orderIsLinked || isLegacyMatch)) {
              eventsInShift.push({
                  date: (order.createdAt || order.orderDate) as string,
                  category: 'payment',
                  description: `دفعة مستلمة (Legacy) - ${order.customerName} (طلب ${order.orderCode})`,
                  by: order.processedByUserName,
                  orderId: order.id,
                  orderCode: order.orderCode,
                  orderSubtotal: 0,
                  discountMovement: 0,
                  paymentMovement: order.paid,
                  expenseMovement: 0,
                  method: 'Cash',
                  items: order.items,
                  orderTotal: order.total,
                  orderPaid: order.paid,
                  newRemaining: order.remainingAmount,
              });
          }
        }
    });

    allExpenses.forEach(expense => {
        const eDate = new Date(expense.date);
        const expenseIsLinked = expense.shiftId === shift.id;
        if (expense.category === 'مرتجعات بيع' || expense.category === 'مرتجع بيع') return;
        if (expenseIsLinked || (!expense.shiftId && expense.userId === shift.cashier.id && eDate >= shiftStartTime && eDate <= shiftEndTime)) {
            eventsInShift.push({
                date: expense.date,
                category: expense.category === 'إلغاء طلبات' ? 'sale-return' : 'expense',
                description: expense.category === 'إلغاء طلبات' ? `إلغاء طلب ورد مبلغ: ${expense.description}` : `مصروف: ${expense.description}`,
                by: expense.userName,
                orderSubtotal: 0,
                discountMovement: 0,
                paymentMovement: 0,
                expenseMovement: expense.amount,
                method: 'Cash',
            });
        }
    });

    saleReturns.forEach(sr => {
        const rDate = new Date(sr.createdAt || sr.returnDate);
        const returnIsLinked = sr.shiftId === shift.id;
        if (returnIsLinked || (!sr.shiftId && sr.userId === shift.cashier.id && rDate >= shiftStartTime && rDate <= shiftEndTime)) {
            eventsInShift.push({
                date: sr.createdAt || sr.returnDate,
                category: 'sale-return',
                description: `مرتجع بيع ${sr.returnCode} (طلب ${sr.orderCode})`,
                by: sr.userName,
                orderId: sr.orderId,
                orderCode: sr.orderCode,
                orderSubtotal: 0,
                discountMovement: 0,
                paymentMovement: 0,
                expenseMovement: sr.refundAmount,
                method: 'Cash',
                items: sr.items as any,
            });
        }
    });

    eventsInShift.sort((a,b) => b.date.getTime() - new Date(a.date).getTime());
    return eventsInShift.map((tx, index) => ({ ...tx, id: `${tx.orderId || 'exp'}-${tx.date}-${tx.category}-${index}`, transactionCode: `TX-${eventsInShift.length - index}` }));
  }, [shift, orders, allExpenses, saleReturns, shifts]);

  const totals = useMemo(() => {
      let salesGross = 0; let rentalsGross = 0; let receivedTotal = 0; let receivedCash = 0; let receivedVodafone = 0; let receivedInstaPay = 0; 
      let receivedVisa = 0; let discounts = 0; let expenses = 0; let saleReturnsTotal = 0;
      
      shiftTransactions.forEach(tx => {
          if (tx.category === 'order') {
              if (!(tx as any).isCancelled) {
                if ((tx as any).type === 'Sale') salesGross += (tx.orderSubtotal || 0);
                else rentalsGross += (tx.orderSubtotal || 0);
              }
          } else if (tx.category === 'payment') {
              const amt = tx.paymentMovement || 0;
              receivedTotal += amt;
              if (tx.method === 'Vodafone Cash') receivedVodafone += amt;
              else if (tx.method === 'InstaPay') receivedInstaPay += amt;
              else if (tx.method === 'Visa') receivedVisa += amt;
              else receivedCash += amt;
          }
          else if (tx.category === 'discount') discounts += (tx.discountMovement || 0);
          else if (tx.category === 'expense') expenses += (tx.expenseMovement || 0);
          else if (tx.category === 'sale-return') saleReturnsTotal += (tx.expenseMovement || 0);
      });
      return { 
          grossRevenue: salesGross + rentalsGross, 
          receivedTotal, 
          receivedCash, 
          receivedVodafone, 
          receivedInstaPay, 
          receivedVisa,
          discounts, 
          expenses, 
          saleReturnsTotal, 
          salesGross, 
          rentalsGross 
      };
  }, [shiftTransactions]);

  const cashInDrawer = (shift?.openingBalance || 0) + totals.receivedCash - (totals.expenses + totals.saleReturnsTotal);
  const difference = (shift?.closingBalance || 0) - cashInDrawer;

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!shift) return <div className="p-8 text-center">الوردية غير موجودة</div>;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`الوردية رقم ${shift.shiftCode || id.slice(-6).toUpperCase()} - ${shift.cashier?.name}`} showBackButton>
          {shift.endTime && (
              <div className="flex flex-wrap gap-2">
                  {!shift.isPosted && permissions.canShiftsPost && (
                      <PostShiftDialog shift={shift} trigger={<Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold"><Landmark className="h-4 w-4"/> ترحيل للخزينة</Button>} />
                  )}
                  {shift.isPosted && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 h-10 px-4 text-sm flex gap-2 font-bold">
                          <CheckCircle2 className="h-4 w-4"/> تم الترحيل لـ {shift.postedToTreasuryName}
                      </Badge>
                  )}
                  {!shift.isPosted && permissions.canShiftsReopen && (
                      <>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="outline" className="gap-2 font-bold"><Edit3 className="h-4 w-4" /> تعديل مبلغ الإغلاق</Button></AlertDialogTrigger>
                            <AlertDialogContent dir="rtl" className="text-right">
                                <AlertDialogHeader><AlertDialogTitle>تعديل مبلغ الإغلاق</AlertDialogTitle><AlertDialogDescription>تصحيح المبلغ الفعلي للدرج المسجل عند الإقفال.</AlertDialogDescription></AlertDialogHeader>
                                <div className="py-4 space-y-2"><Label>المبلغ الفعلي الصحيح</Label><Input type="number" value={newClosingBalance} onChange={(e) => setNewClosingBalance(e.target.value)} /></div>
                                <AlertDialogFooter className="flex-row-reverse gap-2"><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); handleUpdateClosingBalance(); }} disabled={isReopening}>حفظ التعديل</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        {reopenStatus.canResume && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="outline" className="gap-2 text-amber-600 border-amber-200 font-bold"><RotateCcw className="h-4 w-4" /> إعادة فتح</Button></AlertDialogTrigger>
                                <AlertDialogContent dir="rtl" className="text-right">
                                    <AlertDialogHeader><AlertDialogTitle>إعادة فتح الوردية</AlertDialogTitle><AlertDialogDescription>سيتم مسح بيانات الإقفال وتصبح الوردية نشطة مرة أخرى.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row-reverse gap-2"><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); handleResumeShift(); }} disabled={isReopening} className="bg-amber-600">تأكيد الفتح</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                      </>
                  )}
              </div>
          )}
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
             <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary"/>الملخص المالي التفصيلي</CardTitle>
             {!shift.isPosted && permissions.canExpensesAdd && <AddExpenseDialog targetShift={shift} trigger={<Button variant="destructive" size="sm" className="gap-1.5 font-bold"><PlusCircle className="h-4 w-4" />إضافة مصروف</Button>} />}
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-muted/50 border border-transparent space-y-2">
                        <div className="flex justify-between items-center text-xs font-medium">
                            <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3 text-muted-foreground" /> إجمالي المبيعات</span>
                            <span className="font-mono">{formatCurrency(totals.salesGross)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-medium">
                            <span className="flex items-center gap-1"><Repeat className="h-3 w-3 text-muted-foreground" /> إجمالي الإيجارات</span>
                            <span className="font-mono">{formatCurrency(totals.rentalsGross)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-amber-600 font-bold">
                            <span className="flex items-center gap-1"><BadgePercent className="h-3 w-3" /> الخصومات المطبقة</span>
                            <span className="font-mono">{formatCurrency(totals.discounts)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between items-center font-bold text-sm">
                            <span>إجمالي الإيرادات (عقود)</span>
                            <span className="font-mono text-primary">{formatCurrency(totals.grossRevenue - totals.discounts)}</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-md bg-muted/40 dark:bg-neutral-900/60 border border-primary/10 space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 font-black mb-1 border-b pb-1 border-primary/5"><DollarSign className="h-3.5 w-3.5 text-blue-500"/> إجمالي المحصل (مقبوضات)</p>
                        <p className="font-black text-xl text-blue-600 dark:text-blue-400">{formatCurrency(totals.receivedTotal)}</p>
                        
                        <div className="mt-2 space-y-1.5 pt-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-muted-foreground" /> كاش (درج):</span> 
                                <span className="font-mono">{formatCurrency(totals.receivedCash)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-purple-600 dark:text-purple-400">
                                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> فودافون كاش:</span> 
                                <span className="font-mono">{formatCurrency(totals.receivedVodafone)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> إنستا باي:</span> 
                                <span className="font-mono">{formatCurrency(totals.receivedInstaPay)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-sky-600 dark:text-sky-400">
                                <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> فيزا:</span> 
                                <span className="font-mono">{formatCurrency(totals.receivedVisa)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground flex items-center gap-1 font-bold"><TrendingDown className="h-3 w-3 text-destructive"/> إجمالي المصروفات</p><p className="font-bold text-lg text-destructive">{formatCurrency(totals.expenses)}</p></div>
                    <div className="p-3 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground flex items-center gap-1 font-bold"><Undo className="h-3 w-3 text-destructive"/> مرتجعات وإلغاءات</p><p className="font-bold text-lg text-destructive">{formatCurrency(totals.saleReturnsTotal)}</p></div>
                    
                    <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 sm:col-span-2 shadow-sm">
                        <p className="text-xs text-green-700 dark:text-green-400 font-black">صافي النقدية المتوقع بالدرج</p>
                        <p className="font-black text-2xl text-green-700 dark:text-green-500">{formatCurrency(cashInDrawer)}</p>
                        <p className="text-[10px] text-green-600/80 font-medium mt-1">(رصيد افتتاح + مقبوضات كاش - مصروفات ومرتجعات)</p>
                    </div>
                </div>
            </div>
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="p-3 rounded-md bg-primary/10 border border-primary/20"><p className="text-xs text-primary font-black">الرصيد الافتتاحي</p><p className="font-mono font-black text-xl">{formatCurrency(shift.openingBalance || 0)}</p></div>
                    {shift.endTime && (
                         <>
                            <div className="p-3 rounded-md bg-muted/50 border border-transparent"><p className="text-xs text-muted-foreground font-bold">الرصيد الفعلي عند الإغلاق</p><p className="font-mono font-black text-xl">{formatCurrency(shift.closingBalance || 0)}</p></div>
                             <div className={cn('p-3 rounded-md space-y-1 flex flex-col items-center justify-center border', difference !== 0 ? (difference < 0 ? 'bg-orange-500/10 text-orange-600 border-orange-200' : 'bg-green-500/10 text-green-600 border-green-200') : 'bg-muted/50 border-transparent')}><p className="text-xs font-bold">{difference < 0 ? 'العجز' : difference > 0 ? 'الزيادة' : 'الفرق'}</p><p className="font-mono font-black text-xl">{formatCurrency(difference)}</p></div>
                         </>
                     )}
                </div>
                <div className="grid gap-2 text-sm p-4 border rounded-lg bg-background shadow-sm">
                     <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium">وقت الفتح</span><span className="text-xs font-mono font-bold">{formatDate(shift.startTime)}</span></div>
                     {shift.endTime && <div className="flex justify-between items-center"><span className="text-muted-foreground font-medium">وقت الإغلاق</span><span className="text-xs font-mono font-bold">{formatDate(shift.endTime)}</span></div>}
                     {shift.isPosted && <div className="flex justify-between items-center text-green-600 border-t pt-2 mt-1"><span className="font-black">حالة التوريد</span><span className="font-black">تم الترحيل لـ {shift.postedToTreasuryName}</span></div>}
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary"/>سجل حركات الوردية ({shiftTransactions.length})</CardTitle></CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="text-right w-[120px]">الوقت</TableHead><TableHead className="text-right">البيان</TableHead><TableHead className="text-center">كود الطلب</TableHead><TableHead className="text-center">الأصناف</TableHead><TableHead className="text-center">الإجمالي</TableHead><TableHead className="text-center">المدفوع</TableHead><TableHead className="text-center">الخصم/المصروف</TableHead><TableHead className="text-center">المحصل</TableHead><TableHead className="text-center">الطريقة</TableHead></TableRow></TableHeader>
                <TableBody>
                    {shiftTransactions.map((tx) => (
                        <TableRow key={tx.id} className={cn((tx as any).isCancelled && "bg-destructive/5 opacity-80")}>
                            <TableCell className="text-right text-[10px] font-mono font-bold">{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                            <TableCell className="text-right text-sm">
                                <span className={cn("font-medium", (tx as any).isCancelled && "line-through text-destructive")}>{tx.description}</span>
                            </TableCell>
                            <TableCell className="text-center">{tx.orderId ? <OrderDetailsDialog orderId={tx.orderId}><Button variant="link" className="font-mono p-0 h-auto text-xs font-bold">{tx.orderCode}</Button></OrderDetailsDialog> : '-'}</TableCell>
                            <TableCell className="text-center">{tx.items ? <OrderItemsPreviewDialog items={tx.items} /> : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{tx.orderTotal !== undefined ? formatCurrency(tx.orderTotal) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-green-600 font-medium">{tx.orderPaid !== undefined ? formatCurrency(tx.orderPaid) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-destructive font-medium">{(tx.category === 'discount' && tx.discountMovement) ? formatCurrency(tx.discountMovement) : (tx.category === 'expense' || tx.category === 'sale-return') && tx.expenseMovement ? formatCurrency(tx.expenseMovement) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-green-600 font-black">{(tx.category === 'payment' && tx.paymentMovement) ? formatCurrency(tx.paymentMovement) : '-'}</TableCell>
                            <TableCell className="text-center">{tx.method ? <Badge variant="outline" className="text-[10px] font-bold border-primary/20">{tx.method}</Badge> : '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface PageProps { params: Promise<{ id: string }>; }
export default function ShiftDetailsPage({ params }: PageProps) {
    const { id } = use(params);
    return <AppLayout><AuthGuard><ShiftDetailsPageContent id={id} /></AuthGuard></AppLayout>
}
