
'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { Branch, Order } from '@/lib/definitions';
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
import { Landmark, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';

type BranchPerformanceData = {
  branch: Branch;
  orderCount: number;
  totalRevenue: number;
  rentalRevenue: number;
  salesRevenue: number;
};

const calculateBranchPerformance = (branches: Branch[], orders: Order[], fromDate?: Date, toDate?: Date): BranchPerformanceData[] => {
  const performanceMap = new Map<string, BranchPerformanceData>();

  branches.forEach(branch => {
    performanceMap.set(branch.id, {
      branch,
      orderCount: 0,
      totalRevenue: 0,
      rentalRevenue: 0,
      salesRevenue: 0,
    });
  });

  const start = fromDate ? startOfDay(fromDate) : null;
  const end = toDate ? endOfDay(toDate) : null;

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return (!start || orderDate >= start) && (!end || orderDate <= end);
  });

  filteredOrders.forEach(order => {
    const perf = performanceMap.get(order.branchId);
    if (perf) {
      perf.orderCount++;
      const orderTotal = order.total || 0; // Use the final total which includes discounts
      perf.totalRevenue += orderTotal;

      if (order.transactionType === 'Rental') {
        perf.rentalRevenue += orderTotal;
      } else if (order.transactionType === 'Sale') {
        perf.salesRevenue += orderTotal;
      }
    }
  });

  return Array.from(performanceMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

const chartConfig = {
  totalRevenue: { label: "الإيرادات", color: "hsl(var(--chart-1))" },
};

function BranchSummaryPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const { data: branches, isLoading: loadingBranches } = useRtdbList<Branch>('branches');
  const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');

  const isLoading = loadingBranches || loadingOrders;
  
  const performanceData = useMemo(() => {
      if (isLoading) return [];
      return calculateBranchPerformance(branches, orders, fromDate, toDate);
  }, [branches, orders, fromDate, toDate, isLoading]);

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ج.م`;
  };
  
  const tickFormatter = (value: number) => value.toLocaleString();

  const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
          {isLoading && [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>)}
          {!isLoading && performanceData.map(({ branch, orderCount, rentalRevenue, salesRevenue, totalRevenue }) => (
              <Card key={branch.id}>
                  <CardHeader>
                      <CardTitle>{branch.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>عدد الطلبات:</span> <span className="font-mono">{orderCount}</span></div>
                      <div className="flex justify-between"><span>إيرادات الإيجار:</span> <span className="font-mono">{formatCurrency(rentalRevenue)}</span></div>
                      <div className="flex justify-between"><span>إيرادات البيع:</span> <span className="font-mono">{formatCurrency(salesRevenue)}</span></div>
                      <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>إجمالي الإيرادات:</span> <span className="font-mono text-primary">{formatCurrency(totalRevenue)}</span></div>
                  </CardContent>
              </Card>
          ))}
      </div>
  );

  const renderDesktopTable = () => (
      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            <CardTitle>البيانات التفصيلية للفروع</CardTitle>
          </div>
          <CardDescription>
            تحليل شامل لعدد الطلبات وإجمالي الإيرادات لكل فرع.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الفرع</TableHead>
                <TableHead className="text-center">عدد الطلبات</TableHead>
                <TableHead className="text-center">إيرادات الإيجار</TableHead>
                <TableHead className="text-center">إيرادات البيع</TableHead>
                <TableHead className="text-center">إجمالي الإيرادات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && performanceData.map(({ branch, orderCount, rentalRevenue, salesRevenue, totalRevenue }) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium text-right">{branch.name}</TableCell>
                  <TableCell className="text-center font-mono">{orderCount}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(rentalRevenue)}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(salesRevenue)}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(totalRevenue)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && performanceData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    لا توجد بيانات لعرضها في هذه الفترة.
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
      <PageHeader title="تقرير ملخصات الفروع" showBackButton />
      
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            <CardTitle>مقارنة إيرادات الفروع</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <ChartContainer config={chartConfig} className="w-full h-[300px]">
              <BarChart data={performanceData} margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="branch.name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={tickFormatter} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="totalRevenue" fill="var(--color-totalRevenue)" radius={4}>
                  <LabelList dataKey="totalRevenue" position="top" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value.toLocaleString()} />
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

export default function BranchSummaryPage() {
    return (
        <AppLayout>
            <BranchSummaryPageContent />
        </AppLayout>
    )
}
