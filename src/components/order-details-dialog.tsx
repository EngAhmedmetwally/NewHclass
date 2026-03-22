"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  Calendar,
  User,
  Store,
  BookUser,
  FileText,
  Scissors,
  Printer,
  Pencil,
  MessageSquarePlus,
  Ruler,
  Settings,
  CheckCircle2,
  DollarSign,
  Phone,
  Trash2,
  ArrowLeftRight,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddOrderNoteDialog } from './add-order-note-dialog';
import { PrintCashierReceiptDialog } from './print-cashier-receipt-dialog';
import { PrintTailorReceiptDialog } from './print-tailor-receipt-dialog';
import { NewOrderDialog } from './new-order-dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { AddPaymentDialog } from './add-payment-dialog';
import { CancelOrderDialog } from './cancel-order-dialog';
import { ExchangeItemDialog } from './exchange-item-dialog';

type OrderDetailsDialogProps = {
  orderId: string;
  children: React.ReactNode;
};

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const cleanDateString = typeof dateString === 'string' ? dateString.replace('Z', '') : dateString;
    const date = new Date(cleanDateString);
    if (isNaN(date.getTime())) {
        return '-'
    }
    return date.toLocaleDateString('ar-EG-u-nu-latn', {day: '2-digit', month: '2-digit', year: 'numeric'});
}

const getStatusBadge = (order: Order) => {
    const { status, transactionType } = order;
    switch (status) {
      case 'Completed':
        return <Badge className="bg-green-500 text-white">مكتمل</Badge>;
      case 'Delivered to Customer':
         if (transactionType === 'Sale') {
             return <Badge className="bg-green-600 text-white flex gap-1"><CheckCircle2 className="h-4 w-4"/> تم التسليم</Badge>;
         }
         return <Badge className="bg-blue-500 text-white">مؤجر</Badge>;
      case 'Pending':
          return <Badge variant="secondary">قيد الانتظار</Badge>;
      case 'Ready for Pickup':
          return <Badge className="bg-yellow-500 text-black">جاهز للتسليم</Badge>;
       case 'Returned from Tailor':
          return <Badge className="bg-purple-500 text-white">وصل من الخياط</Badge>;
      case 'Returned':
          return <Badge className="bg-green-100 text-green-800">تم الإرجاع</Badge>;
      case 'Cancelled':
          return <Badge variant="destructive">ملغي</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
};

function OrderDetailsContent({ order }: { order: Order | undefined }) {
    const { permissions } = usePermissions([
        'orders:edit',
        'orders:add-note',
        'orders:print-receipt',
        'orders:print-tailor-receipt',
        'orders:add-payment',
        'orders:cancel',
        'orders:exchange',
    ] as const);

    const isOrderClosed = useMemo(() => {
        if (!order) return false;
        return ['Delivered to Customer', 'Completed', 'Returned', 'Cancelled'].includes(order.status);
    }, [order]);

  if (!order) {
    return (
      <div className="grid md:grid-cols-3 gap-8 items-start p-6">
        <div className="md:col-span-2 flex flex-col gap-8">
            <Skeleton className="h-48 w-full" />
        </div>
        <div className="md:col-span-1 flex flex-col gap-8">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  
  const totalItemsPrice = order.items.reduce((sum, item) => sum + (item.priceAtTimeOfOrder * item.quantity), 0);
  const finalTotal = totalItemsPrice - (order.discountAmount || 0);

  return (
    <div className="max-h-[80vh] overflow-y-auto">
        <div className="grid md:grid-cols-3 gap-8 items-start px-6 pb-6 pt-2">
            <div className="md:col-span-2 flex flex-col gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary"/>
                            أصناف الطلب
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right w-[35%]">المنتج</TableHead>
                                    <TableHead className="text-center">الكمية</TableHead>
                                    <TableHead className="text-center">السعر الأساسي</TableHead>
                                    <TableHead className="text-center">سعر المعاملة</TableHead>
                                    <TableHead className="text-center">الإجمالي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item, index) => {
                                    const catalogPrice = item.originalPrice || item.priceAtTimeOfOrder;
                                    const isPriceChanged = item.priceAtTimeOfOrder !== catalogPrice;

                                    return (
                                        <React.Fragment key={index}>
                                            <TableRow>
                                                <TableCell className="font-medium text-right">{item.productName}</TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-center font-mono text-muted-foreground">{catalogPrice.toLocaleString()} ج.م</TableCell>
                                                <TableCell className={cn(
                                                    "text-center font-mono font-semibold",
                                                    isPriceChanged && "text-blue-600 dark:text-blue-400"
                                                )}>
                                                    {item.priceAtTimeOfOrder.toLocaleString()} ج.م
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-semibold">{(item.priceAtTimeOfOrder * item.quantity).toLocaleString()} ج.م</TableCell>
                                            </TableRow>
                                            {(item.tailorNotes || item.measurements) && (
                                                <TableRow className="bg-muted/50">
                                                    <TableCell colSpan={5} className="py-2 px-4">
                                                        {item.measurements &&
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <Ruler className="h-4 w-4 mt-1 text-muted-foreground" />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-semibold text-muted-foreground">القياسات</p>
                                                                    <p className="text-sm whitespace-pre-wrap">{item.measurements}</p>
                                                                </div>
                                                            </div>
                                                        }
                                                        {item.tailorNotes &&
                                                            <div className="flex items-start gap-2">
                                                                <Scissors className="h-4 w-4 mt-1 text-muted-foreground" />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-semibold text-muted-foreground">ملاحظات الخياط</p>
                                                                    <p className="text-sm whitespace-pre-wrap">{item.tailorNotes}</p>
                                                                </div>
                                                            </div>
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {order.notes && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary"/>
                                ملاحظات عامة على الطلب
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                           <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
            <div className="md:col-span-1 flex flex-col gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>ملخص الطلب</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">الحالة</span>
                            {getStatusBadge(order)}
                        </div>
                        <Separator/>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> تاريخ الطلب</span>
                            <span>{formatDate(order.orderDate)}</span>
                        </div>
                         {order.deliveryDate && (
                             <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> تاريخ التسليم</span>
                                <span>{formatDate(order.deliveryDate)}</span>
                            </div>
                         )}
                         {order.returnDate && (
                             <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/> تاريخ الإرجاع</span>
                                <span>{formatDate(order.returnDate)}</span>
                            </div>
                         )}
                        <Separator/>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4"/> العميل</span>
                            <span>{order.customerName}</span>
                        </div>
                         {order.customerPhone && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-4 w-4"/> هاتف العميل</span>
                                <span dir="ltr">{order.customerPhone}</span>
                            </div>
                        )}
                         <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><BookUser className="h-4 w-4"/> البائع</span>
                            <span>{order.sellerName}</span>
                        </div>
                        {order.deliveryEmployeeName && (
                            <div className="flex justify-between text-green-600 font-semibold">
                                <span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4"/> موظف التسليم</span>
                                <span>{order.deliveryEmployeeName}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Store className="h-4 w-4"/> الفرع</span>
                            <span>{order.branchName}</span>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <FileText className="h-5 w-5 text-primary"/>
                            الملخص المالي
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm">
                        <div className="flex justify-between font-medium">
                            <span>الإجمالي الفرعي</span>
                            <span className="font-mono">{totalItemsPrice.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span>الخصم</span>
                            <span className="font-mono text-green-600">{(order.discountAmount || 0).toLocaleString()} ج.م</span>
                        </div>
                         <Separator/>
                         <div className="flex justify-between font-bold text-base">
                            <span>الإجمالي النهائي</span>
                            <span className="font-mono">{finalTotal.toLocaleString()} ج.م</span>
                        </div>
                         <div className="flex justify-between font-medium">
                            <span>المبلغ المدفوع</span>
                            <span className="font-mono">{(order.paid || 0).toLocaleString()} ج.م</span>
                        </div>
                         <div className={cn("flex justify-between font-bold text-lg p-2 rounded-md", order.remainingAmount > 0 ? 'bg-destructive/10 text-destructive dark:bg-amber-500/10 dark:text-amber-500' : 'bg-green-500/10 text-green-600')}>
                            <span>المبلغ المتبقي</span>
                            <span className="font-mono">{order.remainingAmount.toLocaleString()} ج.m</span>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                           <Settings className="h-5 w-5 text-primary"/>
                            الإجراءات
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {order.remainingAmount > 0 && permissions.canOrdersAddPayment && order.status !== 'Cancelled' && (
                            <AddPaymentDialog
                                order={order}
                                trigger={
                                    <Button variant="default" className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700">
                                        <DollarSign className="h-4 w-4" /> إضافة دفعة
                                    </Button>
                                }
                            />
                        )}
                        {permissions.canOrdersPrintReceipt && (
                            <PrintCashierReceiptDialog order={order} trigger={
                                <Button className="w-full justify-start gap-2"><Printer className="h-4 w-4" /> طباعة الإيصال</Button>
                            } />
                        )}
                        {permissions.canOrdersPrintTailorReceipt && (
                            <PrintTailorReceiptDialog order={order} trigger={
                                <Button variant="outline" className="w-full justify-start gap-2"><Scissors className="h-4 w-4"/> طباعة وصل الخياط</Button>
                            } />
                        )}
                        
                        {!isOrderClosed && permissions.canOrdersExchange && (
                            <ExchangeItemDialog order={order} trigger={
                                <Button variant="outline" className="w-full justify-start gap-2">
                                    <ArrowLeftRight className="h-4 w-4" /> تبديل صنف
                                </Button>
                            }/>
                        )}

                        {!isOrderClosed && permissions.canOrdersAddNote && (
                            <AddOrderNoteDialog order={order} trigger={
                                <Button variant="outline" className="w-full justify-start gap-2"><MessageSquarePlus className="h-4 w-4"/> إضافة ملاحظة</Button>
                            } />
                        )}
                        {!isOrderClosed && permissions.canOrdersEdit && (
                            <NewOrderDialog order={order} trigger={
                                <Button variant="outline" className="w-full justify-start gap-2"><Pencil className="h-4 w-4" /> تعديل الطلب</Button>
                            }/>
                        )}
                        {!isOrderClosed && permissions.canOrdersCancel && (
                            <CancelOrderDialog order={order} trigger={
                                <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" /> إلغاء الطلب بالكامل
                                </Button>
                            } />
                        )}
                         {isOrderClosed && !permissions.canOrdersEdit && !permissions.canOrdersAddNote && (
                            <p className="text-sm text-muted-foreground text-center p-2">لا توجد إجراءات متاحة لهذا الطلب.</p>
                        )}
                    </CardContent>
                 </Card>

            </div>
          </div>
    </div>
  );
}


export function OrderDetailsDialog({ orderId, children }: OrderDetailsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { data: orders, isLoading } = useRtdbList<Order>('daily-entries');
  
  const order = useMemo(() => {
    if (isLoading || !orders) return undefined;
    return orders.find((o) => o.id === orderId);
  }, [orders, orderId, isLoading]);

  const handleOpenChange = (val: boolean) => {
      setOpen(val);
      // Aggressive Cleanup
      if (!val) {
          setTimeout(() => {
              document.body.style.pointerEvents = 'auto';
              document.body.style.overflow = '';
          }, 100);
      }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>تفاصيل الطلب - {order?.orderCode || '...'}</DialogTitle>
          <DialogDescription className="sr-only">عرض تفاصيل الطلب المحدد.</DialogDescription>
        </DialogHeader>
        {open && <OrderDetailsContent order={order} />}
        <DialogFooter className="p-6 pt-4 border-t">
            <DialogClose asChild>
                <Button variant="outline">إغلاق</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
