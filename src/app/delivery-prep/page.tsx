
'use client';

import React, { useState, useMemo } from 'react';
import {
  Truck,
  Calendar as CalendarIcon,
  Filter,
  Eye,
  Scissors,
  PackageCheck,
  PackageSearch,
  Wrench,
  DollarSign,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import type { Order, Branch } from '@/lib/definitions';
import Link from 'next/link';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useUser, useDatabase } from '@/firebase';
import { ref, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AddPaymentDialog } from '@/components/add-payment-dialog';
import { PrintTailorReceiptDialog } from '@/components/print-tailor-receipt-dialog';
import { AppLayout } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';

function getOrderSummary(items: Order['items']) {
    if (!items || items.length === 0) return '-';
    const firstItem = items[0];
    const summary = `${firstItem.productName}`;
    return items.length > 1 ? `${summary} و ${items.length - 1} آخرون` : summary;
}

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        return '-'
    }
    return format(date, "d MMMM yyyy");
}


function DeliveryPrepPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(addDays(new Date(), 7));
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { settings, isLoading: isLoadingSettings } = useSettings();
  const { data: allOrders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['orders:add-payment'] as const);

  const isLoading = isLoadingOrders || isLoadingBranches || isLoadingSettings || isLoadingPermissions;
  
  const filteredOrders = useMemo(() => {
    if (isLoading) return [];

    let orders = allOrders.filter(order => {
        if (!order.deliveryDate) return false;
        const deliveryDate = new Date(order.deliveryDate);
        const start = fromDate ? new Date(fromDate.setHours(0,0,0,0)) : null;
        const end = toDate ? new Date(toDate.setHours(23,59,59,999)) : null;
        
        const dateMatch = (!start || deliveryDate >= start) && (!end || deliveryDate <= end);
        let branchMatch = selectedBranch === 'all';
        if (appUser?.branchId && appUser.branchId !== 'all') {
            branchMatch = order.branchId === appUser.branchId;
        } else if (selectedBranch !== 'all') {
            branchMatch = order.branchId === selectedBranch;
        }

        return dateMatch && branchMatch;
    });
    return orders;
  }, [allOrders, fromDate, toDate, selectedBranch, appUser, isLoading]);


  const { pendingOrders, readyOrders, fromTailorOrders } = useMemo(() => {
    const pending: Order[] = [];
    const ready: Order[] = [];
    const fromTailor: Order[] = [];

    filteredOrders.forEach(order => {
        if(order.status === 'Pending') pending.push(order);
        if(order.status === 'Ready for Pickup') ready.push(order);
        if(order.status === 'Returned from Tailor') fromTailor.push(order);
    })

    return { pendingOrders: pending, readyOrders: ready, fromTailorOrders: fromTailor };
  }, [filteredOrders]);

  const updateOrderStatus = async (order: Order, newStatus: string) => {
    if (!db || !order.orderDate) return;
    const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
    const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);
    
    try {
        await update(orderRef, { status: newStatus });
        toast({
            title: 'تم تحديث الحالة',
            description: `تم تحديث حالة الطلب ${order.orderCode} إلى "${newStatus}".`
        });
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'خطأ في التحديث',
            description: error.message
        });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="إدارة طلبات التجهيز والتسليم" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle>فلترة طلبات التجهيز والتسليم</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
                <Label>من تاريخ تسليم</Label>
                 <DatePickerDialog
                    value={fromDate}
                    onValueChange={setFromDate}
                 />
            </div>
             <div className="flex flex-col gap-2">
                <Label>إلى تاريخ تسليم</Label>
                 <DatePickerDialog
                    value={toDate}
                    onValueChange={setToDate}
                 />
            </div>
            <div className="flex flex-col gap-2">
                 <Label>الفرع</Label>
                 <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoadingBranches || (!!appUser?.branchId && appUser.branchId !== 'all')}>
                    <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الفروع</SelectItem>
                        {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <PackageSearch className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle>طلبات قيد التجهيز</CardTitle>
                        <CardDescription>الطلبات التي تحتاج إلى تجهيزها للتسليم في الفترة المحددة.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">كود الطلب</TableHead>
                            <TableHead className="text-right">العميل</TableHead>
                            <TableHead className="text-right">الأصناف</TableHead>
                            <TableHead className="text-right">الفرع</TableHead>
                            <TableHead className="text-center">تاريخ التسليم</TableHead>
                             <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="w-[200px] text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && [...Array(3)].map((_, i) => (
                             <TableRow key={i}>
                                {[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-8" /></TableCell>)}
                            </TableRow>
                        ))}
                        {!isLoading && pendingOrders.map(order => (
                             <TableRow key={order.id}>
                                <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                                <TableCell className="text-right">{order.customerName}</TableCell>
                                <TableCell className="text-right font-medium">{getOrderSummary(order.items)}</TableCell>
                                <TableCell className="text-right">{order.branchName}</TableCell>
                                <TableCell className="text-center">{formatDate(order.deliveryDate)}</TableCell>
                                <TableCell className="text-center"><Badge variant="destructive">قيد التجهيز</Badge></TableCell>
                                 <TableCell className="text-center">
                                    <div className="flex gap-2 justify-center">
                                        <Button size="sm" className="gap-1.5" onClick={() => updateOrderStatus(order, 'Ready for Pickup')}><Wrench className="h-4 w-4"/> تجهيز الطلب</Button>
                                        <OrderDetailsDialog orderId={order.id}>
                                            <Button variant="ghost" size="sm" className="gap-1.5"><Eye className="h-4 w-4"/> عرض</Button>
                                        </OrderDetailsDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                         {!isLoading && pendingOrders.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                    لا توجد طلبات لتجهيزها للفترة والفرع المحددين.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {settings.feature_enableTailorWorkflow && (
          <Card>
              <CardHeader>
                  <div className="flex items-center gap-2">
                      <Scissors className="h-6 w-6 text-primary" />
                      <div>
                          <CardTitle>طلبات عند الخياط</CardTitle>
                          <CardDescription>الطلبات التي تم إرسالها للخياط للتعديل.</CardDescription>
                      </div>
                  </div>
              </CardHeader>
               <CardContent className="p-0">
                  <Table>
                      <TableHeader>
                           <TableRow>
                              <TableHead className="text-center">كود الطلب</TableHead>
                              <TableHead className="text-right">العميل</TableHead>
                              <TableHead className="text-right">المنتج</TableHead>
                              <TableHead className="text-right">الفرع</TableHead>
                              <TableHead className="text-center">تاريخ التسليم</TableHead>
                              <TableHead className="text-center">الحالة</TableHead>
                              <TableHead className="w-[340px] text-center">الإجراءات</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                           {isLoading && [...Array(1)].map((_, i) => (
                               <TableRow key={i}>
                                  {[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-8" /></TableCell>)}
                              </TableRow>
                          ))}
                          {!isLoading && fromTailorOrders.map(order => (
                              <TableRow key={order.id}>
                                  <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                                  <TableCell className="text-right">{order.customerName}</TableCell>
                                  <TableCell className="text-right font-medium">{getOrderSummary(order.items)}</TableCell>
                                  <TableCell className="text-right">{order.branchName}</TableCell>
                                  <TableCell className="text-center">{formatDate(order.deliveryDate)}</TableCell>
                                  <TableCell className="text-center"><Badge className="bg-purple-500 text-white">عند الخياط</Badge></TableCell>
                                  <TableCell className="text-center">
                                      <div className="flex gap-2 justify-center">
                                          <Button size="sm" className="gap-1.5" onClick={() => updateOrderStatus(order, 'Ready for Pickup')}><PackageCheck className="h-4 w-4"/> جاهز للتسليم</Button>
                                          <PrintTailorReceiptDialog order={order} trigger={
                                              <Button variant="outline" size="sm" className="gap-1.5">طباعة وصل</Button>
                                          } />
                                          <OrderDetailsDialog orderId={order.id}>
                                              <Button variant="ghost" size="sm" className="gap-1.5"><Eye className="h-4 w-4"/> عرض</Button>
                                          </OrderDetailsDialog>
                                      </div>
                                  </TableCell>
                              </TableRow>
                          ))}
                           {!isLoading && fromTailorOrders.length === 0 && (
                               <TableRow>
                                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                      لا توجد طلبات عند الخياط حاليًا.
                                  </TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
        )}


        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <PackageCheck className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle>طلبات جاهزة للتسليم</CardTitle>
                        <CardDescription>الطلبات التي تم تجهيزها وهي جاهزة للتسليم للعميل.</CardDescription>
                    </div>
                </div>
            </CardHeader>
             <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">كود الطلب</TableHead>
                            <TableHead className="text-right">العميل</TableHead>
                            <TableHead className="text-right">المنتج</TableHead>
                            <TableHead className="text-right">الفرع</TableHead>
                            <TableHead className="text-center">تاريخ التسليم</TableHead>
                            <TableHead className="text-center">المبلغ المتبقي</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="w-[380px] text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && [...Array(2)].map((_, i) => (
                             <TableRow key={i}>
                                {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-8" /></TableCell>)}
                            </TableRow>
                        ))}
                        {!isLoading && readyOrders.map(order => (
                            <TableRow key={order.id}>
                                <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                                <TableCell className="text-right">{order.customerName}</TableCell>
                                <TableCell className="text-right font-medium">{getOrderSummary(order.items)}</TableCell>
                                <TableCell className="text-right">{order.branchName}</TableCell>
                                <TableCell className="text-center">{formatDate(order.deliveryDate)}</TableCell>
                                <TableCell className={cn("text-center font-mono font-semibold", order.remainingAmount > 0 ? 'text-destructive' : 'text-green-600')}>{order.remainingAmount.toLocaleString()} ج.م</TableCell>
                                <TableCell className="text-center"><Badge className="bg-yellow-500 text-black">تم التجهيز</Badge></TableCell>
                                <TableCell className="text-center">
                                    <div className="flex gap-2 justify-center">
                                         {order.remainingAmount > 0 && permissions.canOrdersAddPayment && (
                                            <AddPaymentDialog order={order} trigger={
                                                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"><DollarSign className="h-4 w-4"/> إضافة دفعة</Button>
                                            }/>
                                        )}
                                        <OrderDetailsDialog orderId={order.id}>
                                            <Button variant="ghost" size="sm" className="gap-1.5"><Eye className="h-4 w-4"/> عرض</Button>
                                        </OrderDetailsDialog>
                                        <Button size="sm" className="gap-1.5" onClick={() => updateOrderStatus(order, 'Delivered to Customer')} disabled={order.remainingAmount > 0}><Truck className="h-4 w-4"/> تسليم للعميل</Button>
                                        {settings.feature_enableTailorWorkflow && (
                                          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => updateOrderStatus(order, 'Returned from Tailor')}><Scissors className="h-4 w-4"/> إرسال للخياط</Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                         {!isLoading && readyOrders.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                    لا توجد طلبات جاهزة للتسليم حاليًا.
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

export default function DeliveryPrepPage() {
    return (
        <AppLayout>
            <DeliveryPrepPageContent />
        </AppLayout>
    )
}
