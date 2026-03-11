'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, XCircle, User, Calendar, Eye, FileText } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { cn } from '@/lib/utils';

function CancelledOrdersReportPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  const { data: orders, isLoading } = useRtdbList<Order>('daily-entries');

  const cancelledOrders = useMemo(() => {
    if (isLoading) return [];

    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    return orders.filter(order => {
        if (order.status !== 'Cancelled') return false;
        
        const cancelDateStr = order.cancelledAt || order.orderDate;
        const cancelDate = new Date(cancelDateStr);
        
        const dateMatch = (!start || cancelDate >= start) && (!end || cancelDate <= end);
        return dateMatch;
    }).sort((a, b) => {
        const dateA = new Date(a.cancelledAt || a.orderDate).getTime();
        const dateB = new Date(b.cancelledAt || b.orderDate).getTime();
        return dateB - dateA;
    });
  }, [orders, isLoading, fromDate, toDate]);

  const stats = useMemo(() => {
      const totalAmount = cancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      return { count: cancelledOrders.length, totalAmount };
  }, [cancelledOrders]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ar-EG', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير الطلبات الملغاة" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
                <Label>من تاريخ الإلغاء</Label>
                 <DatePickerDialog
                    value={fromDate}
                    onValueChange={setFromDate}
                 />
            </div>
             <div className="flex flex-col gap-2">
                <Label>إلى تاريخ الإلغاء</Label>
                 <DatePickerDialog
                    value={toDate}
                    onValueChange={setToDate}
                    fromDate={fromDate}
                 />
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-muted/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    عدد الطلبات الملغاة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono">
                    {stats.count}
                </div>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    إجمالي مبالغ الطلبات الملغاة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono">
                    {stats.totalAmount.toLocaleString()} ج.م
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الإلغاءات</CardTitle>
          <CardDescription>عرض تفصيلي للطلبات التي تم إلغاؤها والموظف المسؤول.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-center">تاريخ الإلغاء</TableHead>
                <TableHead className="text-center">بواسطة</TableHead>
                <TableHead className="text-center">المبلغ</TableHead>
                <TableHead className="text-center">عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : cancelledOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    لا توجد طلبات ملغاة في هذه الفترة.
                  </TableCell>
                </TableRow>
              ) : (
                cancelledOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-right">{order.orderCode}</TableCell>
                    <TableCell className="text-right">{order.customerName}</TableCell>
                    <TableCell className="text-center text-xs">
                        {formatDate(order.cancelledAt || order.orderDate)}
                    </TableCell>
                    <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{order.cancelledByUserName || order.processedByUserName}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-destructive">
                        {(order.total || 0).toLocaleString()} ج.م
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderDetailsDialog orderId={order.id}>
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

export default function CancelledOrdersReportPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <CancelledOrdersReportPageContent />
            </AuthGuard>
        </AppLayout>
    )
}