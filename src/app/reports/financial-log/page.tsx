"use client";

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users2, SlidersHorizontal, FilterX, BarChartHorizontal, DollarSign, Filter, Landmark, TrendingDown, TrendingUp, BadgePercent, Calendar, User, Wallet, Hash, Clock, Eye, Undo, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { User as UserType, Order, Branch, Expense, Shift, OrderItem, SaleReturn, Treasury } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { AppLayout } from '@/components/app-layout';
import { OrderItemsPreviewDialog } from '@/components/order-items-preview-dialog';


type Transaction = {
    id: string;
    date: Date;
    category: 'order' | 'payment' | 'discount' | 'expense' | 'sale-return' | 'treasury';
    type: string;
    description: string;
    by: string;
    customer: string;
    orderId?: string;
    orderCode?: string;
    amount: number;
    method: string;
    branchId: string;
    shiftCode?: string;
    items?: OrderItem[];
};

// Helper to format date for datetime-local input
const toDateTimeLocalString = (date?: Date) => {
    if (!date) return "";
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
};

function FinancialLogPageContent() {
    const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
    const [branch, setBranch] = useState('all');
    const [transactionCategory, setTransactionCategory] = useState('all');
    
    // Default Start: Today at 09:00 AM
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        return d;
    });
    
    // Default End: Tomorrow at 05:00 AM
    const [endDate, setEndDate] = useState<Date | undefined>(() => {
        const d = addDays(new Date(), 1);
        d.setHours(5, 0, 0, 0);
        return d;
    });

    const { data: users, isLoading: isLoadingUsers } = useRtdbList<UserType>('users');
    const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
    const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
    const { data: expenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');
    const { data: shifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts');
    const { data: saleReturns, isLoading: isLoadingReturns } = useRtdbList<SaleReturn>('saleReturns');
    const { data: treasuries, isLoading: isLoadingTreasuries } = useRtdbList<Treasury>('treasuries');

    const isInitialLoading = isLoadingUsers || isLoadingOrders || isLoadingBranches || isLoadingExpenses || isLoadingShifts || isLoadingReturns || isLoadingTreasuries;

    const allTransactions = useMemo(() => {
        if (isInitialLoading) return [];

        const transactions: Transaction[] = [];
        
        const getShiftCode = (id?: string) => {
            if (!id) return undefined;
            return shifts.find(s => s.id === id)?.shiftCode;
        };

        orders.forEach(order => {
            // Order Entry
            transactions.push({
                id: order.id,
                date: new Date(order.createdAt || order.orderDate),
                category: 'order',
                type: order.transactionType === 'Sale' ? 'حركة بيع' : 'حركة إيجار',
                description: `طلب ${order.transactionType === 'Sale' ? 'بيع' : 'إيجار'} (${order.customerName})`,
                by: order.processedByUserName || order.sellerName, 
                customer: order.customerName,
                orderId: order.id,
                orderCode: order.orderCode,
                amount: order.total || 0,
                method: 'آجل',
                branchId: order.branchId,
                shiftCode: order.shiftCode || getShiftCode(order.shiftId),
                items: order.items,
            });

             if (order.payments) {
                Object.values(order.payments).forEach(p => {
                    transactions.push({
                        id: `${order.id}-payment-${p.id}`,
                        date: new Date(p.date),
                        category: 'payment',
                        type: 'دفعة مستلمة',
                        description: `دفعة للطلب ${order.orderCode} - ${order.customerName}`,
                        by: p.userName,
                        customer: order.customerName,
                        orderId: order.id,
                        orderCode: order.orderCode,
                        amount: p.amount,
                        method: p.method,
                        branchId: order.branchId,
                        shiftCode: getShiftCode(p.shiftId),
                        items: order.items,
                    });
                });
            } else if (order.paid > 0) { 
                 transactions.push({
                    id: `${order.id}-payment`,
                    date: new Date(order.createdAt || order.orderDate),
                    category: 'payment',
                    type: 'دفعة مستلمة',
                    description: `دفعة للطلب ${order.orderCode} - ${order.customerName}`,
                    by: order.processedByUserName,
                    customer: order.customerName,
                    orderId: order.id,
                    orderCode: order.orderCode,
                    amount: order.paid,
                    method: 'Cash',
                    branchId: order.branchId,
                    shiftCode: order.shiftCode || getShiftCode(order.shiftId),
                    items: order.items,
                });
            }
            
            if(order.discountAmount && order.discountAmount > 0) {
                transactions.push({
                    id: `${order.id}-discount`,
                    date: new Date(order.discountAppliedDate || order.orderDate),
                    category: 'discount',
                    type: 'خصم مطبق',
                    description: `خصم على الطلب ${order.orderCode}`,
                    by: order.processedByUserName || 'نظام',
                    customer: order.customerName,
                    orderId: order.id,
                    orderCode: order.orderCode,
                    amount: -order.discountAmount,
                    method: 'لا ينطبق',
                    branchId: order.branchId,
                    shiftCode: order.shiftCode || getShiftCode(order.shiftId),
                    items: order.items,
                });
            }
        });

        expenses.forEach(expense => {
            if (expense.category === 'مرتجعات بيع' || expense.category === 'مرتجع بيع') return;

            transactions.push({
                id: expense.id,
                date: new Date(expense.date),
                category: 'expense',
                type: 'مصروف',
                description: expense.description,
                by: expense.userName,
                customer: '-',
                amount: -expense.amount,
                method: 'Cash',
                branchId: expense.branchId,
                shiftCode: getShiftCode(expense.shiftId),
            })
        });

        saleReturns.forEach(sr => {
            transactions.push({
                id: sr.id,
                date: new Date(sr.createdAt || sr.returnDate),
                category: 'sale-return',
                type: 'مرتجعات بيع',
                description: `مرتجع بيع ${sr.returnCode} للطلب ${sr.orderCode}`,
                by: sr.userName,
                customer: '-',
                amount: -sr.refundAmount,
                method: 'Cash',
                branchId: orders.find(o => o.id === sr.orderId)?.branchId || '',
                shiftCode: sr.shiftCode || getShiftCode(sr.shiftId),
                items: sr.items as any,
                orderId: sr.orderId,
                orderCode: sr.orderCode
            })
        });

        // Treasury Transactions
        treasuries.forEach(t => {
            if (t.transactions) {
                Object.values(t.transactions).forEach(tx => {
                    transactions.push({
                        id: tx.id,
                        date: new Date(tx.date),
                        category: 'treasury',
                        type: tx.type === 'deposit' ? 'إيداع خزينة' : 'سحب خزينة',
                        description: `[خزينة: ${t.name}] ${tx.description}`,
                        by: tx.userName,
                        customer: '-',
                        amount: tx.amount,
                        method: 'نظامي',
                        branchId: t.branchId
                    });
                });
            }
        });

        return transactions.sort((a, b) => b.date.getTime() - new Date(a.date).getTime());
    }, [users, orders, expenses, shifts, saleReturns, treasuries, isInitialLoading]);


    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(t => {
            let userMatch = true;
            if (selectedUser) {
                const user = users.find(u => u.id === selectedUser);
                userMatch = t.by === user?.fullName || t.by === user?.username;
            }

            const byDate = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
            const byBranch = branch === 'all' || t.branchId === branch;
            const byCategory = transactionCategory === 'all' || t.category === transactionCategory;
            
            return userMatch && byDate && byBranch && byCategory;
        });
    }, [allTransactions, selectedUser, branch, transactionCategory, startDate, endDate, users]);

    const summary = useMemo(() => {
        // CRITICAL: Filter Income/Revenue to only include actual customer payments. 
        // Exclude treasury deposits (transfers) as they are not business revenue.
        const totalIncome = filteredTransactions.reduce((acc, t) => 
            (t.category === 'payment' ? acc + t.amount : acc), 0);
            
        // CRITICAL: Real operational expenses and returns. 
        // Exclude internal treasury withdrawals (transfers).
        const totalExpenses = filteredTransactions.reduce((acc, t) => 
            ((t.category === 'expense' || t.category === 'sale-return') ? acc + Math.abs(t.amount) : acc), 0);
            
        const totalDiscounts = filteredTransactions.reduce((acc, t) => 
            (t.category === 'discount' ? acc + Math.abs(t.amount) : acc), 0);
            
        const totalTransactions = filteredTransactions.length;
        return { totalIncome, totalExpenses, totalDiscounts, totalTransactions };
    }, [filteredTransactions]);

    const clearFilters = () => {
        const defaultStart = new Date();
        defaultStart.setHours(9, 0, 0, 0);
        const defaultEnd = addDays(new Date(), 1);
        defaultEnd.setHours(5, 0, 0, 0);

        setSelectedUser(undefined);
        setBranch('all');
        setTransactionCategory('all');
        setStartDate(defaultStart);
        setEndDate(defaultEnd);
    }

  const getTypeBadge = (category: Transaction['category'], type: string, amount: number) => {
      if (category === 'expense' || category === 'discount') return <Badge variant="destructive">{type}</Badge>;
      if (category === 'sale-return') return <Badge variant="destructive" className="bg-red-600 flex gap-1"><Undo className="h-3 w-3"/> {type}</Badge>;
      if (category === 'payment') return <Badge variant="default" className="bg-green-600 hover:bg-green-700">{type}</Badge>;
      if (category === 'order') return <Badge variant="secondary">{type}</Badge>;
      if (category === 'treasury') {
          return amount > 0 
            ? <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 flex gap-1"><ArrowUpRight className="h-3 w-3"/> {type}</Badge>
            : <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 flex gap-1"><ArrowDownRight className="h-3 w-3"/> {type}</Badge>;
      }
      return <Badge>{type}</Badge>;
  };

  const renderMobileTransactionCards = () => (
    <div className="grid gap-4 md:hidden">
        {filteredTransactions.map((t) => (
            <Card key={t.id} className={cn("overflow-hidden", t.orderId && "cursor-pointer hover:bg-muted/50", t.category === 'treasury' && "border-primary/20 bg-primary/5")}>
                <CardHeader className="p-4 pb-2 bg-muted/20">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                            <div className="text-[10px] font-mono text-muted-foreground">
                                {format(t.date, "dd/MM/yyyy HH:mm")}
                            </div>
                            {t.shiftCode && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-primary font-mono">
                                    <Hash className="h-3 w-3" /> وردية: {t.shiftCode}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {t.items && <OrderItemsPreviewDialog items={t.items} />}
                            {getTypeBadge(t.category, t.type, t.amount)}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                    <div className="flex justify-between items-end gap-2">
                        <div className="flex-grow space-y-1">
                            {t.orderId ? (
                                <OrderDetailsDialog orderId={t.orderId}>
                                    <p className="text-sm font-semibold hover:underline decoration-dashed">{t.description}</p>
                                </OrderDetailsDialog>
                            ) : (
                                <p className="text-sm font-semibold">{t.description}</p>
                            )}
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><User className="h-3 w-3"/> بواسطة: {t.by}</span>
                                {t.customer !== '-' && <span className="flex items-center gap-1"><User className="h-3 w-3"/> العميل: {t.customer}</span>}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={cn(
                                "text-lg font-bold font-mono",
                                t.amount < 0 ? 'text-destructive' : t.amount > 0 ? 'text-green-600' : 'text-foreground'
                            )}>
                                {t.amount.toLocaleString()} ج.م
                            </p>
                            <Badge variant="outline" className="text-[9px] h-5">{t.method}</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="السجل المالي" showBackButton />
      
      <Card>
          <CardHeader>
              <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5"/>
                  <CardTitle>تصفية المعاملات (تحديث تلقائي)</CardTitle>
              </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                  <Label>الفرع</Label>
                   <Select value={branch} onValueChange={setBranch} disabled={isLoadingBranches}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">كل الفروع</SelectItem>
                          {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
               <div className="flex flex-col gap-2">
                  <Label>فئة المعاملة</Label>
                   <Select value={transactionCategory} onValueChange={setTransactionCategory}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">كل الفئات</SelectItem>
                           <SelectItem value="order">حركة بيع/إيجار</SelectItem>
                           <SelectItem value="payment">دفعة مستلمة</SelectItem>
                           <SelectItem value="discount">خصم مطبق</SelectItem>
                           <SelectItem value="expense">مصروف تشغيلي</SelectItem>
                           <SelectItem value="sale-return">مرتجع بيع</SelectItem>
                           <SelectItem value="treasury">حركات الخزينة والترحيلات</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex flex-col gap-2">
                  <Label>من تاريخ ووقت</Label>
                  <Input 
                    type="datetime-local" 
                    value={toDateTimeLocalString(startDate)} 
                    onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)} 
                  />
              </div>
              <div className="flex flex-col gap-2">
                  <Label>إلى تاريخ ووقت</Label>
                  <Input 
                    type="datetime-local" 
                    value={toDateTimeLocalString(endDate)} 
                    onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)} 
                  />
              </div>
              <div className="flex flex-col gap-2 justify-end col-span-full md:col-span-1">
                 <Button variant="outline" onClick={clearFilters} className="w-full gap-1">
                    <FilterX className="h-4 w-4"/>
                    مسح كافة الفلاتر
                </Button>
              </div>
          </CardContent>
      </Card>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-green-500/5 border-green-500/10 shadow-sm">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500"/> إجمالي التحصيلات (إيراد)
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-green-600">{summary.totalIncome.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
             <Card className="bg-destructive/5 border-destructive/10 shadow-sm">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <TrendingDown className="h-4 w-4 text-destructive"/> إجمالي المصروفات والمرتجعات
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-destructive">{summary.totalExpenses.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/10 shadow-sm">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <BadgePercent className="h-4 w-4 text-amber-600"/> إجمالي الخصومات الممنوحة
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-amber-600">{summary.totalDiscounts.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
             <Card className="bg-muted/50 shadow-sm">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <Users2 className="h-4 w-4"/> عدد كافة الحركات
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-16" /> : (
                        <span className="font-bold text-xl font-mono">{summary.totalTransactions}</span>
                    )}
                </CardContent>
            </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل العمليات التفصيلي</CardTitle>
          <CardDescription>يتم عرض كافة الحركات المالية والتشغيلية بما في ذلك ترحيلات النقدية للخزائن.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isInitialLoading ? (
              <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
          ) : filteredTransactions.length === 0 ? (
              <div className="h-32 text-center text-muted-foreground flex items-center justify-center">
                  لا توجد معاملات تطابق الفلاتر المحددة.
              </div>
          ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px] text-center">التاريخ</TableHead>
                            <TableHead className="text-center">الوردية</TableHead>
                            <TableHead className="text-center">كود الطلب</TableHead>
                            <TableHead className="text-center">أصناف الطلب</TableHead>
                            <TableHead className="text-center">النوع</TableHead>
                            <TableHead className="text-center">الوصف</TableHead>
                            <TableHead className="text-center">بواسطة</TableHead>
                            <TableHead className="text-center">المبلغ</TableHead>
                            <TableHead className="text-center">طريقة الدفع</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredTransactions.map((t) => (
                            <TableRow key={t.id} className={cn(t.orderId ? 'cursor-pointer hover:bg-muted' : '', t.category === 'treasury' && "bg-primary/5")}>
                            <TableCell className="text-center text-xs font-mono">{format(t.date, "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-center">
                                {t.shiftCode ? (
                                    <Badge variant="outline" className="font-mono text-primary border-primary/30">
                                        {t.shiftCode}
                                    </Badge>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{t.orderCode || '-'}</TableCell>
                            <TableCell className="text-center">
                                {t.items ? <OrderItemsPreviewDialog items={t.items} /> : '-'}
                            </TableCell>
                            <TableCell className="text-center">{getTypeBadge(t.category, t.type, t.amount)}</TableCell>
                            <TableCell className="text-right text-xs max-w-[200px] truncate">
                                {t.orderId ? (
                                    <OrderDetailsDialog orderId={t.orderId}>
                                        <span className="underline decoration-dashed">{t.description}</span>
                                    </OrderDetailsDialog>
                                ) : (
                                    t.description
                                )}
                            </TableCell>
                            <TableCell className="text-center">{t.by}</TableCell>
                            <TableCell
                                className={cn(
                                "text-center font-mono font-semibold",
                                t.amount < 0 ? 'text-destructive' : t.amount > 0 ? 'text-green-600' : 'text-foreground'
                                )}
                            >
                                {t.amount.toLocaleString()} ج.م
                            </TableCell>
                            <TableCell className="text-center">{t.method}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
                {renderMobileTransactionCards()}
              </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancialLogPage() {
    return (
        <AppLayout>
            <FinancialLogPageContent />
        </AppLayout>
    );
}
