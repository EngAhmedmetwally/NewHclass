
'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, Order } from '@/lib/definitions';
import { TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { differenceInDays, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type ProductMovementInfo = {
  lastMoved?: Date;
  moveCount: number;
};

const getProductsMovementInfo = (products: Product[], orders: Order[]): Map<string, ProductMovementInfo> => {
  const movementMap = new Map<string, ProductMovementInfo>();

  // Initialize all products with 0 moves
  products.forEach(p => {
    movementMap.set(p.id, { moveCount: 0 });
  });
  
  // Sort orders to find the last date efficiently
  const sortedOrders = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  sortedOrders.forEach(order => {
    const orderDate = new Date(order.orderDate);
    order.items.forEach(item => {
      const info = movementMap.get(item.productId);
      if (info) {
        info.moveCount += item.quantity;
        // Since orders are sorted descending, the first date we find is the last movement date
        if (!info.lastMoved) {
          info.lastMoved = orderDate;
        }
      }
    });
  });

  return movementMap;
};

function StagnantProductsPageContent() {
    const [stagnantDaysThreshold, setStagnantDaysThreshold] = useState(90);
    const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
    const { data: orders, isLoading: loadingOrders } = useRtdbList<Order>('daily-entries');
    const isLoading = loadingProducts || loadingOrders;

    const productMovementInfo = useMemo(() => {
        if (isLoading) return new Map();
        return getProductsMovementInfo(products, orders);
    }, [products, orders, isLoading]);

    const stagnantProducts = useMemo(() => {
        const today = new Date();
        return products.map(product => {
            const movement = productMovementInfo.get(product.id) || { moveCount: 0 };
            const lastMovedDate = movement.lastMoved ? movement.lastMoved : (product.createdAt ? new Date(product.createdAt) : today);
            const daysSinceLastMove = differenceInDays(today, lastMovedDate);

            return {
                ...product,
                daysSinceLastMove,
                moveCount: movement.moveCount,
                lastMovedDate: movement.lastMoved
            };
        }).filter(p => p.daysSinceLastMove >= stagnantDaysThreshold)
          .sort((a, b) => b.daysSinceLastMove - a.daysSinceLastMove);
    }, [products, productMovementInfo, stagnantDaysThreshold]);

    const formatDate = (date?: Date) => {
        if (!date) return 'لا يوجد';
        return date.toLocaleDateString('ar-EG');
    };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير الأصناف الراكدة" showBackButton />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <CardTitle>الأصناف الراكدة</CardTitle>
          </div>
          <CardDescription>
            قائمة بالمنتجات التي لم يتم بيعها أو تأجيرها خلال فترة زمنية محددة.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="max-w-xs mb-6">
                <Label htmlFor="stagnant-days">عرض الأصناف التي لم تتحرك منذ (يوم)</Label>
                <Input
                    id="stagnant-days"
                    type="number"
                    value={stagnantDaysThreshold}
                    onChange={(e) => setStagnantDaysThreshold(Number(e.target.value))}
                    className="mt-2"
                />
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead className="text-center">آخر حركة منذ (يوم)</TableHead>
                <TableHead className="text-center">تاريخ آخر حركة</TableHead>
                <TableHead className="text-center">إجمالي الحركات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && stagnantProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                        {product.name} - {product.size}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-lg text-destructive">
                    {product.daysSinceLastMove}
                  </TableCell>
                   <TableCell className="text-center font-mono text-xs">
                    {formatDate(product.lastMovedDate)}
                  </TableCell>
                   <TableCell className="text-center font-mono">
                    {product.moveCount}
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && stagnantProducts.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        لا توجد أصناف راكدة تطابق المعايير المحددة.
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

export default function StagnantProductsPage() {
    return (
        <AppLayout>
            <StagnantProductsPageContent />
        </AppLayout>
    )
}
