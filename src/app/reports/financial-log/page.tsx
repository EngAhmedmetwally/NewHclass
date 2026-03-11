
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
import { Users2, SlidersHorizontal, FilterX, BarChartHorizontal, DollarSign, Filter, Landmark, TrendingDown, TrendingUp, BadgePercent, Calendar, User, Wallet, Hash, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { User as UserType, Order, Branch, Expense, Shift } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { AppLayout } from '@/components/app-layout';


type Transaction = {
    id: string;
    date: Date;
    category: 'order' | 'payment' | 'discount' | 'expense';
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
};

function FinancialLogPageContent() {
    const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
    const [branch, setBranch] = useState('all');
    const [transactionCategory, setTransactionCategory] = useState('all');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    // State to hold filters that are actively applied
    const [activeFilters, setActiveFilters] = useState({
        selectedUser, branch, transactionCategory, startDate, endDate
    });
    
    const { data: users, isLoading: isLoadingUsers } = useRtdbList<UserType>('users');
    const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
    const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
    const { data: expenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');
    const { data: shifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts');

    const isInitialLoading = isLoadingUsers || isLoadingOrders || isLoadingBranches || isLoadingExpenses || isLoadingShifts;

    const allTransactions = useMemo(() => {
        if (isInitialLoading) return [];

        const transactions: Transaction[] = [];
        
        // Helper to get shift code from ID
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
                by: order.sellerName, 
                customer: order.customerName,
                orderId: order.id,
                orderCode: order.orderCode,
                amount: order.total || 0,
                method: 'آجل',
                branchId: order.branchId,
                shiftCode: order.shiftCode || getShiftCode(order.shiftId),
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
                });
            }
            
            if(order.discountAmount && order.discountAmount > 0) {
                transactions.push({
                    id: `${order.id}-discount`,
                    date: new Date(order.discountAppliedDate || order.orderDate),
                    category: 'discount',
                    type: 'خصم مطبق',
                    description: `خصم على الطلب ${order.orderCode}`,
                    by: order.processedByUserName,
                    customer: order.customerName,
                    orderId: order.id,
                    orderCode: order.orderCode,
                    amount: -order.discountAmount,
                    method: 'لا ينطبق',
                    branchId: order.branchId,
                    shiftCode: order.shiftCode || getShiftCode(order.shiftId),
                });
            }
        });

        expenses.forEach(expense => {
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

        return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [users, orders, expenses, shifts, isInitialLoading]);


    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(t => {
            const f = activeFilters;
            const user = users.find(u => u.id === f.selectedUser);
            const byUser = !f.selectedUser || t.by === user?.fullName;
            const byDate = (!f.startDate || t.date >= f.startDate) && (!f.endDate || t.date <= f.endDate);
            const byBranch = f.branch === 'all' || t.branchId === f.branch;
            const byCategory = f.transactionCategory === 'all' || t.category === f.transactionCategory;
            
            return byUser && byDate && byBranch && byCategory;
        });
    }, [allTransactions, activeFilters, users]);

    const userSummaries = useMemo(() => {
        const summaryMap = new Map<string, { id: string, name: string, payments: number, total: number }>();
        
        // Include any user who might perform financial actions (Cashier, Admin, OR Seller)
        users.forEach(u => {
            if (u.id && u.fullName) {
                summaryMap.set(u.id, { id: u.id, name: u.fullName, payments: 0, total: 0 });
            }
        });

        filteredTransactions.forEach(t => {
            const user = users.find(u => u.fullName === t.by);
            if (user && user.id && t.category === 'payment') {
                const summary = summaryMap.get(user.id);
                if (summary) {
                    summary.payments += 1;
                    summary.total += t.amount;
                }
            }
        });
        
        // Return only those who actually had activity in the current filter, or are key staff
        return Array.from(summaryMap.values())
            .filter(s => s.payments > 0 || users.find(u => u.id === s.id)?.role !== 'seller')
            .sort((a, b) => b.total - a.total);
    }, [filteredTransactions, users]);

    const branchSummaries = useMemo(() => {
        const summaryMap = new Map<string, { id: string; name: string; income: number; expenses: number; discounts: number; net: number }>();
        branches.forEach(b => {
             summaryMap.set(b.id, { id: b.id, name: b.name, income: 0, expenses: 0, discounts: 0, net: 0 });
        });
        
        filteredTransactions.forEach(t => {
            const summary = summaryMap.get(t.branchId);
            if(summary) {
                if (t.category === 'payment') {
                    summary.income += t.amount;
                } else if (t.category === 'expense') {
                    summary.expenses += Math.abs(t.amount); 
                } else if (t.category === 'discount') {
                    summary.discounts += Math.abs(t.amount);
                }
            }
        });
        
        summaryMap.forEach(s => s.net = s.income - s.expenses);

        return Array.from(summaryMap.values());

    }, [filteredTransactions, branches]);

    const summary = useMemo(() => {
        const totalIncome = filteredTransactions.reduce((acc, t) => (t.category === 'payment' ? acc + t.amount : acc), 0);
        const totalExpenses = filteredTransactions.reduce((acc, t) => (t.category === 'expense' ? acc + Math.abs(t.amount) : acc), 0);
        const totalDiscounts = filteredTransactions.reduce((acc, t) => (t.category === 'discount' ? acc + Math.abs(t.amount) : acc), 0);
        const totalTransactions = filteredTransactions.length;
        return { totalIncome, totalExpenses, totalDiscounts, totalTransactions };
    }, [filteredTransactions]);

    const applyFilters = () => {
        setActiveFilters({ selectedUser, branch, transactionCategory, startDate, endDate });
    };

    const clearFilters = () => {
        setSelectedUser(undefined);
        setBranch('all');
        setTransactionCategory('all');
        setStartDate(undefined);
        setEndDate(undefined);
        setActiveFilters({ selectedUser: undefined, branch: 'all', transactionCategory: 'all', startDate: undefined, endDate: undefined });
    }

  const getTypeBadge = (category: Transaction['category'], type: string) => {
      if (category === 'expense' || category === 'discount') return <Badge variant="destructive">{type}</Badge>;
      if (category === 'payment') return <Badge variant="default" className="bg-green-600 hover:bg-green-700">{type}</Badge>;
      if (category === 'order') return <Badge variant="secondary">{type}</Badge>;
      return <Badge>{type}</Badge>;
  };

  const renderMobileTransactionCards = () => (
    <div className="grid gap-4 md:hidden">
        {filteredTransactions.map((t) => (
            <Card key={t.id} className={cn("overflow-hidden", t.orderId && "cursor-pointer hover:bg-muted/50")}>
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
                        {getTypeBadge(t.category, t.type)}
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
                                t.amount < 0 ? 'text-destructive' : t.category === 'payment' ? 'text-green-600' : 'text-foreground'
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
                  <CardTitle>تصفية المعاملات</CardTitle>
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
                           <SelectItem value="expense">مصروف</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex flex-col gap-2">
                  <Label>من تاريخ</Label>
                  <DatePickerDialog
                    value={startDate}
                    onValueChange={setStartDate}
                  />
              </div>
              <div className="flex flex-col gap-2">
                  <Label>إلى تاريخ</Label>
                   <DatePickerDialog
                    value={endDate}
                    onValueChange={setEndDate}
                    fromDate={startDate}
                  />
              </div>
              <div className="flex flex-col gap-2 justify-end col-span-full md:col-span-1">
                 <div className="flex gap-2">
                    <Button onClick={applyFilters} className="w-full gap-1">
                        <Filter className="h-4 w-4"/>
                        تطبيق الفلاتر
                    </Button>
                    <Button variant="outline" onClick={clearFilters} className="gap-1">
                        <FilterX className="h-4 w-4"/>
                        مسح
                    </Button>
                 </div>
              </div>
          </CardContent>
      </Card>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-green-500/5 border-green-500/10">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500"/> إجمالي الدخل (المستلم)
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-green-600">{summary.totalIncome.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
             <Card className="bg-destructive/5 border-destructive/10">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <TrendingDown className="h-4 w-4 text-destructive"/> إجمالي المصروفات
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-destructive">{summary.totalExpenses.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/10">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <BadgePercent className="h-4 w-4 text-amber-600"/> إجمالي الخصومات
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-32" /> : (
                        <span className="font-bold text-xl font-mono text-amber-600">{summary.totalDiscounts.toLocaleString()} ج.م</span>
                    )}
                </CardContent>
            </Card>
             <Card className="bg-muted/50">
                <CardContent className="p-4">
                    <span className="text-muted-foreground flex items-center gap-2 text-xs mb-1">
                        <Users2 className="h-4 w-4"/> عدد المعاملات
                    </span>
                    {isInitialLoading ? <Skeleton className="h-8 w-16" /> : (
                        <span className="font-bold text-xl font-mono">{summary.totalTransactions}</span>
                    )}
                </CardContent>
            </Card>
      </div>

        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    <CardTitle className="text-lg">ملخص الفروع (حسب الفلتر)</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>الفرع</TableHead><TableHead className="text-center">إجمالي الدخل</TableHead><TableHead className="text-center">إجمالي المصروفات</TableHead><TableHead className="text-center">صافي التدفق</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isInitialLoading && [...Array(2)].map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-5 w-24"/></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto"/></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto"/></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto"/></TableCell></TableRow>)}
                            {!isInitialLoading && branchSummaries.map(bs => (
                                <TableRow key={bs.id}>
                                    <TableCell className="font-medium">{bs.name}</TableCell>
                                    <TableCell className="text-center font-mono text-green-600">{bs.income.toLocaleString()} ج.م</TableCell>
                                    <TableCell className="text-center font-mono text-destructive">{bs.expenses.toLocaleString()} ج.م</TableCell>
                                    <TableCell className={cn("text-center font-mono font-bold", bs.net >= 0 ? "text-primary" : "text-destructive")}>{bs.net.toLocaleString()} ج.م</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            <CardTitle>نشاط المسجلين</CardTitle>
          </div>
          <CardDescription>
            ملخص الدفعات المستلمة لكل موظف (بائع أو كاشير). اضغط للفلترة.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoadingUsers && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          {!isLoadingUsers && userSummaries.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                const newSelectedUser = user.id === selectedUser ? undefined : user.id;
                setSelectedUser(newSelectedUser);
                setActiveFilters(prev => ({...prev, selectedUser: newSelectedUser}));
              }}
              className={cn(
                  "rounded-lg border p-3 flex flex-col gap-1 text-right transition-colors",
                  selectedUser === user.id ? "bg-primary/10 border-primary" : "bg-muted/50 hover:bg-muted"
              )}
            >
              <CardTitle className="text-sm font-bold">{user.name}</CardTitle>
              <div className="text-[10px] space-y-0.5 text-muted-foreground">
                <p>دفعات: <span className="font-mono text-foreground">{user.payments}</span></p>
                <p>إجمالي: <span className="font-mono text-foreground font-semibold">{user.total.toLocaleString()} ج.م</span></p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
              {activeFilters.selectedUser ? `معاملات ${users.find(u=>u.id === activeFilters.selectedUser)?.fullName}` : 'جميع المعاملات'}
          </CardTitle>
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
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px] text-center">التاريخ</TableHead>
                            <TableHead className="text-center">الوردية</TableHead>
                            <TableHead className="text-center">النوع</TableHead>
                            <TableHead className="text-center">الوصف</TableHead>
                            <TableHead className="text-center">بواسطة</TableHead>
                            <TableHead className="text-center">العميل</TableHead>
                            <TableHead className="text-center">المبلغ</TableHead>
                            <TableHead className="text-center">طريقة الدفع</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredTransactions.map((t) => (
                            <TableRow key={t.id} className={t.orderId ? 'cursor-pointer hover:bg-muted' : ''}>
                            <TableCell className="text-center text-xs font-mono">{format(t.date, "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-center">
                                {t.shiftCode ? (
                                    <Badge variant="outline" className="font-mono text-primary border-primary/30">
                                        {t.shiftCode}
                                    </Badge>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="text-center">{getTypeBadge(t.category, t.type)}</TableCell>
                            <TableCell className="text-right text-xs max-w-[250px] truncate">
                                {t.orderId ? (
                                    <OrderDetailsDialog orderId={t.orderId}>
                                        <span className="underline decoration-dashed">{t.description}</span>
                                    </OrderDetailsDialog>
                                ) : (
                                    t.description
                                )}
                            </TableCell>
                            <TableCell className="text-center">{t.by}</TableCell>
                            <TableCell className="text-center">{t.customer}</TableCell>
                            <TableCell
                                className={cn(
                                "text-center font-mono font-semibold",
                                t.amount < 0 ? 'text-destructive' : t.category === 'payment' ? 'text-green-600' : 'text-foreground'
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
