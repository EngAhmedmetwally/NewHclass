'use client';

import React, { useMemo, use } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, User as AppUser, OrderPayment, ShiftTransaction } from '@/lib/definitions';
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
  FileText
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { cn } from '@/lib/utils';

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
  
  const isLoading = isLoadingShifts || isLoadingOrders;

  const shift = useMemo(() => {
    if (isLoading || !shifts) return undefined;
    return shifts.find((s) => s.id === id);
  }, [shifts, id, isLoading]);

  const shiftTransactions = useMemo((): ShiftTransaction[] => {
    if (!shift || !orders) return [];

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

    const eventsInShift: Omit<ShiftTransaction, 'id' | 'transactionCode'>[] = [];

    orders.forEach(order => {
        const creationDate = new Date(order.createdAt || order.orderDate);
        
        // 1. Primary check: Is this order explicitly tagged with this shift ID?
        // 2. Secondary check: Did the creation, payment, or discount happen during shift hours? (Fallback)
        const hasExplicitShiftId = order.shiftId === shift.id;
        
        const hasPaymentsInShift = order.payments && Object.values(order.payments).some(p => 
            p.shiftId === shift.id || (new Date(p.date) >= shiftStartTime && new Date(p.date) <= shiftEndTime)
        );

        const hasDiscountInShift = (order.discountAmount && order.discountAppliedDate) && (
            (new Date(order.discountAppliedDate) >= shiftStartTime && new Date(order.discountAppliedDate) <= shiftEndTime)
        );

        const orderCreatedInShift = hasExplicitShiftId || (creationDate >= shiftStartTime && creationDate <= shiftEndTime);

        if (!orderCreatedInShift && !hasPaymentsInShift && !hasDiscountInShift) return;

        const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
        
        // Create a timeline of all events for this specific order
        const orderTimeline: {date: Date, type: 'order' | 'payment' | 'discount', data: any, shiftId?: string}[] = [];
        
        orderTimeline.push({ date: creationDate, type: 'order', data: { subtotal }, shiftId: order.shiftId });

        if (order.discountAmount) {
            const dDate = order.discountAppliedDate ? new Date(order.discountAppliedDate) : creationDate;
            orderTimeline.push({ date: dDate, type: 'discount', data: { amount: order.discountAmount } });
        }
        
        if(order.payments) {
            Object.values(order.payments).forEach(p => {
                orderTimeline.push({ date: new Date(p.date), type: 'payment', data: p, shiftId: p.shiftId });
            });
        } else if (order.paid > 0 && !order.payments) { // Handle legacy orders
             orderTimeline.push({ date: creationDate, type: 'payment', data: { amount: order.paid, method: 'Cash', userName: order.processedByUserName }, shiftId: order.shiftId });
        }
        
        // Sort events chronologically
        orderTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Process the timeline
        let runningTotalPaid = 0;
        let runningTotalDiscount = 0;

        for (const event of orderTimeline) {
            // Event matches if shiftId is explicit OR date is within range
            const eventMatchesShift = event.shiftId === shift.id || (event.date >= shiftStartTime && event.date <= shiftEndTime);
            
            if (event.type === 'order') {
                if (eventMatchesShift) {
                     eventsInShift.push({
                        date: event.date.toISOString(),
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
            } else if (event.type === 'discount') {
                runningTotalDiscount = event.data.amount;
                if (eventMatchesShift) {
                     eventsInShift.push({
                        date: event.date.toISOString(),
                        category: 'discount',
                        description: `خصم على الطلب ${order.orderCode}`,
                        by: order.processedByUserName,
                        orderId: order.id,
                        orderCode: order.orderCode,
                        orderSubtotal: undefined,
                        discountMovement: event.data.amount,
                        paymentMovement: 0,
                        newRemaining: subtotal - runningTotalDiscount - runningTotalPaid,
                        method: '-',
                    });
                }
            } else if (event.type === 'payment') {
                runningTotalPaid += event.data.amount;
                 if (eventMatchesShift) {
                    eventsInShift.push({
                        date: event.date.toISOString(),
                        category: 'payment',
                        description: `دفعة من ${order.customerName}`,
                        by: event.data.userName,
                        orderId: order.id,
                        orderCode: order.orderCode,
                        orderSubtotal: undefined,
                        discountMovement: 0,
                        paymentMovement: event.data.amount,
                        newRemaining: subtotal - runningTotalDiscount - runningTotalPaid,
                        method: event.data.method,
                    });
                }
            }
        }
    });

    eventsInShift.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return eventsInShift.map((tx, index) => ({ 
        ...tx, 
        id: `${tx.orderId}-${tx.date}-${tx.category}-${Math.random()}`, 
        transactionCode: `TX-${eventsInShift.length - index}`
    }));
  }, [shift, orders]);


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
  const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0) - (shift.discounts || 0);
  const difference = (shift.closingBalance || 0) - cashInDrawer;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`تفاصيل وردية - ${shift.cashier?.name}`} showBackButton />

      <Card>
        <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary"/>
                الملخص المالي للوردية
            </CardTitle>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500"/> إجمالي الإيرادات</p>
                        <p className="font-bold text-lg">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3 text-blue-500"/> إجمالي الدرج (المستلم)</p>
                        <p className="font-bold text-lg">{formatCurrency(totalReceived)}</p>
                    </div>
                     <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><BadgePercent className="h-3 w-3 text-destructive"/> الخصومات المطبقة</p>
                        <p className="font-bold text-lg text-destructive">{formatCurrency(shift.discounts || 0)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive"/> إجمالي المصروفات</p>
                        <p className="font-bold text-lg text-destructive">{formatCurrency(shift.refunds || 0)}</p>
                    </div>
                </div>
                 <div className="p-4 rounded-lg border">
                    <p className="text-sm font-semibold mb-2">تفاصيل نقدية الدرج</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <p>كاش: <span className="font-mono font-medium">{formatCurrency(shift.cash || 0)}</span></p>
                        <p>فودافون: <span className="font-mono font-medium">{formatCurrency(shift.vodafoneCash || 0)}</span></p>
                        <p>إنستا باي: <span className="font-mono font-medium">{formatCurrency(shift.instaPay || 0)}</span></p>
                    </div>
                </div>
            </div>
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                     <div className="p-3 rounded-md bg-muted/50 space-y-1">
                        <p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p>
                        <p className="font-mono font-semibold">{formatCurrency(shift.openingBalance || 0)}</p>
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
                        <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> وقت البدء</span>
                        <span className="text-left text-xs">{formatDate(shift.startTime)}</span>
                    </div>
                     {shift.endTime && (
                         <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> وقت الانتهاء</span>
                            <span className="text-left text-xs">{formatDate(shift.endTime)}</span>
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
                الحركات المالية في الوردية
            </CardTitle>
            <CardDescription>قائمة بجميع الحركات المالية التي تم تسجيلها خلال هذه الوردية.</CardDescription>
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
                        <TableHead className="text-center">الخصم</TableHead>
                        <TableHead className="text-center">المدفوع</TableHead>
                        <TableHead className="text-center">المتبقي</TableHead>
                        <TableHead className="text-center">طريقة الدفع</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {shiftTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                            <TableCell className="text-right text-xs font-mono">{formatDate(tx.date)}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">{tx.transactionCode}</TableCell>
                            <TableCell className="text-right text-sm">{tx.description}</TableCell>
                            <TableCell className="text-center">
                                <OrderDetailsDialog orderId={tx.orderId!}>
                                    <Button variant="link" className="font-mono p-0 h-auto text-xs">{tx.orderCode}</Button>
                                </OrderDetailsDialog>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{tx.orderSubtotal ? formatCurrency(tx.orderSubtotal) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-destructive">{tx.discountMovement ? formatCurrency(tx.discountMovement) : '-'}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-green-600">{tx.paymentMovement ? formatCurrency(tx.paymentMovement) : '-'}</TableCell>
                            <TableCell className={cn("text-center font-mono font-semibold text-xs", tx.newRemaining > 0 ? "text-amber-600" : "text-green-600")}>{formatCurrency(tx.newRemaining)}</TableCell>
                            <TableCell className="text-center">
                                {tx.method ? <Badge variant="outline">{tx.method}</Badge> : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                    {shiftTransactions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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