
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  CheckCircle,
  Printer,
  Ruler,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Product, User, Order, Branch, Customer, Counter, Shift } from '@/lib/definitions';
import { Textarea } from '@/components/ui/textarea';
import { format, formatISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser, useDatabase } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, runTransaction, update } from 'firebase/database';
import { PrintCashierReceiptDialog } from './print-cashier-receipt-dialog';
import { DatePickerDialog } from './ui/date-picker-dialog';
import { SelectProductDialog } from './select-product-dialog';
import { SelectCustomerDialog } from './select-customer-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useSettings } from '@/hooks/use-settings';

type OrderItemState = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  totalPrice: number;
  tailorNotes?: string | null;
  measurements?: string | null;
  productCode: string;
  itemTransactionType?: 'Sale' | 'Rental' | null;
  currentStock: number;
};

function NewOrderDialogInner({ order, initialProductId, closeDialog }: { order?: Order, initialProductId?: string, closeDialog: () => void }) {
  const isEditMode = !!order;
  const { appUser } = useUser();
  const { settings } = useSettings();
  const { data: allUsers } = useRtdbList<User>('users');
  const { data: customers } = useRtdbList<Customer>('customers');
  const { data: branches } = useRtdbList<Branch>('branches');
  const { data: allProducts } = useRtdbList<Product>('products');
  const { data: shifts } = useRtdbList<Shift>('shifts');
  
  const dbRTDB = useDatabase();
  const { toast } = useToast();
  
  const [view, setView] = useState<'form' | 'success'>('form');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const [branchId, setBranchId] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [transactionType, setTransactionType] = useState<string | undefined>();
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [orderItems, setOrderItems] = useState<OrderItemState[]>([]);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  const { permissions } = usePermissions(['orders:apply-discount'] as const);

  const handleOrderDateChange = (date?: Date) => {
    setOrderDate(date);
    if (date && deliveryDate && isBefore(startOfDay(deliveryDate), startOfDay(date))) {
        setDeliveryDate(undefined);
        setReturnDate(undefined);
    }
  };

  const handleDeliveryDateChange = (date?: Date) => {
    setDeliveryDate(date);
    if (date && returnDate && isBefore(startOfDay(returnDate), startOfDay(date))) {
        setReturnDate(undefined);
    }
  };

  useEffect(() => {
    if (transactionType === 'Sale' && !isEditMode && !deliveryDate) {
      setDeliveryDate(new Date());
    }
  }, [transactionType, isEditMode, deliveryDate]);

  const availableProducts = useMemo(() => {
    if (!branchId) return [];
    return allProducts.filter((p) => p.branchId === branchId || p.showInAllBranches);
  }, [branchId, allProducts]);

  useEffect(() => {
    if (isEditMode && order) {
        setBranchId(order.branchId);
        setCustomerId(order.customerId);
        setTransactionType(order.transactionType);
        setOrderDate(new Date(order.orderDate));
        setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate) : undefined);
        setReturnDate(order.returnDate ? new Date(order.returnDate) : undefined);
        setOrderItems(order.items.map(item => ({
            id: item.productId + Math.random(),
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.priceAtTimeOfOrder,
            originalUnitPrice: item.originalPrice || item.priceAtTimeOfOrder,
            totalPrice: item.priceAtTimeOfOrder * item.quantity,
            tailorNotes: item.tailorNotes || null,
            measurements: item.measurements || null,
            productCode: item.productCode,
            itemTransactionType: item.itemTransactionType || null,
            currentStock: 0,
        })));
        setSellerId(order.sellerId);
        setPaidAmount(order.paid);
        setDiscount(order.discountAmount || 0);
        setNotes(order.notes || '');
    } else if (initialProductId) {
        const product = allProducts.find((p) => p.id === initialProductId);
        if (product) {
            setBranchId(product.branchId);
            setTransactionType(product.category === 'rental' ? 'Rental' : product.category === 'sale' ? 'Sale' : undefined);
            setSellerId(appUser?.id);
            setOrderItems([{
                id: Date.now().toString(),
                productId: product.id,
                productName: `${product.name} - مقاس ${product.size}`,
                quantity: 1,
                unitPrice: Number(product.price),
                originalUnitPrice: Number(product.price),
                totalPrice: Number(product.price),
                productCode: product.productCode,
                currentStock: product.quantityInStock - product.quantityRented,
            }]);
        }
    } else {
        setBranchId(appUser?.branchId && appUser.branchId !== 'all' ? appUser.branchId : undefined);
        setSellerId(appUser?.id);
    }
  }, [order, isEditMode, initialProductId, allProducts, appUser]);

  const subtotal = useMemo(() => Math.round(orderItems.reduce((sum, item) => sum + item.totalPrice, 0)), [orderItems]);
  const totalOrderAmount = useMemo(() => Math.round(subtotal - discount), [subtotal, discount]);
  const remainingAmount = useMemo(() => Math.round(totalOrderAmount - paidAmount), [totalOrderAmount, paidAmount]);

  const handleSaveOrder = async () => {
    if (!branchId || !customerId || !transactionType || !sellerId || orderItems.length === 0 || !appUser) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة' });
        return;
    }

    const openShift = shifts.find(s => s.cashier.id === appUser.id && !s.endTime);
    if (!isEditMode && !openShift) {
        setShowStartShiftDialog(true);
        return;
    }

    const cleanedItems = orderItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        priceAtTimeOfOrder: item.unitPrice,
        originalPrice: item.originalUnitPrice,
        productCode: item.productCode,
        tailorNotes: item.tailorNotes || null,
        measurements: item.measurements || null,
        itemTransactionType: item.itemTransactionType || null,
    }));

    const orderData: any = {
        branchId,
        customerId,
        transactionType,
        sellerId,
        total: totalOrderAmount,
        paid: paidAmount,
        remainingAmount,
        discountAmount: discount,
        shiftId: isEditMode ? (order?.shiftId || null) : (openShift?.id || null),
        shiftCode: isEditMode ? (order?.shiftCode || null) : (openShift?.shiftCode || null),
        customerName: customers.find(c => c.id === customerId)?.name || '',
        branchName: branches.find(b => b.id === branchId)?.name || '',
        sellerName: allUsers.find(u => u.id === sellerId)?.fullName || '',
        processedByUserId: isEditMode ? (order?.processedByUserId || appUser.id) : appUser.id,
        processedByUserName: isEditMode ? (order?.processedByUserName || appUser.fullName) : appUser.fullName,
        orderDate: formatISO(orderDate || new Date()),
        deliveryDate: deliveryDate ? formatISO(deliveryDate) : null,
        returnDate: returnDate ? formatISO(returnDate) : null,
        status: order?.status || 'Pending',
        items: cleanedItems,
        updatedAt: new Date().toISOString(),
        notes: notes || null,
    };

    try {
        if (!isEditMode && openShift) {
            const shiftRef = ref(dbRTDB, `shifts/${openShift.id}`);
            await runTransaction(shiftRef, (s) => {
                if (s) {
                    s.cash = (s.cash || 0) + paidAmount;
                    s.discounts = (s.discounts || 0) + discount;
                    if (transactionType === 'Sale') s.salesTotal = (s.salesTotal || 0) + totalOrderAmount;
                    else s.rentalsTotal = (s.rentalsTotal || 0) + totalOrderAmount;
                }
                return s;
            });
        }

        if (isEditMode) {
            const datePath = format(new Date(order!.orderDate), 'yyyy-MM-dd');
            await update(ref(dbRTDB, `daily-entries/${datePath}/orders/${order!.id}`), orderData);
        } else {
            const counterRef = ref(dbRTDB, 'counters/orders');
            const res = await runTransaction(counterRef, c => { if (!c) return { value: 70000001 }; c.value++; return c; });
            orderData.orderCode = res.snapshot.val().value.toString();
            const datePath = format(new Date(), 'yyyy-MM-dd');
            const newRef = push(ref(dbRTDB, `daily-entries/${datePath}/orders`));
            orderData.id = newRef.key;
            await set(newRef, orderData);
            
            for (const item of orderItems) {
                const pRef = ref(dbRTDB, `products/${item.productId}`);
                await runTransaction(pRef, p => {
                    if (p) {
                        p.quantityInStock -= item.quantity;
                        if ((item.itemTransactionType || transactionType) === 'Sale') p.quantitySold += item.quantity;
                        else { p.quantityRented += item.quantity; p.rentalCount = (p.rentalCount || 0) + item.quantity; }
                    }
                    return p;
                });
            }
        }
        setLastOrder(orderData);
        setView('success');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    }
  };

  if (view === 'success') {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">تم حفظ الطلب بنجاح!</p>
            {lastOrder?.shiftCode && (
                <Badge variant="outline" className="text-primary border-primary">الوردية رقم: {lastOrder.shiftCode}</Badge>
            )}
            <div className="flex gap-2 mt-4">
                {lastOrder && <PrintCashierReceiptDialog order={lastOrder} trigger={<Button className="gap-2"><Printer className="h-4 w-4"/> طباعة الإيصال</Button>} />}
            </div>
            <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
        </div>
      )
  }

  return (
    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
        {showStartShiftDialog && appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
        <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>الفرع</Label>
                    <Select value={branchId} onValueChange={setBranchId} disabled={!!appUser?.branchId && appUser.branchId !== 'all'}>
                        <SelectTrigger><SelectValue placeholder="الفرع" /></SelectTrigger>
                        <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>العميل</Label>
                    <SelectCustomerDialog customers={customers} onCustomerSelected={setCustomerId} selectedCustomerId={customerId} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>المعاملة</Label>
                    <Select value={transactionType} onValueChange={setTransactionType}>
                        <SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger>
                        <SelectContent><SelectItem value="Rental">إيجار</SelectItem><SelectItem value="Sale">بيع</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>البائع</Label>
                    <Select value={sellerId} onValueChange={setSellerId}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{allUsers.filter(u => u.isActive).map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>تاريخ الطلب</Label>
                    <DatePickerDialog value={orderDate} onValueChange={handleOrderDateChange} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>تاريخ التسليم</Label>
                    <DatePickerDialog value={deliveryDate} onValueChange={handleDeliveryDateChange} fromDate={orderDate} />
                </div>
                {transactionType === 'Rental' && (
                    <div className="flex flex-col gap-2">
                        <Label>تاريخ الإرجاع</Label>
                        <DatePickerDialog value={returnDate} onValueChange={setReturnDate} fromDate={deliveryDate || orderDate} />
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-sm">أصناف الطلب</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
                {orderItems.map(item => (
                    <div key={item.id} className="flex flex-col gap-3 border-b pb-4">
                        <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-12 lg:col-span-6">
                                <SelectProductDialog products={availableProducts} onProductSelected={p => {
                                    const prod = allProducts.find(x => x.id === p);
                                    if(prod) setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, productId: prod.id, productName: `${prod.name} - ${prod.size}`, unitPrice: Number(prod.price), originalUnitPrice: Number(prod.price), totalPrice: Number(prod.price), productCode: prod.productCode } : i));
                                }} selectedProductId={item.productId} disabled={!branchId} />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Label className="text-[10px]">الكمية</Label>
                                <Input type="number" value={item.quantity} onChange={e => {
                                    const q = parseInt(e.target.value) || 1;
                                    setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: q, totalPrice: q * i.unitPrice } : i));
                                }} />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Label className="text-[10px]">السعر</Label>
                                <Input type="number" value={item.unitPrice} onChange={e => {
                                    const p = parseFloat(e.target.value) || 0;
                                    setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, unitPrice: p, totalPrice: i.quantity * p } : i));
                                }} />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Button variant="destructive" size="icon" onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                        {item.productId && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 px-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] flex items-center gap-1"><Ruler className="h-3 w-3"/> القياسات</Label>
                                    <Input 
                                        placeholder="طول، صدر، وسط..." 
                                        value={item.measurements || ''} 
                                        onChange={e => setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, measurements: e.target.value } : i))} 
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] flex items-center gap-1"><Scissors className="h-3 w-3"/> ملاحظات الخياط</Label>
                                    <Textarea 
                                        placeholder="تعديلات مطلوبة..." 
                                        className="h-8 min-h-[32px] text-xs py-1"
                                        value={item.tailorNotes || ''} 
                                        onChange={e => setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, tailorNotes: e.target.value } : i))} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <Button variant="outline" onClick={() => setOrderItems(prev => [...prev, { id: Date.now().toString(), productId: '', productName: '', quantity: 1, unitPrice: 0, originalUnitPrice: 0, totalPrice: 0, productCode: '', currentStock: 0 }])}>إضافة صنف</Button>
            </CardContent>
        </Card>

        <Card>
            <CardContent className="space-y-4 pt-4">
                <div className="flex justify-between font-bold text-lg"><span>المجموع:</span> <span>{subtotal.toLocaleString()}</span></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>المدفوع</Label><Input type="number" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} /></div>
                    <div className="space-y-2"><Label>الخصم</Label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} disabled={!permissions.canOrdersApplyDiscount} /></div>
                </div>
                <div className="flex justify-between font-bold text-xl text-primary border-t pt-4">
                    <span>الصافي:</span>
                    <span>{totalOrderAmount.toLocaleString()}</span>
                </div>
            </CardContent>
        </Card>
        <Button onClick={handleSaveOrder} className="w-full h-12 text-lg">حفظ الطلب</Button>
    </div>
  );
}

export function NewOrderDialog({ trigger, order, productId, open: externalOpen, onOpenChange: externalOnOpenChange }: any) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (val: boolean) => {
      if (externalOnOpenChange) externalOnOpenChange(val);
      else setInternalOpen(val);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
            <DialogTitle>{order ? `تعديل طلب ${order.orderCode}` : 'إنشاء طلب جديد'}</DialogTitle>
        </DialogHeader>
        {open && <NewOrderDialogInner order={order} initialProductId={productId} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
