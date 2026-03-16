"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Undo2,
  Calendar as CalendarIcon,
  Filter,
  Eye,
  AlertTriangle,
  History,
  CheckCircle2,
  Clock,
  Store,
  User,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, startOfToday, isPast } from 'date-fns';
import type { Order, Branch } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { ReceiveReturnDialog } from '@/components/receive-return-dialog';

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        return '-'
    }
    return format(date, "d MMMM yyyy");
}


function ReturnsPageContent() {
  const [filter, setFilter] = useState<'all' | 'due' | 'overdue'>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  const { appUser } = useUser();
  const { data: allOrders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');

  const isLoading = isLoadingOrders || isLoadingBranches;
  
  const rentalOrdersToReturn = useMemo(() => {
    if (isLoading) return [];

    let orders = allOrders.filter(order => {
        const isRental = order.transactionType === 'Rental';
        const isDelivered = order.status === 'Delivered to Customer';
        let branchMatch = branchFilter === 'all' || order.branchId === branchFilter;
        if (appUser?.branchId && appUser.branchId !== 'all') {
            branchMatch = order.branchId === appUser.branchId;
        }

        return isRental && isDelivered && branchMatch;
    });
    
    if (filter === 'overdue') {
        orders = orders.filter(o => o.returnDate && isPast(new Date(o.returnDate)));
    }

    return orders;
  }, [allOrders, filter, branchFilter, appUser, isLoading]);

  const renderMobileCards = () => (
    <div className="grid gap-4 md:hidden">
        {rentalOrdersToReturn.map(order => {
            const isOverdue = order.returnDate && isPast(new Date(order.returnDate));
            return (
                <Card key={order.id} className={cn("overflow-hidden", isOverdue && "border-destructive bg-destructive/5")}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardTitle className="font-mono text-lg">{order.orderCode}</CardTitle>
                                <p className="text-sm font-medium">{order.customerName}</p>
                            </div>
                            {isOverdue ? (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" /> متأخر
                                </Badge>
                            ) : (
                                <Badge variant="outline">في الموعد</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm pt-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3"/> الفرع:</span>
                            <span>{order.branchName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/> التسليم:</span>
                            <span>{formatDate(order.deliveryDate)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> الإرجاع المطلوب:</span>
                            <span className={cn(isOverdue && "text-destructive font-bold")}>{formatDate(order.returnDate)}</span>
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <ReceiveReturnDialog 
                            order={order} 
                            trigger={
                                <Button size="sm" className="flex-1 gap-1.5 bg-green-600 text-white hover:bg-green-700">
                                    <CheckCircle2 className="h-4 w-4"/> تأكيد الاستلام
                                </Button>
                            } 
                        />
                        <OrderDetailsDialog orderId={order.id}>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Eye className="h-4 w-4"/> عرض
                            </Button>
                        </OrderDetailsDialog>
                    </CardFooter>
                </Card>
            );
        })}
    </div>
  );

  const renderDesktopTable = () => (
    <Card className="hidden md:block">
        <CardHeader>
            <div className="flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                <div>
                    <CardTitle>طلبات إيجار تنتظر الإرجاع</CardTitle>
                    <CardDescription>قائمة بالطلبات التي تم تأجيرها ومطلوب إرجاعها.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">كود الطلب</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-center">تاريخ التسليم للعميل</TableHead>
                        <TableHead className="text-center">تاريخ الإرجاع المطلوب</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="w-[200px] text-center">الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rentalOrdersToReturn.map(order => {
                        const isOverdue = order.returnDate && isPast(new Date(order.returnDate));
                        return (
                            <TableRow key={order.id} className={cn(isOverdue && 'bg-destructive/10')}>
                            <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                            <TableCell className="text-right">{order.customerName}</TableCell>
                            <TableCell className="text-right">{order.branchName}</TableCell>
                            <TableCell className="text-center">{formatDate(order.deliveryDate)}</TableCell>
                            <TableCell className="text-center">{formatDate(order.returnDate)}</TableCell>
                            <TableCell className="text-center">
                                {isOverdue ? (
                                    <Badge variant="destructive" className="gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        متأخر
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">في الموعد</Badge>
                                )}
                            </TableCell>
                                <TableCell className="text-center">
                                <div className="flex gap-2 justify-center">
                                    <ReceiveReturnDialog 
                                        order={order} 
                                        trigger={
                                            <Button size="sm" className="gap-1.5 bg-green-600 text-white hover:bg-green-700">
                                                <CheckCircle2 className="h-4 w-4"/> تأكيد الاستلام
                                            </Button>
                                        } 
                                    />
                                    <OrderDetailsDialog orderId={order.id}>
                                        <Button variant="ghost" size="sm" className="gap-1.5">
                                            <Eye className="h-4 w-4"/> عرض
                                        </Button>
                                    </OrderDetailsDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="استلام المرتجعات" showBackButton />

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle>فلترة الطلبات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
             <div className="flex flex-col gap-2">
                 <Label>حالة الإرجاع</Label>
                 <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الطلبات</SelectItem>
                        <SelectItem value="overdue">الطلبات المتأخرة فقط</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                 <Label>الفرع</Label>
                 <Select value={branchFilter} onValueChange={setBranchFilter} disabled={isLoadingBranches || (!!appUser?.branchId && appUser.branchId !== 'all')}>
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

        {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        ) : rentalOrdersToReturn.length === 0 ? (
            <Card>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
                    <Undo2 className="h-10 w-10 opacity-20" />
                    <p>لا توجد طلبات مرتجعة حاليًا تطابق الفلترة.</p>
                </CardContent>
            </Card>
        ) : (
            <>
                {renderMobileCards()}
                {renderDesktopTable()}
            </>
        )}
    </div>
  );
}

export default function ReturnsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <ReturnsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}