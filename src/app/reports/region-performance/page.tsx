'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, MapPin, TrendingUp, ShoppingCart, Repeat, CircleDollarSign } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Product, Region } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

type RegionStats = {
    id: string;
    name: string;
    salesCount: number;
    rentalsCount: number;
    totalOrders: number;
    grossRevenue: number;
    totalCost: number;
    profit: number;
};

function RegionPerformanceReportPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const { data: regions, isLoading: isLoadingRegions } = useRtdbList<Region>('regions');
  const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: products } = useRtdbList<Product>('products');

  const isLoading = isLoadingRegions || isLoadingOrders;

  const performanceData = useMemo(() => {
    if (isLoading) return [];

    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    const statsMap: Record<string, RegionStats> = {};

    // Initialize stats for all regions
    regions.forEach(r => {
        statsMap[r.id] = {
            id: r.id,
            name: r.name,
            salesCount: 0,
            rentalsCount: 0,
            totalOrders: 0,
            grossRevenue: 0,
            totalCost: 0,
            profit: 0
        };
    });

    // Stats for "Unspecified" region
    const unspecifiedId = 'unspecified';
    statsMap[unspecifiedId] = {
        id: unspecifiedId,
        name: 'غير محدد',
        salesCount: 0,
        rentalsCount: 0,
        totalOrders: 0,
        grossRevenue: 0,
        totalCost: 0,
        profit: 0
    };

    orders.forEach(order => {
        if (order.status === 'Cancelled') return;

        const orderDate = new Date(order.orderDate);
        if ((start && orderDate < start) || (end && orderDate > end)) return;

        const rId = order.regionId || unspecifiedId;
        const stats = statsMap[rId];
        
        if (stats) {
            stats.totalOrders++;
            stats.grossRevenue += (order.total || 0);

            if (order.transactionType === 'Sale') {
                stats.salesCount++;
            } else if (order.transactionType === 'Rental') {
                stats.rentalsCount++;
            }

            // Calculate cost and profit for items in this order
            order.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                const costPrice = product?.costPrice || 0;
                const itemTotalCost = costPrice * item.quantity;
                
                stats.totalCost += itemTotalCost;
            });
        }
    });

    // Profit = Gross Revenue - Total Cost (of items sold/rented)
    // Note: For rentals, usually cost is depreciated, but here we'll use simple revenue - itemCost if available
    Object.values(statsMap).forEach(s => {
        s.profit = s.grossRevenue - s.totalCost;
    });

    return Object.values(statsMap)
        .filter(s => s.totalOrders > 0 || s.id !== unspecifiedId)
        .sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [regions, orders, products, isLoading, fromDate, toDate]);

  const totals = useMemo(() => {
      return performanceData.reduce((acc, s) => ({
          orders: acc.orders + s.totalOrders,
          revenue: acc.revenue + s.grossRevenue,
          profit: acc.profit + s.profit
      }), { orders: 0, revenue: 0, profit: 0 });
  }, [performanceData]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير أداء المناطق" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-muted/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    إجمالي الطلبات
                </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono">{totals.orders}</div></CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                    إجمالي الإيرادات
                </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono text-green-600">{totals.revenue.toLocaleString()} ج.م</div></CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    إجمالي الربح (تقديري)
                </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono text-primary">{totals.profit.toLocaleString()} ج.م</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تحليل المناطق</CardTitle>
          <CardDescription>أداء كل منطقة من حيث عدد العمليات والأرباح خلال الفترة المحددة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-center">طلبات البيع</TableHead>
                <TableHead className="text-center">طلبات الإيجار</TableHead>
                <TableHead className="text-center">إجمالي الطلبات</TableHead>
                <TableHead className="text-center">إجمالي الإيرادات</TableHead>
                <TableHead className="text-center">صافي الربح</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton className="h-8 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : performanceData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">لا توجد بيانات لهذه الفترة.</TableCell>
                </TableRow>
              ) : (
                performanceData.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold text-right">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {s.name}
                        </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">{s.salesCount}</TableCell>
                    <TableCell className="text-center font-mono">{s.rentalsCount}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{s.totalOrders}</TableCell>
                    <TableCell className="text-center font-mono text-green-600">{s.grossRevenue.toLocaleString()} ج.م</TableCell>
                    <TableCell className="text-center font-mono font-bold text-primary">{s.profit.toLocaleString()} ج.م</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegionPerformanceReportPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <RegionPerformanceReportPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
