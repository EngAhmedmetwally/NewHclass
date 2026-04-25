
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  CheckCircle,
  Printer,
  Ruler,
  Scissors,
  MapPin,
  Truck,
  Loader2,
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
import type { Product, User, Order, Branch, Customer, Shift, StockMovement, Region } from '@/lib/definitions';
import { Textarea } from '@/components/ui/textarea';
import { format, formatISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser, useDatabase } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, runTransaction, update, get } from 'firebase/database';
import { PrintCashierReceiptDialog } from './print-cashier-receipt-dialog';
import { DatePickerDialog } from './ui/date-picker-dialog';
import { SelectProductDialog } from './select-product-dialog';
import { SelectCustomerDialog } from './select-customer-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useSettings } from '@/hooks/use-settings';
import { Switch } from '@/components/ui/switch';

type OrderItemState = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  transactionBasePrice: number;
  unitPrice: number;
  originalUnitPrice: number;
  itemDiscount: number;
  totalPrice: number;
  tailorNotes?: string | null;
  measurements?: string | null;
  productCode: string;
  itemTransactionType?: 'Sale' | 'Rental' | null;
};

function NewOrderDialogInner({ order, initialProductId, closeDialog }: { order?: Order, initialProductId?: string, closeDialog: () => void }) {
  const isEditMode = !!order;
  const { appUser } = useUser();
  const { settings } = useSettings();
  const { data: allUsers } = useRtdbList<User>('users');
  const { data: customers } = useRtdbList<Customer>('customers');
  const { data: branches } = useRtdbList<Branch>('branches');
  const { data: allProducts } = useRtdbList<Product>('products');
  const { data: regions } = useRtdbList<Region>('regions');
  
  const dbRTDB = useDatabase();
  const { toast } = useToast();
  
  const [view, setView] = useState<'form' | 'success'>('form');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openShift, setOpenShift] = useState<Shift | null>(null);

  const [branchId, setBranchId] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [regionId, setRegionId] = useState<string>('none');
  const [transactionType, setTransactionType] = useState<string | undefined>();
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [orderItems, setOrderItems] = useState<OrderItemState[]>([]);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState('');
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);

  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  const { permissions } = usePermissions(['orders:apply-discount'] as const);

  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);

  useEffect(() => {
    const findOpenShift = async () => {
        if (!appUser || !dbRTDB) return;
        try {
            const snapshot = await get(ref(dbRTDB, 'shifts'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const found = Object.keys(data)
                    .map(id => ({ ...data[id], id }))
                    .find(s => s.cashier?.id === appUser.id && !s.endTime);
                setOpenShift(found || null);
            }
        } catch (e) {}
    };
    findOpenShift();
  }, [appUser, dbRTDB]);

  useEffect(() => {
    if (isEditMode && order && !originalOrder) {
        setOriginalOrder(JSON.parse(JSON.stringify(order)));
    }
  }, [order, isEditMode, originalOrder]);

  const availableProducts = useMemo(() => {
    if (!branchId) return [];
    return allProducts.filter((p) => p.branchId === branchId || p.showInAllBranches);
  }, [branchId, allProducts]);

  useEffect(() => {
    if (isEditMode && order) {
        setBranchId(order.branchId);
        setCustomerId(order.customerId);
        setRegionId(order.regionId || 'none');
        setTransactionType(order.transactionType);
        setOrderDate(new Date(order.orderDate));
        setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate) : undefined);
        setReturnDate(order.returnDate ? new Date(order.returnDate) : undefined);
        setOrderItems(order.items.map(item => ({
            id: item.productId + Math.random(),
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            transactionBasePrice: (item.priceAtTimeOfOrder + (item.itemDiscount || 0)),
            unitPrice: item.priceAtTimeOfOrder,
            originalUnitPrice: item.originalPrice || item.priceAtTimeOfOrder,
            itemDiscount: item.itemDiscount || 0,
            totalPrice: item.priceAtTimeOfOrder * item.quantity,
            tailorNotes: item.tailorNotes || null,
            measurements: item.measurements || null,
            productCode: item.productCode,
            itemTransactionType: item.itemTransactionType || null,
        })));
        setSellerId(order.sellerId);
        setPaidAmount(order.paid);
        setNotes(order.notes || '');
    } else if (initialProductId) {
        const product = allProducts.find((p) => p.id === initialProductId);
        if (product) {
            setBranchId(product.branchId);
            setTransactionType(product.category === 'rental' ? 'Rental' : product.category === 'sale' ? 'Sale' : undefined);
            setOrderItems([{
                id: Date.now().toString(),
                productId: product.id,
                productName: `${product.name} - ${product.size}`,
                quantity: 1,
                transactionBasePrice: Number(product.price),
                unitPrice: Number(product.price),
                originalUnitPrice: Number(product.price),
                itemDiscount: 0,
                totalPrice: Number(product.price),
                productCode: product.productCode,
            }]);
        }
    } else {
        setBranchId(appUser?.branchId && appUser.branchId !== 'all' ? appUser.branchId : undefined);
    }
  }, [order, isEditMode, initialProductId, allProducts, appUser]);

  const totalOrderAmount = useMemo(() => Math.round(orderItems.reduce((sum, item) => sum + item.totalPrice, 0)), [orderItems]);
  const totalDiscounts = useMemo(() => Math.round(orderItems.reduce((sum, item) => sum + (item.itemDiscount * item.quantity), 0)), [orderItems]);
  const remainingAmount = useMemo(() => Math.round(totalOrderAmount - paidAmount), [totalOrderAmount, paidAmount]);

  const handleUpdateItem = (id: string, updates: Partial<OrderItemState>) => {
      setOrderItems(prev => prev.map(item => {
          if (item.id !== id) return item;
          const newItem = { ...item, ...updates };
          if ('transactionBasePrice' in updates || 'itemDiscount' in updates) {
              newItem.unitPrice = newItem.transactionBasePrice - newItem.itemDiscount;
          } else if ('unitPrice' in updates) {
              newItem.transactionBasePrice = newItem.unitPrice + newItem.itemDiscount;
          }
          newItem.totalPrice = newItem.unitPrice * newItem.quantity;
          return newItem;
      }));
  };

  const handleSaveOrder = async () => {
    if (isSaving) return;
    if (!branchId || !customerId || !transactionType || !sellerId || orderItems.length === 0 || !appUser) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة' });
        return;
    }

    if (!isEditMode && !openShift) {
        setShowStartShiftDialog(true);
        return;
    }

    setIsSaving(true);
    const nowISO = new Date().toISOString();
    const datePath = isEditMode ? (order!.datePath || format(new Date(order!.orderDate), 'yyyy-MM-dd')) : format(new Date(), 'yyyy-MM-dd');

    const cleanedItems = orderItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        priceAtTimeOfOrder: item.unitPrice,
        originalPrice: item.originalUnitPrice,
        itemDiscount: item.itemDiscount,
        productCode: item.productCode,
        tailorNotes: item.tailorNotes || null,
        measurements: item.measurements || null,
        itemTransactionType: item.itemTransactionType || null,
    }));

    const region = regions.find(r => r.id === regionId);
    const customer = customers.find(c => c.id === customerId);

    const orderData: any = {
        branchId,
        customerId,
        customerPhone: customer?.primaryPhone || '',
        regionId: regionId === 'none' ? null : regionId,
        regionName: region ? region.name : null,
        transactionType,
        sellerId,
        total: totalOrderAmount,
        paid: paidAmount,
        remainingAmount,
        discountAmount: totalDiscounts,
        shiftId: isEditMode ? (order?.shiftId || null) : (openShift?.id || null),
        shiftCode: isEditMode ? (order?.shiftCode || null) : (openShift?.shiftCode || null),
        customerName: customer?.name || '',
        branchName: branches.find(b => b.id === branchId)?.name || '',
        sellerName: allUsers.find(u => u.id === sellerId)?.fullName || '',
        processedByUserId: isEditMode ? (order?.processedByUserId || appUser.id) : appUser.id,
        processedByUserName: isEditMode ? (order?.processedByUserName || appUser.fullName) : appUser.fullName,
        orderDate: formatISO(orderDate || new Date()),
        deliveryDate: deliveryDate ? formatISO(deliveryDate) : null,
        returnDate: returnDate ? formatISO(returnDate) : null,
        status: order?.status || 'Pending',
        items: cleanedItems,
        updatedAt: nowISO,
        notes: notes || null,
        datePath
    };

    if (paidAmount > 0) {
        orderData.payments = {
            "initial-payment": {
                id: "initial-payment",
                amount: paidAmount,
                method: paymentMethod,
                date: nowISO,
                userId: appUser.id,
                userName: appUser.fullName,
                shiftId: orderData.shiftId
            }
        };
    }

    if (isImmediateDelivery && transactionType === 'Sale') {
        orderData.status = 'Delivered to Customer';
        orderData.deliveryDate = orderData.orderDate;
        orderData.deliveredAt = nowISO;
        orderData.deliveryEmployeeId = appUser.id;
        orderData.deliveryEmployeeName = appUser.fullName;
    }

    try {
        const activeShiftId = isEditMode ? order?.shiftId : openShift?.id;
        if (activeShiftId) {
            const shiftRef = ref(dbRTDB, `shifts/${activeShiftId}`);
            const paidDelta = isEditMode ? (paidAmount - (originalOrder?.paid || 0)) : paidAmount;
            const discountDelta = isEditMode ? (totalDiscounts - (originalOrder?.discountAmount || 0)) : totalDiscounts;
            
            await runTransaction(shiftRef, (s) => {
                if (s) {
                    if (paymentMethod === 'Vodafone Cash') s.vodafoneCash = (Number(s.vodafoneCash) || 0) + paidDelta;
                    else if (paymentMethod === 'InstaPay') s.instaPay = (Number(s.instaPay) || 0) + paidDelta;
                    else if (paymentMethod === 'Visa') s.visa = (Number(s.visa) || 0) + paidDelta;
                    else s.cash = (Number(s.cash) || 0) + paidDelta;

                    s.discounts = (Number(s.discounts) || 0) + discountDelta;
                    
                    if (isEditMode && originalOrder) {
                        if (originalOrder.transactionType === 'Sale') s.salesTotal = (Number(s.salesTotal) || 0) - originalOrder.total;
                        else s.rentalsTotal = (Number(s.rentalsTotal) || 0) - originalOrder.total;
                    }
                    
                    if (transactionType === 'Sale') s.salesTotal = (Number(s.salesTotal) || 0) + totalOrderAmount;
                    else s.rentalsTotal = (Number(s.rentalsTotal) || 0) + totalOrderAmount;
                    
                    s.updatedAt = nowISO;
                }
                return s;
            });
        }

        for (const newItem of cleanedItems) {
            const pRef = ref(dbRTDB, `products/${newItem.productId}`);
            await runTransaction(pRef, p => {
                if (p) {
                    if (isEditMode && originalOrder) {
                        const oldItem = originalOrder.items.find(oi => oi.productId === newItem.productId);
                        if (oldItem) {
                            p.quantityInStock = (p.quantityInStock || 0) + oldItem.quantity;
                            if ((oldItem.itemTransactionType || originalOrder.transactionType) === 'Sale') {
                                p.quantitySold = Math.max(0, (p.quantitySold || 0) - oldItem.quantity);
                            } else {
                                p.quantityRented = Math.max(0, (p.quantityRented || 0) - oldItem.quantity);
                            }
                        }
                    }
                    p.quantityInStock = (p.quantityInStock || 0) - newItem.quantity;
                    if ((newItem.itemTransactionType || transactionType) === 'Sale') {
                        p.quantitySold = (p.quantitySold || 0) + newItem.quantity;
                    } else {
                        p.quantityRented = (p.quantityRented || 0) + newItem.quantity;
                        p.rentalCount = (p.rentalCount || 0) + newItem.quantity;
                    }
                    p.updatedAt = nowISO;
                }
                return p;
            });
        }

        const updates: any = {};
        if (isEditMode) {
            updates[`daily-entries/${datePath}/orders/${order!.id}`] = orderData;
        } else {
            const counterRef = ref(dbRTDB, 'counters/orders');
            const res = await runTransaction(counterRef, c => { if (!c) return { value: 70000001 }; c.value++; return c; });
            orderData.orderCode = res.snapshot.val().value.toString();
            const newRef = push(ref(dbRTDB, `daily-entries/${datePath}/orders`));
            orderData.id = newRef.key;
            updates[`daily-entries/${datePath}/orders/${orderData.id}`] = orderData;
        }
        
        updates[`daily-entries/${datePath}/updatedAt`] = nowISO;
        await update(ref(dbRTDB), updates);

        if (!isEditMode) {
            setLastOrder(orderData);
            setView('success');
        } else {
            toast({ title: "تم تحديث الطلب" });
            closeDialog();
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  if (view === 'success') {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">تم حفظ الطلب بنجاح!</p>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg w-full max-w-sm">
                <p className="font-bold text-foreground">العميل: {lastOrder?.customerName}</p>
                <p>رقم الطلب: {lastOrder?.orderCode}</p>
            </div>
            <div className="flex gap-2 mt-4">
                {lastOrder && <PrintCashierReceiptDialog order={lastOrder} trigger={<Button className="gap-2"><Printer className="h-4 w-4"/> طباعة الإيصال</Button>} />}
            </div>
            <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
        </div>
      )
  }

  return (
    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4" dir="rtl">
        <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
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
                    <Label className="flex items-center gap-1"><MapPin className="h-3 w-3"/> المنطقة</Label>
                    <Select value={regionId} onValueChange={setRegionId}>
                        <SelectTrigger><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">غير محدد</SelectItem>
                            {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
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
                        <SelectTrigger><SelectValue placeholder="اختر البائع"/></SelectTrigger>
                        <SelectContent>{allUsers.filter(u => u.isActive).map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {transactionType === 'Sale' && !isEditMode && (
                    <div className="flex items-center space-x-2 space-x-reverse border rounded-md p-2 bg-primary/5 border-primary/20">
                        <Switch id="immediate-delivery" checked={isImmediateDelivery} onCheckedChange={setIsImmediateDelivery} />
                        <Label htmlFor="immediate-delivery" className="font-bold cursor-pointer">تسليم فوري</Label>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>تاريخ الطلب</Label>
                    <DatePickerDialog value={orderDate} onValueChange={setOrderDate} />
                </div>
                {!isImmediateDelivery && (
                    <div className="flex flex-col gap-2">
                        <Label>تاريخ التسليم</Label>
                        <DatePickerDialog value={deliveryDate} onValueChange={setDeliveryDate} fromDate={orderDate} />
                    </div>
                )}
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
                            <div className="col-span-12 lg:col-span-4">
                                <SelectProductDialog products={availableProducts} onProductSelected={p => {
                                    const prod = allProducts.find(x => x.id === p);
                                    if(prod) handleUpdateItem(item.id, { 
                                        productId: prod.id, 
                                        productName: `${prod.name} - ${prod.size}`, 
                                        transactionBasePrice: Number(prod.price),
                                        originalUnitPrice: Number(prod.price),
                                        productCode: prod.productCode 
                                    });
                                }} selectedProductId={item.productId} disabled={!branchId} />
                            </div>
                            <div className="col-span-3 lg:col-span-1">
                                <Label className="text-[10px]">الكمية</Label>
                                <Input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })} />
                            </div>
                            <div className="col-span-3 lg:col-span-2">
                                <Label className="text-[10px] text-primary">سعر المعاملة</Label>
                                <Input type="number" value={item.transactionBasePrice} onChange={e => handleUpdateItem(item.id, { transactionBasePrice: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="col-span-3 lg:col-span-2">
                                <Label className="text-[10px] text-green-600">الخصم</Label>
                                <Input type="number" value={item.itemDiscount} onChange={e => handleUpdateItem(item.id, { itemDiscount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="col-span-3 lg:col-span-2">
                                <Label className="text-[10px]">الصافي</Label>
                                <Input readOnly className="bg-muted font-bold" value={item.unitPrice.toLocaleString()} />
                            </div>
                            <div className="col-span-12 lg:col-span-1">
                                <Button variant="destructive" size="icon" onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    </div>
                ))}
                <Button variant="outline" onClick={() => setOrderItems(prev => [...prev, { id: Date.now().toString(), productId: '', productName: '', quantity: 1, transactionBasePrice: 0, unitPrice: 0, originalUnitPrice: 0, itemDiscount: 0, totalPrice: 0, productCode: '' }])}>إضافة صنف</Button>
            </CardContent>
        </Card>

        <Card>
            <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>المبلغ المدفوع</Label>
                        <Input type="number" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                        <Label>طريقة الدفع</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash">نقداً (Cash)</SelectItem>
                                <SelectItem value="Vodafone Cash">فودافون كاش</SelectItem>
                                <SelectItem value="InstaPay">إنستا باي (InstaPay)</SelectItem>
                                <SelectItem value="Visa">فيزا (Visa)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between font-bold text-xl text-primary border-t pt-2">
                        <span>الصافي المطلوب:</span>
                        <span className="font-mono">{totalOrderAmount.toLocaleString()} ج.م</span>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Button onClick={handleSaveOrder} className="w-full h-12 text-lg" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isEditMode ? 'تحديث الطلب' : 'حفظ الطلب'}
        </Button>
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
