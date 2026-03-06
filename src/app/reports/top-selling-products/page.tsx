
'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, Order } from '@/lib/definitions';
import { TrendingUp, Filter } from 'lucide-react';
import Link from 'next/link';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { useState, useMemo } from 'react';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { Label } from '@/components/ui/label';

type ProductCount = {
  productId: string;
  name: string;
  size: string;
  productCode: string;
  count: number;
};

const getTopSellingProducts = (products: Product[], orders: Order[], fromDate?: Date, toDate?: Date): ProductCount[] => {
  const salesCounts = new Map<string, number>();

  const start = fromDate ? startOfDay(fromDate) : null;
  const end = toDate ? endOfDay(toDate) : null;

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    const isSale = order.transactionType === 'Sale';
    const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
    return isSale && dateMatch;
  });

  filteredOrders.forEach(order => {
    order.items.forEach(item => {
      salesCounts.set(item.productId, (salesCounts.get(item.productId) || 0) + item.quantity);
    });
  });

  return Array.from(salesCounts.entries())
    .map(([productId, count]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        name: product?.name || 'منتج محذوف',
        size: product?.size || '-',
        productCode: product?.productCode || '-',
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
};

function TopSellingProductsPageContent() {
    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());

    const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
    const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');
    const isLoading = loadingProducts || loadingOrders;

    const topProducts = useMemo(() => {
        if (isLoading) return [];
        return getTopSellingProducts(products, orders, fromDate, toDate);
    }, [products, orders, isLoading, fromDate, toDate]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير الأصناف الأكثر مبيعًا" showBackButton />

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
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>الأصناف الأكثر مبيعًا</CardTitle>
          </div>
          <CardDescription>
            قائمة بالمنتجات مرتبة تنازليًا حسب عدد مرات البيع في الفترة المحددة.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead className="text-center">كود المنتج</TableHead>
                <TableHead className="text-center">عدد مرات البيع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && topProducts.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell>
                    <Link href={`/products/${product.productId}`} className="font-medium hover:underline">
                        {product.name} - {product.size}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center font-mono">{product.productCode}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-lg text-primary">{product.count}</TableCell>
                </TableRow>
              ))}
               {!isLoading && topProducts.length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        لم يتم تسجيل أي مبيعات في هذه الفترة.
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

export default function TopSellingProductsPage() {
    return (
        <AppLayout>
            <TopSellingProductsPageContent />
        </AppLayout>
    )
}
