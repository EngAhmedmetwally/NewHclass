'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Filter, HandCoins, User, Calendar, Eye, Phone, DollarSign } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Customer } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function CustomerReceivablesReportPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: customers, isLoading: isLoadingCustomers } = useRtdbList<Customer>('customers');

  const isLoading = isLoadingOrders || isLoadingCustomers;

  const receivables = useMemo(() => {
    if (isLoading) return [];

    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    return orders.filter(order => {
        if (order.status === 'Cancelled' || order.remainingAmount <= 0) return false;
        
        const orderDate = new Date(order.orderDate);
        const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
        return dateMatch;
    }).map(order => {
        const customer = customers.find(c => c.id === order.customerId);
        return {
            ...order,
            customerPhone: customer?.primaryPhone || '-',
        };
    }).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, customers, isLoading, fromDate, toDate]);

  const stats = useMemo(() => {
      const totalReceivable = receivables.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);
      return { count: receivables.length, totalReceivable };
  }, [receivables]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير مستحقات العملاء" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
                <Label>من تاريخ الطلب</Label>
                 <DatePickerDialog
                    value={fromDate}
                    onValueChange={setFromDate}
                 />
            </div>
             <div className="flex flex-col gap-2">
                <Label>إلى تاريخ الطلب</Label>
                 <DatePickerDialog
                    value={toDate}
                    onValueChange={setToDate}
                    fromDate={fromDate}
                 />
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-primary" />
                    إجمالي المبالغ المستحقة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono text-primary">
                    {stats.totalReceivable.toLocaleString()} ج.م
                </div>
            </CardContent>
        </Card>
        <Card className="bg-muted/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    عدد الطلبات غير المحصلة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-mono">
                    {stats.count}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الديون المستحقة</CardTitle>
          <CardDescription>عرض تفصيلي للطلبات التي لم يتم سداد قيمتها بالكامل في الفترة المحددة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">كود الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-center">رقم الهاتف</TableHead>
                <TableHead className="text-center">تاريخ الطلب</TableHead>
                <TableHead className="text-center">إجمالي الطلب</TableHead>
                <TableHead className="text-center">المدفوع</TableHead>
                <TableHead className="text-center">المتبقي (المستحق)</TableHead>
                <TableHead className="text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-8 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : receivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    لا توجد مبالغ مستحقة في هذه الفترة.
                  </TableCell>
                </TableRow>
              ) : (
                receivables.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-center">{order.orderCode}</TableCell>
                    <TableCell className="text-right font-medium">{order.customerName}</TableCell>
                    <TableCell className="text-center font-mono text-xs" dir="ltr">{order.customerPhone}</TableCell>
                    <TableCell className="text-center text-xs">
                        {formatDate(order.orderDate)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                        {order.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono text-green-600">
                        {order.paid.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="destructive" className="font-mono font-bold text-sm">
                            {order.remainingAmount.toLocaleString()} ج.م
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderDetailsDialog orderId={order.id}>
                            <Button variant="ghost" size="sm" className="gap-1">
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline">عرض الطلب</span>
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

export default function CustomerReceivablesReportPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <CustomerReceivablesReportPageContent />
            </AuthGuard>
        </AppLayout>
    )
}