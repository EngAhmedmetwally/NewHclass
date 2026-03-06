
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
import { Users2, SlidersHorizontal, FilterX, BarChartHorizontal, DollarSign, Filter, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { User, Order, Branch, Expense } from '@/lib/definitions';
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
    amount: number;
    method: string;
    branchId: string;
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
    
    const { data: users, isLoading: isLoadingUsers } = useRtdbList<User>('users');
    const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
    const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
    const { data: expenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');

    const isInitialLoading = isLoadingUsers || isLoadingOrders || isLoadingBranches || isLoadingExpenses;

    const allTransactions = useMemo(() => {
        if (isInitialLoading) return [];

        const transactions: Transaction[] = [];

        orders.forEach(order => {
            // This represents the total value of the order (debt created)
            transactions.push({
                id: order.id,
                date: new Date(order.orderDate),
                category: 'order',
                type: order.transactionType === 'Sale' ? 'حركة بيع' : 'حركة إيجار',
                description: `طلب ${order.orderCode} - ${order.customerName}`,
                by: order.sellerName, 
                customer: order.customerName,
                orderId: order.id,
                amount: order.total || 0,
                method: 'آجل',
                branchId: order.branchId,
            });

             if (order.payments && Array.isArray(order.payments)) {
                order.payments.forEach(p => {
                    transactions.push({
                        id: `${order.id}-payment-${p.id}`,
                        date: new Date(p.date),
                        category: 'payment',
                        type: 'دفعة مستلمة',
                        description: `دفعة من ${order.customerName} للطلب ${order.orderCode}`,
                        by: p.userName,
                        customer: order.customerName,
                        orderId: order.id,
                        amount: p.amount,
                        method: p.method,
                        branchId: order.branchId,
                    });
                });
            } else if (order.paid > 0) { 
                 transactions.push({
                    id: `${order.id}-payment`,
                    date: new Date(order.orderDate),
                    category: 'payment',
                    type: 'دفعة مستلمة',
                    description: `دفعة من ${order.customerName} للطلب ${order.orderCode}`,
                    by: order.processedByUserName,
                    customer: order.customerName,
                    orderId: order.id,
                    amount: order.paid,
                    method: 'Cash',
                    branchId: order.branchId,
                });
            }
            
            // This represents the discount as a negative value (reduction in revenue)
            if(order.discountAmount && order.discountAmount > 0) {
                transactions.push({
                    id: `${order.id}-discount`,
                    date: new Date(order.discountAppliedDate || order.orderDate),
                    category: 'discount',
                    type: 'خصم مطبق',
                    description: `خصم على الطلب ${order.orderCode}`,
                    by: order.processedByUserName, // Or whoever approved the discount
                    customer: order.customerName,
                    orderId: order.id,
                    amount: -order.discountAmount, // Negative amount
                    method: 'لا ينطبق',
                    branchId: order.branchId,
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
            })
        });

        return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [users, orders, expenses, isInitialLoading]);


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
        users.filter(u => u.role === 'cashier' || u.role === 'admin').forEach(u => {
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
        return Array.from(summaryMap.values());
    }, [filteredTransactions, users]);

    const branchSummaries = useMemo(() => {
        const summaryMap = new Map<string, { id: string; name: string; income: number; expenses: number; net: number }>();
        branches.forEach(b => {
             summaryMap.set(b.id, { id: b.id, name: b.name, income: 0, expenses: 0, net: 0 });
        });
        
        filteredTransactions.forEach(t => {
            const summary = summaryMap.get(t.branchId);
            if(summary) {
                if (t.category === 'payment') {
                    summary.income += t.amount;
                } else if (t.category === 'expense' || t.category === 'discount') {
                    summary.expenses += t.amount; // amount is already negative
                }
            }
        });
        
        summaryMap.forEach(s => s.net = s.income + s.expenses);

        return Array.from(summaryMap.values());

    }, [filteredTransactions, branches]);

    const summary = useMemo(() => {
        const totalIncome = filteredTransactions.reduce((acc, t) => (t.category === 'payment' ? acc + t.amount : acc), 0);
        const totalExpensesAndDiscounts = filteredTransactions.reduce((acc, t) => (t.amount < 0 ? acc + t.amount : acc), 0);
        const totalTransactions = filteredTransactions.length;
        return { totalIncome, totalExpenses: totalExpensesAndDiscounts, totalTransactions };
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
      
      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <BarChartHorizontal className="h-5 w-5" />
                <CardTitle>الملخص المالي العام (حسب الفلتر)</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1 p-4 rounded-md bg-muted/50">
                <span className="text-muted-foreground flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4 text-green-500"/> إجمالي الدخل (الدفعات المستلمة)</span>
                {isInitialLoading ? <Skeleton className="h-9 w-40 mt-1" /> : (
                  <span className="font-bold text-2xl font-mono text-green-600">{summary.totalIncome.toLocaleString()} ج.م</span>
                )}
            </div>
             <div className="flex flex-col gap-1 p-4 rounded-md bg-muted/50">
                <span className="text-muted-foreground flex items-center gap-2 text-sm"><TrendingDown className="h-4 w-4 text-destructive"/> إجمالي المصروفات والخصومات</span>
                {isInitialLoading ? <Skeleton className="h-9 w-40 mt-1" /> : (
                  <span className="font-bold text-2xl font-mono text-destructive">{summary.totalExpenses.toLocaleString()} ج.م</span>
                )}
            </div>
             <div className="flex flex-col gap-1 p-4 rounded-md bg-muted/50">
                <span className="text-muted-foreground flex items-center gap-2 text-sm"><Users2 className="h-4 w-4"/> إجمالي المعاملات</span>
                 {isInitialLoading ? <Skeleton className="h-9 w-16 mt-1" /> : (
                    <span className="font-bold text-2xl font-mono">{summary.totalTransactions}</span>
                 )}
            </div>
        </CardContent>
      </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    <CardTitle>ملخص الفروع (حسب الفلتر)</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>الفرع</TableHead><TableHead className="text-center">إجمالي الدخل</TableHead><TableHead className="text-center">إجمالي المصروفات والخصومات</TableHead><TableHead className="text-center">صافي التدفق النقدي</TableHead></TableRow></TableHeader>
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
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            <CardTitle>نشاط المسجلين (الكاشير / المدير)</CardTitle>
          </div>
          <CardDescription>
            ملخص الدفعات المستلمة لكل مسجل في الفترة المحددة. اضغط على اسم المسجل لفلترة دفعاته أدناه.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoadingUsers && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-[108px] rounded-lg" />)}
          {!isLoadingUsers && userSummaries.map((user) => (
            <button
              key={user.name}
              onClick={() => {
                const newSelectedUser = user.id === selectedUser ? undefined : user.id;
                setSelectedUser(newSelectedUser);
                setActiveFilters(prev => ({...prev, selectedUser: newSelectedUser}));
              }}
              className={cn(
                  "rounded-lg border p-4 flex flex-col gap-2 text-right transition-colors",
                  selectedUser === user.id ? "bg-primary/10 border-primary" : "bg-muted/50 hover:bg-muted"
              )}
            >
              <CardTitle className="font-headline text-lg">{user.name}</CardTitle>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>
                  عدد الدفعات: <span className="font-mono text-foreground font-medium">{user.payments}</span>
                </p>
                <p>
                  إجمالي المدفوع: <span className="font-mono text-foreground font-medium">{user.total.toLocaleString()} ج.م</span>
                </p>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-center">التاريخ</TableHead>
                <TableHead className="text-center">النوع</TableHead>
                <TableHead className="text-center">الوصف</TableHead>
                <TableHead className="text-center">بواسطة</TableHead>
                <TableHead className="text-center">العميل</TableHead>
                <TableHead className="text-center">المبلغ</TableHead>
                <TableHead className="text-center">طريقة الدفع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading && [...Array(5)].map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                    <TableCell><Skeleton className="h-5 w-40 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 mx-auto rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isInitialLoading && filteredTransactions.map((t) => (
                <TableRow key={t.id} className={t.orderId ? 'cursor-pointer hover:bg-muted' : ''}>
                  <TableCell className="text-center text-xs font-mono">{format(t.date, "d/M/yy, hh:mm a")}</TableCell>
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
                    className={`text-center font-mono font-semibold ${
                      t.amount < 0 ? 'text-red-500' : t.category === 'payment' ? 'text-green-600' : 'text-foreground'
                    }`}
                  >
                    {t.amount.toLocaleString()} ج.م
                  </TableCell>
                  <TableCell className="text-center">{t.method}</TableCell>
                </TableRow>
              ))}
              {!isInitialLoading && filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      لا توجد معاملات تطابق الفلاتر المحددة.
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

export default function FinancialLogPage() {
    return (
        <AppLayout>
            <FinancialLogPageContent />
        </AppLayout>
    );
}

