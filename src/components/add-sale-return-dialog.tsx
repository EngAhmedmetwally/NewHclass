
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
import { Search, Undo2, BadgePercent, DollarSign } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { cn } from '@/lib/utils';


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
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemState>>({});
  const [refundAmount, setRefundAmount] = useState(0);
  const [returnDate, setReturnDate] = useState(new Date());

  const { data: counters, isLoading: countersLoading } = useRtdbList<Counter>('counters');
  const { data: allSaleReturns, isLoading: returnsLoading } = useRtdbList<SaleReturn>('saleReturns');

  const previouslyReturnedQuantities = useMemo(() => {
    if (!foundOrder || returnsLoading) return {};
    const returned: Record<string, number> = {};
    
    allSaleReturns
      .filter(sr => sr.orderId === foundOrder.id)
      .forEach(sr => {
        sr.items.forEach(item => {
          returned[item.productId] = (returned[item.productId] || 0) + item.quantity;
        });
      });
      
    return returned;
  }, [foundOrder, allSaleReturns, returnsLoading]);

  useEffect(() => {
    if (!open) {
      setOrderCode('');
      setFoundOrder(null);
      setSelectedItems({});
      setRefundAmount(0);
      setReturnDate(new Date());
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
    }
  }, [open, isViewMode, saleReturn]);

  const handleSearchOrder = async () => {
    if (!orderCode) return;
    setFoundOrder(null);
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
        if (orderFound.transactionType !== 'Sale') {
          toast({ variant: 'destructive', title: 'طلب غير صالح', description: 'هذا الطلب هو طلب إيجار وليس بيع.' });
        } else {
          setFoundOrder({...orderFound, orderDate: orderDatePath! }); // Store date path in orderDate
        }
      } else {
        toast({ variant: 'destructive', title: 'لم يتم العثور على الطلب', description: 'الرجاء التأكد من كود الطلب.' });
      }
    }
  };
  
  const handleItemQuantityChange = (productId: string, newQuantity: number) => {
    const originalItem = foundOrder?.items.find(i => i.productId === productId);
    const alreadyReturned = previouslyReturnedQuantities[productId] || 0;
    if (!originalItem) return;

    const maxReturnable = originalItem.quantity - alreadyReturned;
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
    if (countersLoading) return '';
    const counterRef = ref(db, 'counters/saleReturns');
    let nextCode = '';

    try {
        const { committed, snapshot } = await runTransaction(counterRef, (currentData) => {
            if (currentData === null) return { name: 'saleReturns', prefix: 'SR', value: 1 };
            currentData.value++;
            return currentData;
        });
        if (snapshot.exists()) {
            const counter = snapshot.val();
            nextCode = `${counter.prefix}${counter.value}`;
        } else {
             throw new Error("Could not read counter after transaction abort.");
        }
    } catch (error) {
        console.error("Transaction failed: ", error);
        toast({
            title: "فشل إنشاء كود المرتجع",
            description: "لم يتمكن من الحصول على كود جديد.",
            variant: "destructive"
        });
    }
    return nextCode;
  }, [db, countersLoading, toast]);


  const handleSave = async () => {
    if (!foundOrder || Object.keys(selectedItems).length === 0 || !appUser) {
        toast({ variant: 'destructive', title: 'بيانات غير كاملة' });
        return;
    }

    const returnCode = await getNextReturnCode();
    if (!returnCode) return;
    
    // --- Update Stock & Order Status ---
    const orderRef = ref(db, `daily-entries/${foundOrder.orderDate}/orders/${foundOrder.id}`);
    const updates: any = {};
    let totalReturnedSoFar = 0;

    for (const productId in previouslyReturnedQuantities) {
        totalReturnedSoFar += previouslyReturnedQuantities[productId];
    }
    const currentReturnTotal = Object.values(selectedItems).reduce((sum, item) => sum + item.quantity, 0);
    const totalOriginalItems = foundOrder.items.reduce((sum, item) => sum + item.quantity, 0);

    if (totalReturnedSoFar + currentReturnTotal >= totalOriginalItems) {
        updates.returnStatus = 'fully_returned';
    } else {
        updates.returnStatus = 'partially_returned';
    }
    
    await update(orderRef, updates);


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
                    userId: appUser.id,
                    userName: appUser.fullName,
                };
                 if (!currentProduct.stockMovements) currentProduct.stockMovements = {};
                currentProduct.stockMovements[newMovement.id] = newMovement;
            }
            return currentProduct;
        });
    }

    // --- Record Refund as an Expense in the current Shift ---
    const shiftsRef = ref(db, 'shifts');
    const shiftsSnapshot = await get(shiftsRef);
    let openShiftId: string | null = null;
    
    if (shiftsSnapshot.exists()) {
        const shifts = shiftsSnapshot.val();
        for (const id in shifts) {
            if (shifts[id].cashier?.id === appUser.id && !shifts[id].endTime) {
                openShiftId = id;
                break;
            }
        }
    }

    if (openShiftId) {
        const expenseRef = push(ref(db, 'expenses'));
        const expense: Omit<Expense, 'id'> = {
            description: `مرتجع بيع ${returnCode} للطلب ${foundOrder.orderCode}`,
            amount: refundAmount,
            category: 'مرتجع بيع',
            date: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            branchId: foundOrder.branchId,
            branchName: foundOrder.branchName,
            shiftId: openShiftId
        };
        await set(expenseRef, expense);

        // Deduct from shift cash
        const currentShiftRef = ref(db, `shifts/${openShiftId}`);
        await runTransaction(currentShiftRef, (currentShift: Shift) => {
            if (currentShift) {
                currentShift.cash = (currentShift.cash || 0) - refundAmount;
                currentShift.refunds = (currentShift.refunds || 0) + refundAmount;
            }
            return currentShift;
        });
    } else {
        toast({ title: "تنبيه", description: "لم يتم العثور على وردية مفتوحة. لن يتم خصم المبلغ من الدرج آلياً.", variant: "destructive" });
    }

    // --- Save the SaleReturn record ---
    const returnedItems = foundOrder.items
        .filter(item => selectedItems[item.productId])
        .map(item => ({ 
            ...item, 
            quantity: selectedItems[item.productId].quantity,
            priceAtTimeOfOrder: selectedItems[item.productId].refundPrice 
        }));

    const saleReturnData = {
        returnCode,
        orderId: foundOrder.id,
        orderCode: foundOrder.orderCode,
        returnDate: format(returnDate, 'yyyy-MM-dd'),
        items: returnedItems,
        refundAmount,
        createdAt: new Date().toISOString(),
        userId: appUser.id,
        userName: appUser.fullName,
    };

    const newReturnRef = push(ref(db, 'saleReturns'));
    const newId = newReturnRef.key;
    if (!newId) throw new Error("Failed to create sale return ID.");

    await set(newReturnRef, { ...saleReturnData, id: newId });
    
    toast({ title: "تم تسجيل مرتجع البيع بنجاح" });
    onOpenChange(false);
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
          <DialogTitle>{isViewMode ? `عرض مرتجع بيع ${saleReturn?.returnCode}` : 'إنشاء مرتجع بيع'}</DialogTitle>
          <DialogDescription>
            {isViewMode ? 'تفاصيل المرتجع.' : 'ابحث عن الطلب الأصلي لتسجيل مرتجع بيع.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[75vh] overflow-y-auto pr-4 pl-1">
          <div className="flex gap-2 items-end">
            <div className="flex-grow space-y-2">
                <Label htmlFor="orderCode">كود الطلب الأصلي</Label>
                <Input
                    id="orderCode"
                    value={orderCode}
                    onChange={(e) => setOrderCode(e.target.value)}
                    disabled={isViewMode}
                    placeholder="مثال: 70000001"
                />
            </div>
            {!isViewMode && (
              <Button onClick={handleSearchOrder} className="gap-1 h-10 px-6">
                <Search className="h-4 w-4" /> بحث
              </Button>
            )}
          </div>
          
          {foundOrder && !isViewMode && (
            <div className="space-y-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">بيانات الفاتورة الأصلية</CardTitle>
                            <Badge variant="outline" className="font-mono">{foundOrder.orderCode}</Badge>
                        </div>
                        <CardDescription>العميل: {foundOrder.customerName} - بتاريخ: {formatDateDisplay(foundOrder.orderDate)}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">إجمالي الأصناف</p>
                            <p className="font-bold font-mono">{(foundOrder.total + (foundOrder.discountAmount || 0)).toLocaleString()} ج.م</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <BadgePercent className="h-3 w-3 text-green-600" />
                                الخصم المطبق
                            </p>
                            <p className="font-bold font-mono text-green-600">{(foundOrder.discountAmount || 0).toLocaleString()} ج.م</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">صافي الفاتورة</p>
                            <p className="font-bold font-mono text-primary">{foundOrder.total.toLocaleString()} ج.م</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Label className="text-base font-bold">اختر الأصناف والكميات والأسعار المرتجعة:</Label>
                    <div className="grid gap-3">
                        {foundOrder.items.map(item => {
                            const alreadyReturned = previouslyReturnedQuantities[item.productId] || 0;
                            const maxReturnable = item.quantity - alreadyReturned;
                            const isSelected = !!selectedItems[item.productId];

                            if (maxReturnable <= 0) {
                                return (
                                     <div key={item.productId} className="flex items-center gap-4 rounded-md border p-3 bg-muted/50 text-muted-foreground opacity-60">
                                        <Checkbox id={`item-${item.productId}`} disabled checked={false} />
                                        <div className="flex-grow">
                                            <p className="text-sm font-medium">{item.productName}</p>
                                            <p className="text-[10px]">تم إرجاع الكمية بالكامل ({item.quantity})</p>
                                        </div>
                                    </div>
                                )
                            }

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
                                            <Label htmlFor={`item-${item.productId}`} className="font-bold cursor-pointer">
                                                {item.productName}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">سعر البيع الأصلي: {item.priceAtTimeOfOrder.toLocaleString()} ج.م</p>
                                        </div>
                                    </div>
                                    
                                    {isSelected && (
                                        <div className="grid grid-cols-2 gap-4 mt-2 pr-7 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">الكمية المرتجعة</Label>
                                                <div className='flex items-center gap-2'>
                                                    <Input 
                                                        type="number" 
                                                        className="h-9"
                                                        value={selectedItems[item.productId].quantity}
                                                        onChange={(e) => handleItemQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                                                        max={maxReturnable}
                                                        min={1}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">بحد أقصى {maxReturnable}</span>
                                                </div>
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
                        <p className="text-xs text-muted-foreground">كود الطلب</p>
                        <p className="font-mono font-bold">{saleReturn.orderCode}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">تاريخ المرتجع</p>
                        <p className="font-bold">{formatDateDisplay(saleReturn.returnDate)}</p>
                    </div>
                </div>
                <Label className="text-base font-bold">الأصناف المرتجعة</Label>
                <div className="space-y-2">
                    {saleReturn.items.map(item => (
                         <div key={item.productId} className="flex items-center justify-between rounded-md border p-3 bg-card">
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
                    disabled={!foundOrder || Object.keys(selectedItems).length === 0 || Object.values(selectedItems).every(item => item.quantity === 0)}
                >
                    <Undo2 className="h-5 w-5"/>
                    تأكيد وحفظ المرتجع النهائي
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
