'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Filter, ArrowUpRight, ArrowDownRight, CircleDollarSign, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { cn } from '@/lib/utils';

type DeviationEntry = {
    orderId: string;
    orderCode: string;
    orderDate: string;
    customerName: string;
    productName: string;
    originalPrice: number;
    actualPrice: number;
    difference: number;
    type: 'increase' | 'reduction';
    quantity: number;
    totalDifference: number;
};

function PriceDeviationsPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [typeFilter, setTypeFilter] = useState<'all' | 'reduction' | 'increase'>('all');

  const { data: orders, isLoading } = useRtdbList<Order>('daily-entries');

  const deviations = useMemo((): DeviationEntry[] => {
    if (isLoading) return [];

    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    const entries: DeviationEntry[] = [];

    orders.forEach(order => {
        const orderDate = new Date(order.orderDate);
        if ((start && orderDate < start) || (end && orderDate > end)) return;

        order.items.forEach(item => {
            // Compare priceAtTimeOfOrder with originalPrice
            const actual = item.priceAtTimeOfOrder;
            const original = item.originalPrice;

            if (original !== undefined && actual !== original) {
                const diff = actual - original;
                const type = diff > 0 ? 'increase' : 'reduction';
                
                if (typeFilter !== 'all' && typeFilter !== type) return;

                entries.push({
                    orderId: order.id,
                    orderCode: order.orderCode,
                    orderDate: order.orderDate,
                    customerName: order.customerName,
                    productName: item.productName,
                    originalPrice: original,
                    actualPrice: actual,
                    difference: diff,
                    type: type,
                    quantity: item.quantity,
                    totalDifference: diff * item.quantity,
                });
            }
        });
    });

    return entries.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, isLoading, fromDate, toDate, typeFilter]);

  const stats = useMemo(() => {
      const reductions = deviations.filter(d => d.type === 'reduction').reduce((sum, d) => sum + Math.abs(d.totalDifference), 0);
      const increases = deviations.filter(d => d.type === 'increase').reduce((sum, d) => sum + d.totalDifference, 0);
      return { reductions, increases };
  }, [deviations]);

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} ج.م`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير انحراف الأسعار" showBackButton />

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
            <div className="flex flex-col gap-2">
                <Label>نوع الانحراف</Label>
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="reduction">تخفيضات فقط</SelectItem>
                        <SelectItem value="increase">زيادات فقط</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    إجمالي التخفيضات (فرق السعر)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono text-destructive">
                    -{formatCurrency(stats.reductions)}
                </div>
            </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    إجمالي الزيادات (إيراد إضافي)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono text-green-600">
                    +{formatCurrency(stats.increases)}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل انحرافات الأسعار</CardTitle>
          <CardDescription>عرض تفصيلي لكل صنف تم بيعه بسعر يختلف عن سعر الكتالوج.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-center">السعر الأصلي</TableHead>
                <TableHead className="text-center">السعر الفعلي</TableHead>
                <TableHead className="text-center">الفرق (للقطعة)</TableHead>
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead className="text-center">إجمالي الفرق</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : deviations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    لا توجد بيانات انحراف أسعار في هذه الفترة.
                  </TableCell>
                </TableRow>
              ) : (
                deviations.map((d, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-right">{d.orderCode}</TableCell>
                    <TableCell className="text-right max-w-[200px] truncate">{d.productName}</TableCell>
                    <TableCell className="text-center font-mono">{formatCurrency(d.originalPrice)}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{formatCurrency(d.actualPrice)}</TableCell>
                    <TableCell className={cn("text-center font-mono", d.difference > 0 ? "text-green-600" : "text-destructive")}>
                        {d.difference > 0 ? `+${d.difference.toLocaleString()}` : d.difference.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">{d.quantity}</TableCell>
                    <TableCell className={cn("text-center font-mono font-bold", d.totalDifference > 0 ? "text-green-600" : "text-destructive")}>
                        {d.totalDifference > 0 ? `+${d.totalDifference.toLocaleString()}` : d.totalDifference.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                        {d.type === 'increase' ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">زيادة</Badge>
                        ) : (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/20">تخفيض</Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderDetailsDialog orderId={d.orderId}>
                            <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                            </Button>
                        </OrderDetailsDialog>
                    </TableCell>
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

export default function PriceDeviationsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <PriceDeviationsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}