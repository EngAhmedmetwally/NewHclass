
'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, Order } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';


interface CategoryPerformance {
    name: string;
    salesRevenue: number;
    rentalRevenue: number;
    totalRevenue: number;
    salesCount: number;
    rentalCount: number;
    totalCount: number;
}

const calculateCategoryPerformance = (products: Product[], orders: Order[], fromDate?: Date, toDate?: Date): CategoryPerformance[] => {
    const performanceMap = new Map<string, CategoryPerformance>();

    // Initialize map with all product groups
    products.forEach(product => {
        const groupName = product.group || 'بدون مجموعة';
        if (!performanceMap.has(groupName)) {
            performanceMap.set(groupName, {
                name: groupName,
                salesRevenue: 0,
                rentalRevenue: 0,
                totalRevenue: 0,
                salesCount: 0,
                rentalCount: 0,
                totalCount: 0,
            });
        }
    });

    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return (!start || orderDate >= start) && (!end || orderDate <= end);
    });

    // Process orders
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const groupName = product.group || 'بدون مجموعة';
                const perf = performanceMap.get(groupName);
                if (perf) {
                    const itemRevenue = item.priceAtTimeOfOrder * item.quantity;
                    perf.totalRevenue += itemRevenue;
                    perf.totalCount += item.quantity;

                    if (order.transactionType === 'Sale') {
                        perf.salesRevenue += itemRevenue;
                        perf.salesCount += item.quantity;
                    } else if (order.transactionType === 'Rental') {
                        perf.rentalRevenue += itemRevenue;
                        perf.rentalCount += item.quantity;
                    }
                }
            }
        });
    });

    return Array.from(performanceMap.values()).sort((a,b) => b.totalRevenue - a.totalRevenue);
};

const chartConfig = {
  salesRevenue: { label: "إيرادات البيع", color: "hsl(var(--chart-2))" },
  rentalRevenue: { label: "إيرادات الإيجار", color: "hsl(var(--chart-3))" },
};

function SalesByCategoryPageContent() {
    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());

    const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
    const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');
    const isLoading = loadingProducts || loadingOrders;

    const performanceData = useMemo(() => isLoading ? [] : calculateCategoryPerformance(products, orders, fromDate, toDate), [products, orders, isLoading, fromDate, toDate]);
    const formatCurrency = (amount: number) => `${amount.toLocaleString()} ج.م`;
    const tickFormatter = (value: number) => value.toLocaleString();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير المبيعات حسب الفئة" showBackButton />

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
            <ShoppingCart className="h-5 w-5 text-primary" />
            <CardTitle>الإيرادات حسب فئة المنتج</CardTitle>
          </div>
          <CardDescription>
            تحليل إيرادات وأعداد الحركات لكل فئة من فئات المنتجات في الفترة المحددة.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {isLoading ? <Skeleton className="w-full h-[400px]" /> : (
          <ChartContainer config={chartConfig} className="w-full h-[400px]">
             <BarChart data={performanceData} margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={80} interval={0} />
              <YAxis tickFormatter={tickFormatter} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent indicator="dot" />} />
              <Legend />
              <Bar dataKey="salesRevenue" stackId="a" fill="var(--color-salesRevenue)" name="إيرادات البيع" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rentalRevenue" stackId="a" fill="var(--color-rentalRevenue)" name="إيرادات الإيجار" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
          )}
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>الفئة</TableHead>
                    <TableHead className="text-center">عدد المبيعات</TableHead>
                    <TableHead className="text-center">إيرادات المبيعات</TableHead>
                    <TableHead className="text-center">عدد الإيجارات</TableHead>
                    <TableHead className="text-center">إيرادات الإيجارات</TableHead>
                    <TableHead className="text-center">إجمالي الإيرادات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                    </TableRow>
                ))}
                {!isLoading && performanceData.map(p => (
                    <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-center font-mono">{p.salesCount}</TableCell>
                        <TableCell className="text-center font-mono">{formatCurrency(p.salesRevenue)}</TableCell>
                        <TableCell className="text-center font-mono">{p.rentalCount}</TableCell>
                        <TableCell className="text-center font-mono">{formatCurrency(p.rentalRevenue)}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(p.totalRevenue)}</TableCell>
                    </TableRow>
                ))}
                 {!isLoading && performanceData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                           لا توجد بيانات لعرضها.
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

export default function SalesByCategoryPage() {
    return (
        <AppLayout>
            <SalesByCategoryPageContent />
        </AppLayout>
    )
}
