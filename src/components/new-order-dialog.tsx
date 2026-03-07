
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  Trash2,
  Calendar as CalendarIcon,
  Scissors,
  CheckCircle,
  Printer,
  FilePlus,
  Ruler,
  Save,
  BadgePercent,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Product, User, Order, Branch, Customer, Counter, Shift, StockMovement } from '@/lib/definitions';
import { Textarea } from '@/components/ui/textarea';
import { format, formatISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser, useDatabase } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, runTransaction, get, update } from 'firebase/database';
import { PrintCashierReceiptDialog } from './print-cashier-receipt-dialog';
import { Alert, AlertDescription } from './ui/alert';
import { DatePickerDialog } from './ui/date-picker-dialog';
import { SelectProductDialog } from './select-product-dialog';
import { SelectCustomerDialog } from './select-customer-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncManager } from '@/providers/sync-provider';
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

type NewOrderDialogProps = {
    trigger: React.ReactNode;
    order?: Order;
    productId?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

function NewOrderDialogInner({ order, initialProductId, closeDialog }: { order?: Order, initialProductId?: string, closeDialog: () => void }) {
  const isEditMode = !!order;
  const { appUser } = useUser();
  const { settings } = useSettings();
  const { data: allUsers, isLoading: usersLoading } = useRtdbList<User>('users');
  const { data: customers, isLoading: customersLoading } = useRtdbList<Customer>('customers');
  const { data: isLoadingBranches } = useRtdbList<Branch>('branches');
  const { data: allProducts, isLoading: productsLoading } = useRtdbList<Product>('products');
  const { data: shifts, isLoading: shiftsLoading } = useRtdbList<Shift>('shifts');
  const { data: counters, isLoading: countersLoading } = useRtdbList<Counter>('counters');
  const { data: allOrders, isLoading: ordersLoading } = useRtdbList<Order>('daily-entries');
  const { isOnline } = useSyncManager();

  const isLoading = usersLoading || customersLoading || !isLoadingBranches || productsLoading || shiftsLoading || countersLoading || ordersLoading;
  
  const dbRTDB = useDatabase();
  const { toast } = useToast();
  
  const [view, setView] = useState<'form' | 'success'>('form');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [shouldPrint, setShouldPrint] = useState(false);

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
    if (date) {
        const startOfOrderDate = startOfDay(date);
        if (deliveryDate && isBefore(startOfDay(deliveryDate), startOfOrderDate)) {
            setDeliveryDate(undefined);
            setReturnDate(undefined);
        }
        if (returnDate && isBefore(startOfDay(returnDate), startOfOrderDate)) {
            setReturnDate(undefined);
        }
    }
  };

  const handleDeliveryDateChange = (date?: Date) => {
    setDeliveryDate(date);
    if (date) {
        const startOfDelivery = startOfDay(date);
        if (returnDate && isBefore(startOfDay(returnDate), startOfDelivery)) {
            setReturnDate(undefined);
        }
    }
  };

  useEffect(() => {
    if (transactionType === 'Sale' && !isEditMode && !deliveryDate) {
      setDeliveryDate(new Date());
    }
  }, [transactionType, isEditMode, deliveryDate]);

  const availableProducts = useMemo(() => {
    if (!branchId) return [];
    const branchProducts = allProducts.filter((p) => p.branchId === branchId || p.showInAllBranches);
    if (!transactionType) return branchProducts;
    return branchProducts.filter(p => {
      if (!p.category) return false;
      if (transactionType === 'Rental') return p.category === 'rental' || p.category === 'both';
      if (transactionType === 'Sale') return p.category === 'sale' || p.category === 'both';
      return true;
    });
  }, [branchId, allProducts, transactionType]);

  useEffect(() => {
    if (isEditMode && order) {
        setBranchId(order.branchId);
        setCustomerId(order.customerId);
        setTransactionType(order.transactionType);
        setOrderDate(new Date(order.orderDate));
        setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate) : undefined);
        setReturnDate(order.returnDate ? new Date(order.returnDate) : undefined);
        setOrderItems(order.items.map(item => {
            const catalogProduct = allProducts.find(p => p.id === item.productId);
            return {
                id: item.productId + Math.random(),
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.priceAtTimeOfOrder,
                originalUnitPrice: item.originalPrice || (catalogProduct ? Math.round(Number(catalogProduct.price) || 0) : item.priceAtTimeOfOrder),
                totalPrice: item.priceAtTimeOfOrder * item.quantity,
                tailorNotes: item.tailorNotes,
                measurements: item.measurements,
                productCode: item.productCode,
                itemTransactionType: item.itemTransactionType,
                currentStock: catalogProduct ? (catalogProduct.quantityInStock - catalogProduct.quantityRented) : 999,
            };
        }));
        setSellerId(order.sellerId);
        setPaidAmount(order.paid);
        setDiscount(order.discountAmount || 0);
        setNotes(order.notes || '');
    } else if (initialProductId && !isLoading) {
        const product = allProducts.find((p) => p.id === initialProductId);
        if (product) {
            setBranchId(product.branchId);
            setTransactionType(product.category === 'rental' ? 'Rental' : product.category === 'sale' ? 'Sale' : undefined);
            setSellerId(appUser?.id);
            const price = Math.round(Number(product.price) || 0);
            setOrderItems([{
                id: Date.now().toString(),
                productId: product.id,
                productName: `${product.name} - مقاس ${product.size} (${product.productCode})`,
                quantity: 1,
                unitPrice: price,
                originalUnitPrice: price,
                totalPrice: price,
                productCode: product.productCode,
                currentStock: product.quantityInStock - product.quantityRented,
            }]);
        }
    } else {
        setBranchId(appUser?.branchId && appUser.branchId !== 'all' ? appUser.branchId : undefined);
        setSellerId(appUser?.id);
    }
  }, [order, isEditMode, initialProductId, isLoading, allProducts, appUser]);

  const handleProductChange = (id: string, productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    const newItems = [...orderItems];
    const itemIndex = newItems.findIndex(item => item.id === id);
    if (itemIndex === -1 || !product) return;

    if (!transactionType) {
        setTransactionType(product.category === 'rental' ? 'Rental' : product.category === 'sale' ? 'Sale' : undefined);
    }
    
    const price = Math.round(Number(product.price) || 0);
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      productId: product.id,
      productName: `${product.name} - مقاس ${product.size}`,
      unitPrice: price,
      originalUnitPrice: price,
      totalPrice: Math.round((newItems[itemIndex].quantity || 1) * price),
      productCode: product.productCode,
      itemTransactionType: product.category === 'both' ? transactionType as any : null,
      currentStock: product.quantityInStock - product.quantityRented,
    };
    setOrderItems(newItems);
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setOrderItems(prev => prev.map(item => item.id === id ? { ...item, quantity, totalPrice: Math.round(quantity * item.unitPrice) } : item));
  };

  const handleUnitPriceChange = (id: string, newUnitPrice: number) => {
    const item = orderItems.find(i => i.id === id);
    if (item && newUnitPrice < item.originalUnitPrice) {
        toast({
            variant: "destructive",
            title: "تنبيه",
            description: "غير مسموح ب النزول عن السعر الأصلي",
        });
    }
    setOrderItems(prev => prev.map(item => item.id === id ? { ...item, unitPrice: newUnitPrice, totalPrice: Math.round(item.quantity * newUnitPrice) } : item));
  };

  const handleTailorInfoChange = (id: string, field: 'measurements' | 'tailorNotes', value: string) => {
    setOrderItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const subtotal = useMemo(() => Math.round(orderItems.reduce((sum, item) => sum + item.totalPrice, 0)), [orderItems]);
  const totalOrderAmount = useMemo(() => Math.round(subtotal - discount), [subtotal, discount]);
  const remainingAmount = useMemo(() => Math.round(totalOrderAmount - paidAmount), [totalOrderAmount, paidAmount]);

  const handleSaveOrder = async ({ shouldDeliver = false, shouldPrintReceipt = false } = {}) => {
    if (!branchId || !customerId || !transactionType || !sellerId || orderItems.length === 0 || !appUser) {
        toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى التأكد من ملء جميع الحقول المطلوبة واختيار صنف واحد على الأقل.' });
        return;
    }

    if (orderDate && deliveryDate) {
        if (isAfter(startOfDay(orderDate), startOfDay(deliveryDate))) {
            toast({ variant: 'destructive', title: 'خطأ في التواريخ', description: 'تاريخ التسليم المتوقع لا يمكن أن يكون قبل تاريخ الطلب.' });
            return;
        }
    }

    if (deliveryDate && returnDate) {
        if (isAfter(startOfDay(deliveryDate), startOfDay(returnDate))) {
            toast({ variant: 'destructive', title: 'خطأ في التواريخ', description: 'تاريخ الإرجاع لا يمكن أن يكون قبل تاريخ التسليم.' });
            return;
        }
    }

    // New restriction: Price cannot be lower than original
    if (orderItems.some(item => item.unitPrice < item.originalUnitPrice)) {
        toast({
            variant: "destructive",
            title: "خطأ في الأسعار",
            description: "غير مسموح ب النزول عن السعر الأصلي للأصناف. يرجى مراجعة الأسعار.",
        });
        return;
    }

    let openShiftId: string | null = null;
    if (paidAmount > 0 && !isEditMode) {
        const openShift = shifts.find(s => s.cashier.id === appUser.id && !s.endTime);
        if (!openShift) {
            setShowStartShiftDialog(true);
            return;
        }
        openShiftId = openShift.id;
        
        try {
            await update(ref(dbRTDB, `shifts/${openShiftId}`), {
                cash: (openShift.cash || 0) + paidAmount,
                [transactionType === 'Sale' ? 'salesTotal' : 'rentalsTotal']: (openShift[transactionType === 'Sale' ? 'salesTotal' : 'rentalsTotal'] || 0) + totalOrderAmount
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل تحديث الوردية', description: e.message });
            return;
        }
    }

    const orderData: any = {
        branchId, customerId, transactionType, sellerId, total: totalOrderAmount, paid: paidAmount, remainingAmount, discountAmount: discount,
        customerName: customers.find(c => c.id === customerId)?.name || '',
        branchName: isLoadingBranches.find(b => b.id === branchId)?.name || '',
        sellerName: allUsers.find(u => u.id === sellerId)?.fullName || '',
        orderDate: formatISO(orderDate || new Date()),
        deliveryDate: deliveryDate ? formatISO(deliveryDate) : null,
        returnDate: returnDate ? formatISO(returnDate) : null,
        status: shouldDeliver ? 'Delivered to Customer' : (order?.status || 'Pending'),
        items: orderItems.map(({ id, ...item }) => ({ ...item, priceAtTimeOfOrder: item.unitPrice, originalPrice: item.originalUnitPrice })),
        updatedAt: new Date().toISOString(),
        notes: notes,
    };

    try {
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
                if (!item.productId) continue;
                const pRef = ref(dbRTDB, `products/${item.productId}`);
                await runTransaction(pRef, p => {
                    if (p) {
                        p.quantityInStock -= item.quantity;
                        if ((item.itemTransactionType || transactionType) === 'Sale') p.quantitySold += item.quantity;
                        else { p.quantityRented += item.quantity; p.rentalCount += item.quantity; }
                    }
                    return p;
                });
            }
        }
        setLastOrder(orderData);
        setShouldPrint(shouldPrintReceipt);
        setView('success');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: e.message });
    }
  };

  if (view === 'success') {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">تم {isEditMode ? 'تعديل' : 'إنشاء'} الطلب بنجاح!</p>
            <div className="flex gap-2 mt-4">
                {lastOrder && <PrintCashierReceiptDialog order={lastOrder} trigger={<Button className="gap-2"><Printer className="h-4 w-4"/> طباعة الإيصال</Button>} shouldOpenOnMount={shouldPrint} />}
            </div>
            <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
        </div>
      )
  }

  return (
    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4 pl-1">
        {showStartShiftDialog && appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات العميل والمعاملة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>الفرع</Label>
                    <Select value={branchId} onValueChange={setBranchId} disabled={!!appUser?.branchId && appUser.branchId !== 'all'}>
                        <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                        <SelectContent>{isLoadingBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
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
                        <SelectContent>{allUsers.filter(u => u.role !== 'cashier').map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">التواريخ والمواعيد</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>تاريخ الطلب</Label>
                    <DatePickerDialog value={orderDate} onValueChange={handleOrderDateChange} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>تاريخ التسليم المتوقع</Label>
                    <DatePickerDialog value={deliveryDate} onValueChange={handleDeliveryDateChange} fromDate={orderDate} />
                </div>
                {transactionType === 'Rental' && (
                    <div className="flex flex-col gap-2">
                        <Label>تاريخ الإرجاع المتوقع</Label>
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
                                <SelectProductDialog products={availableProducts} onProductSelected={p => handleProductChange(item.id, p)} selectedProductId={item.productId} disabled={!branchId} />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                                <Input type="number" value={item.quantity} onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 1)} min="1" />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Label className="text-[10px] text-muted-foreground">السعر</Label>
                                <Input 
                                    type="number" 
                                    value={item.unitPrice} 
                                    onChange={e => handleUnitPriceChange(item.id, parseFloat(e.target.value) || 0)}
                                    className={cn(item.unitPrice < item.originalUnitPrice && "border-destructive focus-visible:ring-destructive")}
                                />
                            </div>
                            <div className="col-span-4 lg:col-span-2">
                                <Button variant="destructive" size="icon" onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                        
                        {/* Tailor Info Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 bg-muted/30 p-2 rounded-md">
                            <div className="space-y-1">
                                <Label className="text-[10px] flex items-center gap-1"><Ruler className="h-3 w-3"/> القياسات</Label>
                                <Input 
                                    placeholder="مثال: طول 140، صدر 90..." 
                                    value={item.measurements || ''} 
                                    onChange={e => handleTailorInfoChange(item.id, 'measurements', e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] flex items-center gap-1"><Scissors className="h-3 w-3"/> ملاحظات الخياط</Label>
                                <Input 
                                    placeholder="مثال: تضييق من الجوانب..." 
                                    value={item.tailorNotes || ''} 
                                    onChange={e => handleTailorInfoChange(item.id, 'tailorNotes', e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                ))}
                <Button variant="outline" onClick={() => setOrderItems(prev => [...prev, { id: Date.now().toString(), productId: '', productName: '', quantity: 1, unitPrice: 0, originalUnitPrice: 0, totalPrice: 0, productCode: '', currentStock: 0 }])}>إضافة صنف</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-sm">ملاحظات ومالية</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div className="flex flex-col gap-2">
                    <Label>ملاحظات الطلب</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="اكتب أي ملاحظات إضافية هنا..." rows={2} />
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>إجمالي الأصناف:</span> <span>{subtotal.toLocaleString()} ج.م</span></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>المدفوع حالياً</Label><Input type="number" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} /></div>
                    <div className="space-y-2"><Label>الخصم</Label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} disabled={!permissions.canOrdersApplyDiscount} /></div>
                </div>
                <div className="flex justify-between font-bold text-xl text-primary border-t pt-4">
                    <span>إجمالي النهائي:</span>
                    <span>{totalOrderAmount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>المتبقي:</span>
                    <span className={cn(remainingAmount > 0 ? "text-destructive font-bold" : "text-green-600 font-bold")}>
                        {remainingAmount.toLocaleString()} ج.م
                    </span>
                </div>
            </CardContent>
        </Card>
        <Button onClick={() => handleSaveOrder()} className="w-full h-12 text-lg">حفظ الطلب</Button>
    </div>
  );
}

export function NewOrderDialog({ trigger, order, productId, open: externalOpen, onOpenChange: externalOnOpenChange }: NewOrderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  
  const setOpen = (val: boolean) => {
      if (externalOnOpenChange) externalOnOpenChange(val);
      else setInternalOpen(val);
      if (!val) {
          setTimeout(() => {
              document.body.style.pointerEvents = 'auto';
              document.body.style.overflow = '';
          }, 100);
      }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
            <DialogTitle>{order ? `تعديل طلب ${order.orderCode}` : 'إنشاء طلب جديد'}</DialogTitle>
            <DialogDescription>أكمل بيانات الطلب لحفظه في النظام.</DialogDescription>
        </DialogHeader>
        {open && <NewOrderDialogInner order={order} initialProductId={productId} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
