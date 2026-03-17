
'use client';

import React, { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import type { User, Order, Branch, SaleReturn } from '@/lib/definitions';
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
import { UserCheck, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { Label } from '@/components/ui/label';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/firebase';


type SellerPerformanceData = {
  seller: User;
  orderCount: number;
  totalRevenue: number;
  rentalRevenue: number;
  salesRevenue: number;
  returnAmount: number;
};

const calculateSellerPerformance = (
    users: User[], 
    orders: Order[], 
    saleReturns: SaleReturn[],
    fromDate?: Date, 
    toDate?: Date,
    branchId?: string,
): SellerPerformanceData[] => {
  const performanceMap = new Map<string, SellerPerformanceData>();
  
  // Map orderId to original order for quick lookup during returns processing
  const orderMap = new Map<string, Order>();
  orders.forEach(o => orderMap.set(o.id, o));

  // Include all users who are active
  users
    .filter(user => user.isActive)
    .forEach(seller => {
      performanceMap.set(seller.id, {
        seller,
        orderCount: 0,
        totalRevenue: 0,
        rentalRevenue: 0,
        salesRevenue: 0,
        returnAmount: 0,
      });
    });
  
  const start = fromDate ? startOfDay(fromDate) : null;
  const end = toDate ? endOfDay(toDate) : null;

  // 1. Process Sales and Rentals
  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
    const branchMatch = !branchId || branchId === 'all' || order.branchId === branchId;
    return dateMatch && branchMatch;
  });

  filteredOrders.forEach(order => {
    if (!order.sellerId) return;
    const perf = performanceMap.get(order.sellerId);
    if (perf) {
      perf.orderCount++;
      const orderTotal = order.total || 0;
      perf.totalRevenue += orderTotal;

      if (order.transactionType === 'Rental') {
        perf.rentalRevenue += orderTotal;
      } else if (order.transactionType === 'Sale') {
        perf.salesRevenue += orderTotal;
      }
    }
  });

  // 2. Process Returns (Subtract from original seller's performance)
  const filteredReturns = saleReturns.filter(sr => {
    const returnDate = new Date(sr.createdAt || sr.returnDate);
    const dateMatch = (!start || returnDate >= start) && (!end || returnDate <= end);
    
    // We check the branch of the original order to match the branch filter
    const originalOrder = orderMap.get(sr.orderId);
    const branchMatch = !branchId || branchId === 'all' || (originalOrder && originalOrder.branchId === branchId);
    
    return dateMatch && branchMatch;
  });

  filteredReturns.forEach(sr => {
    const originalOrder = orderMap.get(sr.orderId);
    if (originalOrder && originalOrder.sellerId) {
        const perf = performanceMap.get(originalOrder.sellerId);
        if (perf) {
            const refund = sr.refundAmount || 0;
            perf.totalRevenue -= refund;
            perf.salesRevenue -= refund;
            perf.returnAmount += refund;
        }
    }
  });

  return Array.from(performanceMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

const chartConfig = {
  totalRevenue: { label: "صافي الإيرادات", color: "hsl(var(--chart-1))" },
};

function SellerPerformancePageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [branchFilter, setBranchFilter] = useState('all');
  
  const { appUser } = useUser();
  const { data: users, isLoading: loadingUsers } = useRtdbList<User>('users');
  const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: branches, isLoading: loadingBranches } = useRtdbList<Branch>('branches');
  const { data: saleReturns, isLoading: loadingReturns } = useRtdbList<SaleReturn>('saleReturns');

  const isLoading = loadingUsers || loadingOrders || loadingBranches || loadingReturns;

  const performanceData = useMemo(() => {
      if (isLoading) return [];
      return calculateSellerPerformance(users, orders, saleReturns, fromDate, toDate, branchFilter);
  }, [users, orders, saleReturns, isLoading, fromDate, toDate, branchFilter]);
  
  const chartData = useMemo(() => {
      if (isLoading) return [];
      // Show all sellers who have any activity (sales or returns), sorted by net revenue
      return [...performanceData]
        .filter(p => p.orderCount > 0 || p.returnAmount > 0)
        .sort((a,b) => b.totalRevenue - a.totalRevenue)
        .reverse();
  }, [performanceData, isLoading]);

  const formatCurrency = (amount: number) => {
    return `${Math.round(amount).toLocaleString()} ج.م`;
  };

  const tickFormatter = (value: number) => Math.round(value).toLocaleString();

  const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
          {isLoading && [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>)}
          {!isLoading && performanceData.filter(p => p.orderCount > 0 || p.returnAmount > 0).map(({ seller, orderCount, rentalRevenue, salesRevenue, totalRevenue, returnAmount }) => (
              <Card key={seller.id}>
                  <CardHeader>
                      <CardTitle className="text-base">{seller.fullName}</CardTitle>
                      <CardDescription>دور الوظيفة: {seller.role === 'admin' ? 'مدير' : seller.role === 'cashier' ? 'كاشير' : 'بائع'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>عدد الطلبات:</span> <span className="font-mono">{orderCount}</span></div>
                      <div className="flex justify-between"><span>إيرادات الإيجار:</span> <span className="font-mono">{formatCurrency(rentalRevenue)}</span></div>
                      <div className="flex justify-between"><span>إيرادات البيع:</span> <span className="font-mono">{formatCurrency(salesRevenue + returnAmount)}</span></div>
                      {returnAmount > 0 && <div className="flex justify-between text-destructive"><span>إجمالي المرتجعات:</span> <span className="font-mono">-{formatCurrency(returnAmount)}</span></div>}
                      <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>صافي الإيرادات:</span> <span className="font-mono text-primary">{formatCurrency(totalRevenue)}</span></div>
                  </CardContent>
              </Card>
          ))}
      </div>
  );

  const renderDesktopTable = () => (
      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <CardTitle>البيانات التفصيلية لأداء الموظفين (صافي المبيعات)</CardTitle>
          </div>
          <CardDescription>
            تحليل شامل لعدد الطلبات وصافي الإيرادات المحققة (المبيعات + الإيجارات - المرتجعات) لكل موظف.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الموظف</TableHead>
                <TableHead className="text-center">الدور</TableHead>
                <TableHead className="text-center">عدد الطلبات</TableHead>
                <TableHead className="text-center">إجمالي المبيعات</TableHead>
                <TableHead className="text-center">إجمالي المرتجعات</TableHead>
                <TableHead className="text-center">إيرادات الإيجار</TableHead>
                <TableHead className="text-center">صافي الإيرادات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && performanceData.filter(p => p.orderCount > 0 || p.returnAmount > 0).map(({ seller, orderCount, rentalRevenue, salesRevenue, totalRevenue, returnAmount }) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium text-right">{seller.fullName}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{seller.role === 'admin' ? 'مدير' : seller.role === 'cashier' ? 'كاشير' : 'بائع'}</TableCell>
                  <TableCell className="text-center font-mono">{orderCount}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(salesRevenue + returnAmount)}</TableCell>
                  <TableCell className="text-center font-mono text-destructive">-{formatCurrency(returnAmount)}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(rentalRevenue)}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(totalRevenue)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && performanceData.filter(p => p.orderCount > 0 || p.returnAmount > 0).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                    لا توجد بيانات مبيعات لعرضها في هذه الفترة.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير أداء الموظفين" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="flex flex-col gap-2">
                <Label>الفرع</Label>
                 <Select value={branchFilter} onValueChange={setBranchFilter} disabled={loadingBranches || (!!appUser?.branchId && appUser.branchId !== 'all')}>
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
        </CardContent>
      </Card>

       <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    <CardTitle>مقارنة صافي إيرادات الموظفين</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="w-full h-[400px]" /> : chartData.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">لا توجد بيانات للرسم البياني.</div>
                ) : (
                <ChartContainer config={chartConfig} className="w-full" style={{ height: `${Math.max(400, chartData.length * 45)}px`}}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="seller.fullName" type="category" tickLine={false} axisLine={false} width={100} tick={{fontSize: 11}} />
                        <XAxis dataKey="totalRevenue" type="number" tickFormatter={tickFormatter} />
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="totalRevenue" fill="var(--color-totalRevenue)" radius={4}>
                            <LabelList dataKey="totalRevenue" position="right" offset={8} className="fill-foreground text-[10px]" formatter={(value: number) => value.toLocaleString()} />
                        </Bar>
                    </BarChart>
                </ChartContainer>
                )}
            </CardContent>
        </Card>
        
        {renderMobileCards()}
        {renderDesktopTable()}

    </div>
  );
}

export default function SellerPerformancePage() {
    return (
        <AppLayout>
            <SellerPerformancePageContent />
        </AppLayout>
    )
}
