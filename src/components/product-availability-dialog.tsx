
'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, History, Info } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Product, Order } from '@/lib/definitions';
import { eachDayOfInterval, startOfDay, addDays, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type ProductAvailabilityDialogProps = {
  productId: string;
  trigger: React.ReactNode;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '-' : format(date, 'd MMMM yyyy', { locale: ar });
}

export function ProductAvailabilityDialog({ productId, trigger }: ProductAvailabilityDialogProps) {
  const { data: allProducts, isLoading: isLoadingProducts } = useRtdbList<Product>('products');
  const { data: allOrders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  
  const isLoading = isLoadingProducts || isLoadingOrders;

  const product = useMemo(() => allProducts.find(p => p.id === productId), [allProducts, productId]);

  const productOrders = useMemo(() => {
    if (!product) return [];
    return allOrders.filter(order => order.items.some(item => item.productId === product.id));
  }, [product, allOrders]);

  const bookedDates = useMemo(() => {
    if (!product || (product.category !== 'rental' && product.category !== 'both')) {
      return [];
    }
    
    const dates: Date[] = [];
    const rentalOrders = productOrders.filter(order => {
        const itemInOrder = order.items.find(i => i.productId === product.id);
        const itemType = itemInOrder?.itemTransactionType || order.transactionType;
        return itemType === 'Rental' && order.status !== 'Cancelled' && order.status !== 'Returned';
    });

    rentalOrders.forEach(order => {
        if (order.deliveryDate && order.returnDate) {
            try {
                const start = startOfDay(new Date(order.deliveryDate));
                const end = startOfDay(new Date(order.returnDate));
                if (start <= end) dates.push(...eachDayOfInterval({ start, end }));
            } catch (e) {}
        }
    });
    return dates;
  }, [productOrders, product]);

  const availabilityCalendar = useMemo(() => {
    if (!product) return [];
    const today = startOfDay(new Date());
    const rangeEnd = addDays(today, 60); // Show next 60 days
    const allDates = eachDayOfInterval({ start: today, end: rangeEnd });
    const bookedTimestamps = new Set(bookedDates.map(d => d.getTime()));

    return allDates.map(date => ({
        date,
        isBooked: bookedTimestamps.has(date.getTime())
    }));
  }, [bookedDates, product]);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            استعلام حجز المنتج: {product?.name}
          </DialogTitle>
          <DialogDescription>عرض جدول التوفر وسجل الحجوزات القادمة لهذا الصنف.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        ) : product ? (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-3 rounded-md bg-muted text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">المقاس</p>
                        <p className="font-bold">{product.size}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">الكود</p>
                        <p className="font-mono">{product.productCode}</p>
                    </div>
                    <div className="p-3 rounded-md bg-green-50 text-green-700 border border-green-100 text-center">
                        <p className="text-[10px] mb-1">المخزون الكلي</p>
                        <p className="font-bold">{product.quantityInStock}</p>
                    </div>
                    <div className="p-3 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-center">
                        <p className="text-[10px] mb-1">مؤجر حالياً</p>
                        <p className="font-bold">{product.quantityRented}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><CalendarIcon className="h-4 w-4" /> جدول التوفر (خلال شهرين)</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                        {availabilityCalendar.map(({ date, isBooked }) => (
                            <div key={date.toISOString()} className={cn(
                                "p-1.5 border rounded-sm text-center flex flex-col items-center justify-center",
                                isBooked ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"
                            )}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                                <span className="text-[8px] opacity-70">{format(date, 'MMM', { locale: ar })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><History className="h-4 w-4" /> سجل الحجوزات النشطة</h3>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right h-8 text-xs">كود الطلب</TableHead>
                                    <TableHead className="text-right h-8 text-xs">العميل</TableHead>
                                    <TableHead className="text-center h-8 text-xs">من تاريخ</TableHead>
                                    <TableHead className="text-center h-8 text-xs">إلى تاريخ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {productOrders.filter(o => o.status !== 'Cancelled' && o.status !== 'Returned').map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs text-right">{order.orderCode}</TableCell>
                                        <TableCell className="text-xs text-right truncate max-w-[100px]">{order.customerName}</TableCell>
                                        <TableCell className="text-[10px] text-center">{formatDate(order.deliveryDate)}</TableCell>
                                        <TableCell className="text-[10px] text-center">{formatDate(order.returnDate)}</TableCell>
                                    </TableRow>
                                ))}
                                {productOrders.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">لا توجد حجوزات مسجلة.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        ) : (
            <p className="text-center py-8 text-muted-foreground">تعذر جلب بيانات المنتج.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
