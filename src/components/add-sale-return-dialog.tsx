"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, SaleReturn, Product, StockMovement, Counter, Shift, Expense } from '@/lib/definitions';
import { useDatabase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, get, runTransaction, update } from 'firebase/database';
import { format } from 'date-fns';
import { Search, Undo2, BadgePercent, DollarSign, AlertCircle, CheckCircle2, Info, Loader2, ShieldAlert, Clock } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';


type SaleReturnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleReturn?: SaleReturn;
};

// State structure for selected items with their specific refund price
type SelectedItemState = {
    quantity: number;
    refundPrice: number;
};

export function AddSaleReturnDialog({ open, onOpenChange, saleReturn }: SaleReturnDialogProps) {
  const isViewMode = !!saleReturn;
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  
  const [orderCode, setOrderCode] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [isOrderAlreadyReturned, setIsOrderAlreadyReturned] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemState>>({});
  const [refundAmount, setRefundAmount] = useState(0);
  const [returnDate, setReturnDate] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  const { data: counters, isLoading: countersLoading } = useRtdbList<Counter>('counters');
  const { data: allSaleReturns, isLoading: returnsLoading } = useRtdbList<SaleReturn>('saleReturns');
  const { data: shifts } = useRtdbList<Shift>('shifts');

  // Filter open shifts
  const openShifts = useMemo(() => shifts.filter(s => !s.endTime), [shifts]);

  useEffect(() => {
    if (!open) {
      setOrderCode('');
      setFoundOrder(null);
      setIsOrderAlreadyReturned(false);
      setSelectedItems({});
      setRefundAmount(0);
      setReturnDate(new Date());
      setIsSaving(false);
      setIsSearching(false);
      setSelectedShiftId('');
    } else if (isViewMode && saleReturn) {
      setOrderCode(saleReturn.orderCode);
      const itemsToSelect: Record<string, SelectedItemState> = {};
      saleReturn.items.forEach(item => {
        itemsToSelect[item.productId] = {
            quantity: item.quantity,
            refundPrice: item.priceAtTimeOfOrder
        };
      });
      setSelectedItems(itemsToSelect);
      setRefundAmount(saleReturn.refundAmount);
      setReturnDate(new Date(saleReturn.returnDate));
      setSelectedShiftId(saleReturn.shiftId || '');
    }
  }, [open, isViewMode, saleReturn]);

  // Auto-select current user's shift if available
  useEffect(() => {
    if (open && !isViewMode && openShifts.length > 0 && !selectedShiftId) {
        const myShift = openShifts.find(s => s.cashier.id === appUser?.id);
        if (myShift) setSelectedShiftId(myShift.id);
    }
  }, [open, isViewMode, openShifts, appUser, selectedShiftId]);

  const handleSearchOrder = async () => {
    if (!orderCode) return;
    setIsSearching(true);
    setFoundOrder(null);
    setIsOrderAlreadyReturned(false);

    try {
        // 1. Check if this order already has a return record
        const alreadyReturned = allSaleReturns.find(sr => sr.orderCode.trim().toLowerCase() === orderCode.trim().toLowerCase());
        if (alreadyReturned) {
            setIsOrderAlreadyReturned(true);
            toast({ 
                variant: 'destructive', 
                title: 'عذراً، لا يمكن المتابعة', 
                description: `تم عمل مرتجع سابق لهذه الفاتورة برقم (${alreadyReturned.returnCode}). النظام يسمح بمرتجع واحد فقط لكل فاتورة.` 
            });
            setIsSearching(false);
            return;
        }

        const dailyEntriesRef = ref(db, 'daily-entries');
        const snapshot = await get(dailyEntriesRef);

        if (snapshot.exists()) {
            const dailyEntries = snapshot.val();
            let orderFound: Order | null = null;
            let orderDatePath: string | null = null;

            for (const dateKey in dailyEntries) {
                const ordersForDate = dailyEntries[dateKey].orders;
                if (ordersForDate) {
                    for (const orderKey in ordersForDate) {
                        if (ordersForDate[orderKey].orderCode === orderCode) {
                            orderFound = { ...ordersForDate[orderKey], id: orderKey };
                            orderDatePath = dateKey;
                            break;
                        }
                    }
                }
                if (orderFound) break;
            }
            
            if (orderFound) {
                if (orderFound.status === 'Cancelled') {
                    toast({ variant: 'destructive', title: 'طلب ملغي', description: 'لا يمكن عمل مرتجع لطلب ملغي بالفعل.' });
                } else if (orderFound.transactionType !== 'Sale') {
                    toast({ variant: 'destructive', title: 'طلب غير صالح', description: 'هذا الطلب هو طلب إيجار، المرتجعات تتم من شاشة استلام المرتجعات.' });
                } else {
                    setFoundOrder({...orderFound, orderDate: orderDatePath! });
                }
            } else {
                toast({ variant: 'destructive', title: 'لم يتم العثور على الطلب', description: 'الرجاء التأكد من كود الطلب الصحيح.' });
            }
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في البحث', description: e.message });
    } finally {
        setIsSearching(false);
    }
  };
  
  const handleItemQuantityChange = (productId: string, newQuantity: number) => {
    const originalItem = foundOrder?.items.find(i => i.productId === productId);
    if (!originalItem) return;

    const maxReturnable = originalItem.quantity;
    const validQuantity = Math.max(0, Math.min(newQuantity, maxReturnable));

    const currentItem = selectedItems[productId] || { quantity: 0, refundPrice: originalItem.priceAtTimeOfOrder };
    
    const newSelectedItems = { 
        ...selectedItems, 
        [productId]: { ...currentItem, quantity: validQuantity } 
    };

    if (validQuantity === 0) {
        delete newSelectedItems[productId];
    }
    setSelectedItems(newSelectedItems);
  };

  const handleItemPriceChange = (productId: string, newPrice: number) => {
    const originalItem = foundOrder?.items.find(i => i.productId === productId);
    if (!originalItem) return;

    const currentItem = selectedItems[productId] || { quantity: 0, refundPrice: originalItem.priceAtTimeOfOrder };
    
    setSelectedItems({
        ...selectedItems,
        [productId]: { ...currentItem, refundPrice: newPrice }
    });
  };

  useEffect(() => {
    if (foundOrder) {
      const totalRefund = Object.keys(selectedItems).reduce((acc, productId) => {
        const itemState = selectedItems[productId];
        return acc + (itemState.refundPrice * itemState.quantity);
      }, 0);
      setRefundAmount(totalRefund);
    }
  }, [selectedItems, foundOrder]);

  const getNextReturnCode = useCallback(async () => {
    const counterRef = ref(db, 'counters/saleReturns');
    let nextCode = '';

    try {
        const result = await runTransaction(counterRef, (currentData) => {
            if (currentData === null) return { name: 'saleReturns', prefix: 'SR', value: 1001 };
            currentData.value++;
            return currentData;
        });
        if (result.committed) {
            const counter = result.snapshot.val();
            nextCode = `${counter.prefix}${counter.value}`;
        }
    } catch (error) {
        console.error("Transaction failed: ", error);
    }
    return nextCode;
  }, [db]);


  const handleSave = async () => {
    if (!foundOrder || Object.keys(selectedItems).length === 0 || !appUser) {
        toast({ variant: 'destructive', title: 'بيانات غير كاملة' });
        return;
    }

    const openShift = openShifts.find(s => s.id === selectedShiftId);
    if (!openShift) {
        toast({ variant: "destructive", title: "الرجاء اختيار وردية مفتوحة", description: "يجب اختيار الوردية التي سيتم خصم مبلغ المرتجع منها." });
        return;
    }

    setIsSaving(true);

    const returnCode = await getNextReturnCode();
    if (!returnCode) {
        toast({ variant: "destructive", title: "خطأ في توليد الرقم التسلسلي", description: "فشل إنشاء كود المرتجع، يرجى المحاولة مرة أخرى." });
        setIsSaving(false);
        return;
    }
    
    try {
        // --- Update Stock & Order Status ---
        const orderRef = ref(db, `daily-entries/${foundOrder.orderDate}/orders/${foundOrder.id}`);
        
        // Mark as fully returned since we only allow one return operation
        await update(orderRef, { returnStatus: 'fully_returned' });

        for (const productId in selectedItems) {
            const productRef = ref(db, `products/${productId}`);
            const quantityReturned = selectedItems[productId].quantity;
            if (quantityReturned === 0) continue;
            
            await runTransaction(productRef, (currentProduct: Product) => {
                if (currentProduct) {
                    const movementRef = push(ref(db, `products/${productId}/stockMovements`));
                    const quantityBefore = currentProduct.quantityInStock || 0;
                    currentProduct.quantityInStock = quantityBefore + quantityReturned;
                    currentProduct.quantitySold = Math.max(0, (currentProduct.quantitySold || 0) - quantityReturned);

                    const newMovement: StockMovement = {
                        id: movementRef.key!,
                        date: new Date().toISOString(),
                        type: 'return',
                        quantity: quantityReturned,
                        quantityBefore: quantityBefore,
                        quantityAfter: currentProduct.quantityInStock,
                        notes: `مرتجع بيع ${returnCode} من طلب ${foundOrder.orderCode}`,
                        orderCode: foundOrder.orderCode,
                        userId: appUser.id,
                        userName: appUser.fullName,
                    };
                    if (!currentProduct.stockMovements) currentProduct.stockMovements = {};
                    currentProduct.stockMovements[newMovement.id] = newMovement;
                }
                return currentProduct;
            });
        }

        // --- Record Refund as an Expense in the selected Shift ---
        const expenseRef = push(ref(db, 'expenses'));
        const expense: Omit<Expense, 'id'> = {
            description: `مرتجع بيع ${returnCode} للطلب ${foundOrder.orderCode}`,
            amount: refundAmount,
            category: 'مرتجعات بيع',
            date: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            branchId: foundOrder.branchId,
            branchName: foundOrder.branchName,
            shiftId: openShift.id
        };
        await set(expenseRef, expense);

        // Deduct from shift cash
        const currentShiftRef = ref(db, `shifts/${openShift.id}`);
        await runTransaction(currentShiftRef, (currentShift: Shift) => {
            if (currentShift) {
                currentShift.cash = (currentShift.cash || 0) - refundAmount;
                currentShift.refunds = (currentShift.refunds || 0) + refundAmount;
            }
            return currentShift;
        });

        // --- Save the SaleReturn record ---
        const returnedItems = foundOrder.items
            .filter(item => selectedItems[item.productId])
            .map(item => ({ 
                ...item, 
                quantity: selectedItems[item.productId].quantity,
                priceAtTimeOfOrder: selectedItems[item.productId].refundPrice 
            }));

        const saleReturnData: SaleReturn = {
            id: '', 
            returnCode,
            orderId: foundOrder.id,
            orderCode: foundOrder.orderCode,
            returnDate: format(returnDate, 'yyyy-MM-dd'),
            items: returnedItems,
            refundAmount,
            createdAt: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            shiftId: openShift.id,
            shiftCode: openShift.shiftCode
        };

        const newReturnRef = push(ref(db, 'saleReturns'));
        const newId = newReturnRef.key;
        if (!newId) throw new Error("Failed to create sale return ID.");

        await set(newReturnRef, { ...saleReturnData, id: newId });
        
        toast({ title: "تم تسجيل مرتجع البيع بنجاح", description: `رقم المرتجع: ${returnCode}` });
        onOpenChange(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };
  
    function formatDateDisplay(dateString?: string | Date) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('ar-EG', {day: '2-digit', month: '2-digit', year: 'numeric'});
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isViewMode ? `عرض مرتجع بيع ${saleReturn?.returnCode}` : 'إنشاء مرتجع بيع جديد'}</DialogTitle>
          <DialogDescription>
            {isViewMode ? 'تفاصيل عملية الارتجاع المسجلة.' : 'أدخل كود الفاتورة الأصلية واختر الوردية المسؤولة.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[75vh] overflow-y-auto pr-4 pl-1">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-grow space-y-2 w-full">
                <Label htmlFor="orderCode">كود الفاتورة (الطلب)</Label>
                <div className="flex gap-2">
                    <Input
                        id="orderCode"
                        value={orderCode}
                        onChange={(e) => setOrderCode(e.target.value)}
                        disabled={isViewMode || isSearching}
                        placeholder="مثال: 70000001"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder()}
                    />
                    {!isViewMode && (
                        <Button onClick={handleSearchOrder} disabled={isSearching} className="gap-1 h-10 px-6">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            بحث
                        </Button>
                    )}
                </div>
            </div>
            {!isViewMode && foundOrder && (
                <div className="space-y-2 w-full sm:w-[250px]">
                    <Label className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary"/> الوردية المختارة</Label>
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="اختر الوردية" />
                        </SelectTrigger>
                        <SelectContent>
                            {openShifts.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                    وردية {s.cashier.name} ({s.shiftCode || s.id.slice(-4)})
                                </SelectItem>
                            ))}
                            {openShifts.length === 0 && <SelectItem value="none" disabled>لا توجد ورديات مفتوحة</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>
            )}
          </div>
          
          {isOrderAlreadyReturned && (
              <Card className="bg-destructive/10 border-destructive/20">
                  <CardContent className="pt-6 flex flex-col items-center gap-2 text-destructive text-center">
                      <ShieldAlert className="h-10 w-10" />
                      <p className="font-bold">هذه الفاتورة تم عمل مرتجع لها مسبقاً.</p>
                      <p className="text-xs">سياسة النظام تمنع إجراء أكثر من عملية مرتجع واحدة لكل فاتورة لضمان سلامة السجلات المالية.</p>
                  </CardContent>
              </Card>
          )}

          {foundOrder && !isViewMode && (
            <div className="space-y-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-base">بيانات الفاتورة الأصلية</CardTitle>
                                <Badge variant="outline" className="font-mono w-fit">{foundOrder.orderCode}</Badge>
                            </div>
                        </div>
                        <CardDescription className="mt-2">العميل: {foundOrder.customerName} - بتاريخ: {formatDateDisplay(foundOrder.orderDate)}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">إجمالي الفاتورة</p>
                            <p className="font-bold font-mono text-primary">{foundOrder.total.toLocaleString()} ج.م</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">المبلغ المدفوع</p>
                            <p className="font-bold font-mono text-green-600">{foundOrder.paid.toLocaleString()} ج.م</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Label className="text-base font-bold">حدد الأصناف المراد إرجاعها والكميات:</Label>
                    <div className="grid gap-3">
                        {foundOrder.items.map(item => {
                            const isSelected = !!selectedItems[item.productId];

                            return (
                                <div key={item.productId} className={cn(
                                    "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
                                    isSelected ? "border-primary bg-primary/5" : "bg-card"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id={`item-${item.productId}`}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => handleItemQuantityChange(item.productId, checked ? 1 : 0)}
                                        />
                                        <div className="flex-grow">
                                            <Label htmlFor={`item-${item.productId}`} className="font-bold cursor-pointer block">
                                                {item.productName}
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                السعر في الفاتورة: {item.priceAtTimeOfOrder.toLocaleString()} ج.م | الكمية المتاحة: {item.quantity}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {isSelected && (
                                        <div className="grid grid-cols-2 gap-4 mt-2 pr-7 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">الكمية المرتجعة</Label>
                                                <Input 
                                                    type="number" 
                                                    className="h-9"
                                                    value={selectedItems[item.productId].quantity}
                                                    onChange={(e) => handleItemQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                                                    max={item.quantity}
                                                    min={1}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">سعر الارتجاع (للقطعة)</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input 
                                                        type="number" 
                                                        className="h-9 pl-8 text-left font-mono font-bold"
                                                        value={selectedItems[item.productId].refundPrice}
                                                        onChange={(e) => handleItemPriceChange(item.productId, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
          )}

          {isViewMode && saleReturn && (
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">رقم المرتجع التسلسلي</p>
                        <p className="font-mono font-bold text-lg text-primary">{saleReturn.returnCode}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">تاريخ العملية</p>
                        <p className="font-bold">{formatDateDisplay(saleReturn.returnDate)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-primary/10 border border-primary/20 col-span-2">
                        <p className="text-xs text-primary font-bold">الوردية المسؤولة</p>
                        <p className="font-mono font-bold">وردية رقم: {saleReturn.shiftCode || 'غير مسجل'}</p>
                    </div>
                </div>
                <Label className="text-base font-bold">الأصناف التي تم إرجاعها:</Label>
                <div className="space-y-2">
                    {saleReturn.items.map((item, idx) => (
                         <div key={`${item.productId}-${idx}`} className="flex items-center justify-between rounded-md border p-3 bg-card">
                            <div className="space-y-0.5">
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">سعر الارتجاع</p>
                                <p className="font-mono font-bold">{item.priceAtTimeOfOrder.toLocaleString()} ج.م</p>
                            </div>
                         </div>
                    ))}
                </div>
             </div>
          )}

          {(Object.keys(selectedItems).length > 0 || isViewMode) && (
            <div className="mt-4 pt-4 border-t">
                <div className="flex flex-col items-center bg-destructive/5 p-6 rounded-xl border border-destructive/10">
                    <p className="text-sm text-muted-foreground mb-1">إجمالي المبلغ المسترد للعميل</p>
                    <p className="text-4xl font-mono font-black text-destructive">
                        {refundAmount.toLocaleString()} <span className="text-lg">ج.م</span>
                    </p>
                </div>
            </div>
          )}
        </div>
        {!isViewMode && (
            <DialogFooter>
                <Button 
                    onClick={handleSave} 
                    className="w-full h-12 text-lg gap-2"
                    disabled={isSaving || isSearching || isOrderAlreadyReturned || Object.keys(selectedItems).length === 0 || !selectedShiftId}
                >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Undo2 className="h-5 w-5"/>}
                    حفظ المرتجع وتحديث المخزون والوردية
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
