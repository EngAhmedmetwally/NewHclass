
'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { Product, Order } from '@/lib/definitions';
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
import { BarChart3, TrendingUp, ShoppingCart, Repeat, Filter, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type ProductPerformanceData = {
  product: Product;
  rentalCount: number;
  rentalRevenue: number;
  salesCount: number;
  salesRevenue: number;
  totalRevenue: number;
  profit: number; // New field for profit
};

const calculateProductPerformance = (products: Product[], orders: Order[], fromDate?: Date, toDate?: Date): ProductPerformanceData[] => {
  const performanceMap = new Map<string, ProductPerformanceData>();

  products.forEach(product => {
    performanceMap.set(product.id, {
      product,
      rentalCount: 0,
      rentalRevenue: 0,
      salesCount: 0,
      salesRevenue: 0,
      totalRevenue: 0,
      profit: 0,
    });
  });

  const start = fromDate ? startOfDay(fromDate) : null;
  const end = toDate ? endOfDay(toDate) : null;
  
  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return (!start || orderDate >= start) && (!end || orderDate <= end);
  });


  filteredOrders.forEach(order => {
    order.items.forEach(item => {
      const perf = performanceMap.get(item.productId);
      if (perf) {
        const itemTotal = item.priceAtTimeOfOrder * item.quantity;
        const itemType = item.itemTransactionType || order.transactionType;

        if (itemType === 'Rental') {
          perf.rentalCount += item.quantity;
          perf.rentalRevenue += itemTotal;
        } else if (itemType === 'Sale') {
          perf.salesCount += item.quantity;
          perf.salesRevenue += itemTotal;
          // Calculate profit for sales
          const costPrice = perf.product.costPrice || (Number(perf.product.price) / 2); // Default cost if not set
          const itemProfit = (item.priceAtTimeOfOrder - costPrice) * item.quantity;
          perf.profit += itemProfit;
        }
        perf.totalRevenue += itemTotal;
      }
    });
  });

  return Array.from(performanceMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ج.م`;
};

const tickFormatter = (value: number) => value.toLocaleString();

const chartConfig = {
  totalRevenue: { label: "الإيرادات", color: "hsl(var(--chart-1))" },
  salesCount: { label: "المبيعات", color: "hsl(var(--chart-2))" },
  rentalCount: { label: "الإيجارات", color: "hsl(var(--chart-3))" },
};

function ProductPerformancePageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
  const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');
  const isLoading = loadingProducts || loadingOrders;

  const performanceData = useMemo(() => {
    if (isLoading) return [];
    return calculateProductPerformance(products, orders, fromDate, toDate);
  }, [products, orders, isLoading, fromDate, toDate]);
  
  const topByRevenue = useMemo(() => {
    if (isLoading) return [];
    return [...performanceData].sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0, 20).reverse();
  }, [performanceData, isLoading]);

  const topBySales = useMemo(() => {
    if (isLoading) return [];
    return [...performanceData].sort((a,b) => b.salesCount - a.salesCount).slice(0, 20).reverse();
  }, [performanceData, isLoading]);

  const topByRentals = useMemo(() => {
    if (isLoading) return [];
    return [...performanceData].sort((a,b) => b.rentalCount - a.rentalCount).slice(0, 20).reverse();
  }, [performanceData, isLoading]);


  const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
          {isLoading && [...Array(5)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>)}
          {!isLoading && performanceData.map(({ product, rentalCount, rentalRevenue, salesCount, salesRevenue, totalRevenue, profit }) => (
              <Card key={product.id}>
                  <CardHeader>
                      <CardTitle className="text-base">{product.name} - {product.size}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>عدد الإيجارات:</span> <span className="font-mono">{rentalCount}</span></div>
                      <div className="flex justify-between"><span>عدد المبيعات:</span> <span className="font-mono">{salesCount}</span></div>
                      <div className="flex justify-between"><span>إجمالي الإيرادات:</span> <span className="font-mono text-primary font-semibold">{formatCurrency(totalRevenue)}</span></div>
                      <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>إجمالي الربح (من البيع):</span> <span className="font-mono text-green-600">{formatCurrency(profit)}</span></div>
                  </CardContent>
              </Card>
          ))}
      </div>
  );

  const renderDesktopTable = () => (
      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>البيانات التفصيلية لأداء المنتجات</CardTitle>
          </div>
           <CardDescription>
            تحليل شامل لإيرادات وعدد حركات البيع والإيجار لكل منتج في النظام للفترة المحددة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-center">عدد الإيجارات</TableHead>
                <TableHead className="text-center">عدد المبيعات</TableHead>
                <TableHead className="text-center">إجمالي الإيرادات</TableHead>
                <TableHead className="text-center">الربح (من البيع)</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && performanceData.map(({ product, rentalCount, salesCount, totalRevenue, profit }) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-right">{product.name} - {product.size}</TableCell>
                  <TableCell className="text-center font-mono">{rentalCount}</TableCell>
                  <TableCell className="text-center font-mono">{salesCount}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(totalRevenue)}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-green-600">{formatCurrency(profit)}</TableCell>
                  <TableCell className="text-center">
                    <Link href={`/products/${product.id}`} passHref>
                        <Button variant="ghost" size="icon" title="عرض التفاصيل">
                            <Eye className="h-4 w-4"/>
                        </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && performanceData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      لا توجد بيانات لعرضها.
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
      <PageHeader title="تقرير أداء المنتجات" showBackButton />
      
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle>أعلى 20 منتج تحقيقًا للإيرادات</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="w-full h-[600px]" /> : (
                <ChartContainer config={chartConfig} className="w-full h-[600px]">
                    <BarChart data={topByRevenue} layout="vertical" margin={{ left: 10, right: 50 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="product.name" type="category" tickLine={false} axisLine={false} width={120} tick={{fontSize: 12}} />
                        <XAxis dataKey="totalRevenue" type="number" tickFormatter={tickFormatter} />
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="totalRevenue" fill="var(--color-totalRevenue)" radius={4}>
                            <LabelList dataKey="totalRevenue" position="right" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value.toLocaleString()} />
                        </Bar>
                    </BarChart>
                </ChartContainer>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    <CardTitle>أعلى 20 منتج مبيعًا (بالعدد)</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="w-full h-[600px]" /> : (
                 <ChartContainer config={chartConfig} className="w-full h-[600px]">
                    <BarChart data={topBySales} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="product.name" type="category" tickLine={false} axisLine={false} width={120} tick={{fontSize: 12}} />
                        <XAxis dataKey="salesCount" type="number" allowDecimals={false}/>
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="salesCount" name="عدد المبيعات" fill="var(--color-salesCount)" radius={4}>
                            <LabelList dataKey="salesCount" position="right" offset={8} className="fill-foreground text-xs" />
                        </Bar>
                    </BarChart>
                </ChartContainer>
                )}
            </CardContent>
        </Card>
         <Card className="lg:col-span-2">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    <CardTitle>أعلى 20 منتج إيجارًا (بالعدد)</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="w-full h-[600px]" /> : (
                 <ChartContainer config={chartConfig} className="w-full h-[600px]">
                    <BarChart data={topByRentals} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="product.name" type="category" tickLine={false} axisLine={false} width={120} tick={{fontSize: 12}}/>
                        <XAxis dataKey="rentalCount" type="number" allowDecimals={false} />
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="rentalCount" name="عدد الإيجارات" fill="var(--color-rentalCount)" radius={4}>
                            <LabelList dataKey="rentalCount" position="right" offset={8} className="fill-foreground text-xs" />
                        </Bar>
                    </BarChart>
                </ChartContainer>
                )}
            </CardContent>
        </Card>
      </div>

      {renderMobileCards()}
      {renderDesktopTable()}
      
    </div>
  );
}


export default function ProductPerformancePage() {
    return (
        <AppLayout>
            <ProductPerformancePageContent />
        </AppLayout>
    )
}
