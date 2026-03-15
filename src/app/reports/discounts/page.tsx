
'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { Order } from '@/lib/definitions';
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
import { BadgePercent, Filter, TrendingDown, Eye } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';

function DiscountsReportPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const { appUser } = useUser();
  const { data: allOrders, isLoading } = useRtdbList<Order>('daily-entries');

  const filteredData = useMemo(() => {
    if (isLoading || !appUser) return { discountEntries: [], totalDiscount: 0 };
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    const entries = allOrders
        .filter(order => {
            // Only orders with discounts
            if (!order.discountAmount || order.discountAmount <= 0) return false;
            
            // Ignore cancelled orders unless specifically needed
            if (order.status === 'Cancelled') return false;

            const discountDate = new Date(order.discountAppliedDate || order.orderDate);
            const dateMatch = (!start || discountDate >= start) && (!end || discountDate <= end);
            
            // Branch filtering based on user permissions
            let branchMatch = true;
            if (appUser.branchId && appUser.branchId !== 'all' && !appUser.permissions.includes('all')) {
                branchMatch = order.branchId === appUser.branchId;
            }

            return dateMatch && branchMatch;
        })
        .map(order => ({
            id: order.id,
            orderCode: order.orderCode,
            customerName: order.customerName,
            date: order.discountAppliedDate || order.orderDate,
            amount: order.discountAmount || 0,
            orderTotal: (order.total || 0) + (order.discountAmount || 0),
            appliedBy: order.processedByUserName || order.sellerName || 'نظام',
            branchName: order.branchName
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totalDiscount = entries.reduce((sum, entry) => sum + entry.amount, 0);

    return { discountEntries: entries, totalDiscount };
  }, [allOrders, isLoading, fromDate, toDate, appUser]);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return format(date, "d MMMM yyyy, h:mm a", { locale: ar });
    } catch (e) {
        return dateString;
    }
  }

  const formatCurrency = (amount: number) => {
    return `${Math.round(amount).toLocaleString()} ج.م`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير الخصومات المطبقة" showBackButton />
      
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
      
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-destructive/5 border-destructive/20 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-sm font-medium">إجمالي الخصومات المطبقة</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-10 w-3/4" /> : (
                    <p className="text-3xl font-bold font-mono text-destructive">
                        {formatCurrency(filteredData.totalDiscount)}
                    </p>
                )}
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            <CardTitle>سجل الخصومات التفصيلي</CardTitle>
          </div>
           <CardDescription>
            عرض كافة الخصومات التي تم تسجيلها في الفواتير خلال الفترة المحددة.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-center">الفرع</TableHead>
                <TableHead className="text-center">تاريخ التطبيق</TableHead>
                <TableHead className="text-center">المسؤول</TableHead>
                <TableHead className="text-center">قيمة الخصم</TableHead>
                <TableHead className="text-center">إجمالي الفاتورة</TableHead>
                <TableHead className="text-center">عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredData.discountEntries.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        لا توجد خصومات مطبقة في هذه الفترة.
                    </TableCell>
                </TableRow>
              ) : (
                filteredData.discountEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-right">{entry.orderCode}</TableCell>
                    <TableCell className="text-right font-medium">{entry.customerName}</TableCell>
                    <TableCell className="text-center text-xs">{entry.branchName}</TableCell>
                    <TableCell className="text-center text-[10px] font-mono">{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-center text-xs">{entry.appliedBy}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-destructive">
                        -{Math.round(entry.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs opacity-70">
                        {Math.round(entry.orderTotal).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderDetailsDialog orderId={entry.id}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
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


export default function DiscountsReport() {
    return (
        <AppLayout>
            <DiscountsReportPageContent />
        </AppLayout>
    )
}
