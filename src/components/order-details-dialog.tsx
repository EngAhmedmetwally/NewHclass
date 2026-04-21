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
import type { Order, User, Customer } from '@/lib/definitions';
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
  User as UserIcon,
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
  Wrench,
  Truck,
  AlertTriangle,
  Loader2,
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
import { useDatabase, useUser } from '@/firebase';
import { ref, update } from 'firebase/database';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
          return <Badge variant="destructive">قيد التجهيز</Badge>;
      case 'Ready for Pickup':
          return <Badge className="bg-yellow-500 text-black">جاهز للتسليم</Badge>;
       case 'Returned from Tailor':
          return <Badge className="bg-purple-500 text-white">عند الخياط</Badge>;
      case 'Returned':
          return <Badge className="bg-green-100 text-green-800">تم الإرجاع</Badge>;
      case 'Cancelled':
          return <Badge variant="destructive">ملغي</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
};

function OrderDetailsContent({ order }: { order: Order | undefined }) {
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();
    const { data: users } = useRtdbList<User>('users');
    const { data: customers } = useRtdbList<Customer>('customers');
    const { permissions } = usePermissions([
        'orders:edit',
        'orders:add-note',
        'orders:print-receipt',
        'orders:print-tailor-receipt',
        'orders:add-payment',
        'orders:cancel',
        'orders:exchange',
    ] as const);

    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [deliveryEmployeeId, setDeliveryEmployeeId] = useState('');
    const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);

    // Look up customer phone if not present in order data (for backward compatibility)
    const customerPhone = useMemo(() => {
        if (order?.customerPhone) return order.customerPhone;
        if (order?.customerId && customers) {
            return customers.find(c => c.id === order.customerId)?.primaryPhone;
        }
        return null;
    }, [order, customers]);

    const isOrderClosed = useMemo(() => {
        if (!order) return false;
        return ['Delivered to Customer', 'Completed', 'Returned', 'Cancelled'].includes(order.status);
    }, [order]);

    const handleUpdateStatus = async (newStatus: string, extraData: any = {}) => {
        if (!order || !db) return;
        setIsUpdatingStatus(true);
        try {
            // استخدام مسار التاريخ الموثوق المخزن في كائن الطلب
            const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
            const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);
            
            const updates = {
                status: newStatus,
                updatedAt: new Date().toISOString(),
                ...extraData
            };

            await update(orderRef, updates);
            toast({ title: "تم تحديث الحالة بنجاح", description: `تم تغيير حالة الطلب إلى ${newStatus}` });
            setIsDeliveryDialogOpen(false);
        } catch (e: any) {
            console.error("Order Status Update Error:", e);
            toast({ variant: 'destructive', title: "خطأ في التحديث", description: e.message });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const confirmDelivery = () => {
        const employee = users.find(u => u.id === deliveryEmployeeId);
        if (employee && order) {
            handleUpdateStatus('Delivered to Customer', {
                deliveryEmployeeId: employee.id,
                deliveryEmployeeName: employee.fullName,
                deliveredAt: new Date().toISOString()
            });
        }
    };

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
                         <div className="flex justify-between items-start">
                            <span className="text-muted-foreground flex items-center gap-1.5"><UserIcon className="h-4 w-4"/> العميل</span>
                            <div className="flex flex-col items-end">
                                <span className="font-bold">{order.customerName}</span>
                                {customerPhone && (
                                    <a href={`tel:${customerPhone}`} className="text-xs text-blue-600 hover:underline font-mono mt-1" dir="ltr">
                                        {customerPhone}
                                    </a>
                                )}
                            </div>
                        </div>
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
                        {order.returnedToEmployeeName && (
                            <div className="flex justify-between text-primary font-semibold">
                                <span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4"/> موظف الفحص</span>
                                <span>{order.returnedToEmployeeName}</span>
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
                            <span className="font-mono">{order.remainingAmount.toLocaleString()} ج.م</span>
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
                        {/* Rapid Status Actions */}
                        {!isOrderClosed && (
                            <div className="space-y-2 mb-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                                <p className="text-[10px] text-muted-foreground mb-2 font-bold">إجراءات الحالة السريعة:</p>
                                
                                {order.status === 'Pending' && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start gap-2 border-primary/50 text-primary hover:bg-primary/5" disabled={isUpdatingStatus}>
                                                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wrench className="h-4 w-4" />}
                                                تجهيز الطلب (إلى جاهز)
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl" className="text-right">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>تأكيد تجهيز الطلب</AlertDialogTitle>
                                                <AlertDialogDescription>هل تم الانتهاء من تجهيز كافة أصناف الطلب وهي الآن جاهزة للاستلام من قبل العميل؟</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-2 flex-row-reverse">
                                                <AlertDialogCancel>تراجع</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleUpdateStatus('Ready for Pickup')}>نعم، تم التجهيز</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}

                                {(order.status === 'Ready for Pickup' || order.status === 'Returned from Tailor') && (
                                    <>
                                        <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button 
                                                    variant="default" 
                                                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700" 
                                                    disabled={isUpdatingStatus || order.remainingAmount > 0}
                                                >
                                                    {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin"/> : <Truck className="h-4 w-4" />}
                                                    تسليم للعميل (خروج)
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent dir="rtl" className="text-right">
                                                <DialogHeader>
                                                    <DialogTitle className="text-right">تأكيد تسليم الطلب للعميل</DialogTitle>
                                                    <DialogDescription className="text-right">يرجى اختيار الموظف الذي قام بعملية التسليم الفعلية للعميل.</DialogDescription>
                                                </DialogHeader>
                                                <div className="py-4 space-y-4">
                                                    <div className="space-y-2">
                                                        <Label>موظف التسليم</Label>
                                                        <Select value={deliveryEmployeeId} onValueChange={setDeliveryEmployeeId}>
                                                            <SelectTrigger className="h-12">
                                                                <SelectValue placeholder="اختر الموظف..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {users.filter(u => u.isActive).map(u => (
                                                                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <DialogFooter className="gap-2">
                                                    <Button variant="outline" onClick={() => setIsDeliveryDialogOpen(false)} className="flex-1">إلغاء</Button>
                                                    <Button onClick={confirmDelivery} disabled={!deliveryEmployeeId || isUpdatingStatus} className="flex-1">تأكيد التسليم</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                        
                                        {order.remainingAmount > 0 && (
                                            <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded border border-destructive/20 text-destructive text-[9px] font-bold">
                                                <AlertTriangle className="h-3 w-3" />
                                                لا يمكن التسليم إلا بعد سداد المبلغ المتبقي بالكامل.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <Separator className="my-2" />

                        {order.remainingAmount > 0 && permissions.canOrdersAddPayment && order.status !== 'Cancelled' && (
                            <AddPaymentDialog
                                order={order}
                                trigger={
                                    <Button variant="default" className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700">
                                        <DollarSign className="h-4 w-4" /> إضافة دفعة سداد
                                    </Button>
                                }
                            />
                        )}
                        {permissions.canOrdersPrintReceipt && (
                            <PrintCashierReceiptDialog order={order} trigger={
                                <Button className="w-full justify-start gap-2" variant="outline"><Printer className="h-4 w-4" /> طباعة إيصال العميل</Button>
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
