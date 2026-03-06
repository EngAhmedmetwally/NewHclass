'use client';

import {
  CircleDollarSign,
  Package,
  ShoppingCart,
  Users,
  ClipboardList,
  Wallet,
  Hash,
  Filter,
  ArrowDown,
  ArrowUp,
  ShieldAlert,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

import { PageHeader } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Customer, Product, Counter, Expense, Branch } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/firebase';
import { AuthLayout } from '@/components/app-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { usePermissions } from '@/hooks/use-permissions';

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Completed':
            return <Badge className="bg-green-500 text-white">مكتمل</Badge>;
        case 'Delivered to Customer':
            return <Badge className="bg-blue-500 text-white">تم التسليم</Badge>;
        case 'Ready for Pickup':
            return <Badge variant="secondary">جاهز للتسليم</Badge>;
        case 'Pending':
            return <Badge variant="destructive">قيد التجهيز</Badge>;
        case 'Returned from Tailor':
            return <Badge className="bg-purple-500 text-white">عند الخياط</Badge>;
        case 'Returned':
            return <Badge className="bg-green-100 text-green-800">تم الإرجاع</Badge>;
        case 'Cancelled':
            return <Badge variant="destructive">ملغي</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

function DashboardPageContent() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const { data: allOrders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: customers, isLoading: isLoadingCustomers } = useRtdbList<Customer>('customers');
  const { data: products, isLoading: isLoadingProducts } = useRtdbList<Product>('products');
  const { data: allExpenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
  const { data: counters, isLoading: isLoadingCounters } = useRtdbList<Counter>('counters');

  const { appUser } = useUser();
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['dashboard:view'] as const);

  // Apply user's branch restriction
  useEffect(() => {
    if (appUser && appUser.branchId !== 'all') {
      setBranchFilter(appUser.branchId || 'all');
    }
  }, [appUser]);

  const isLoading = isLoadingOrders || isLoadingCustomers || isLoadingProducts || isLoadingExpenses || isLoadingBranches || isLoadingCounters || isLoadingPermissions;

  const dashboardData = useMemo(() => {
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    // Filter orders by date and branch
    const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
        const branchMatch = branchFilter === 'all' || order.branchId === branchFilter;
        return dateMatch && branchMatch;
    });

    // Filter expenses by date and branch
    const filteredExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const dateMatch = (!start || expenseDate >= start) && (!end || expenseDate <= end);
        const branchMatch = branchFilter === 'all' || expense.branchId === branchFilter;
        return dateMatch && branchMatch;
    });

    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const recentOrders = [...filteredOrders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 4);

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      totalExpenses,
      netProfit,
      recentOrders,
    }
  }, [allOrders, allExpenses, customers, products, branchFilter, fromDate, toDate]);
  
  if (!isLoading && !permissions.canDashboardView) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="غير مصرح" showBackButton />
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 min-h-[60vh]">
                <div className="flex flex-col items-center gap-1 text-center">
                    <ShieldAlert className="h-12 w-12 text-destructive"/>
                    <h3 className="text-2xl font-bold tracking-tight">غير مصرح لك</h3>
                    <p className="text-sm text-muted-foreground">
                        ليس لديك الصلاحية لعرض لوحة التحكم.
                    </p>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="لوحة التحكم" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
            </div>
            <CardDescription>
                اختر الفرع والفترة الزمنية لعرض البيانات.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
             <div className="flex flex-col gap-2">
                <Label>الفرع</Label>
                 <Select value={branchFilter} onValueChange={setBranchFilter} disabled={isLoadingBranches || (!!appUser?.branchId && appUser.branchId !== 'all')}>
                    <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الفروع</SelectItem>
                        {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                <Label>من تاريخ</Label>
                 <DatePickerDialog
                    value={fromDate}
                    onValueChange={setFromDate}
                 />
            </div>
             <div className="flex flex-col gap-2">
                <Label>إلى تاريخ</Label>
                 <DatePickerDialog
                    value={toDate}
                    onValueChange={setToDate}
                    fromDate={fromDate}
                 />
            </div>
        </CardContent>
      </Card>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4 mt-1" /> : (
              <div className="text-2xl font-bold font-mono">{dashboardData.totalRevenue.toLocaleString()} ج.م</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle>
            <ArrowDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2 mt-1" /> : (
                <div className="text-2xl font-bold font-mono text-destructive">{dashboardData.totalExpenses.toLocaleString()} ج.م</div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2 mt-1" /> : (
                <div className={cn("text-2xl font-bold font-mono", dashboardData.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {dashboardData.netProfit.toLocaleString()} ج.م
                </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2 mt-1" /> : (
                <div className="text-2xl font-bold font-mono">{dashboardData.totalOrders}</div>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    النشاط الأخير
                </CardTitle>
                 <CardDescription>
                    آخر الطلبات في الفترة المحددة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">كود الطلب</TableHead>
                            <TableHead className="text-right">العميل</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && [...Array(4)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell className="flex justify-center"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          </TableRow>
                        ))}
                        {!isLoading && dashboardData.recentOrders.map(order => (
                            <TableRow key={order.id}>
                                <TableCell className="font-mono text-right">
                                    <OrderDetailsDialog orderId={order.id}>
                                      <span className="hover:underline cursor-pointer">{order.orderCode}</span>
                                    </OrderDetailsDialog>
                                </TableCell>
                                <TableCell className="text-right">{order.customerName}</TableCell>
                                <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                            </TableRow>
                        ))}
                         {!isLoading && dashboardData.recentOrders.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">لا توجد طلبات في هذه الفترة.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    الملخص الإجمالي (ثابت)
                </CardTitle>
                <CardDescription>
                    نظرة سريعة على إجمالي الأرقام المسجلة في النظام بالكامل.
                </CardDescription>
            </CardHeader>
             <CardContent>
                 <div className="grid md:grid-cols-2 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                        {isLoading ? <Skeleton className="h-8 w-20 mx-auto mt-1" /> : <p className="text-2xl font-bold font-mono">{dashboardData.totalProducts}</p>}
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                        {isLoading ? <Skeleton className="h-8 w-20 mx-auto mt-1" /> : <p className="text-2xl font-bold font-mono">{dashboardData.totalCustomers}</p>}
                    </div>
                 </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
    return (
        <AuthLayout>
            <DashboardPageContent />
        </AuthLayout>
    )
}
