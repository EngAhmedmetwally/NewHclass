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
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, SaleReturn, Product, StockMovement, Counter, Shift, Expense } from '@/lib/definitions';
import { useDatabase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, get, query, orderByChild, equalTo, runTransaction, update } from 'firebase/database';
import { format } from 'date-fns';
import { Search, Trash2, Undo2 } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';


type SaleReturnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleReturn?: SaleReturn;
};

export function AddSaleReturnDialog({ open, onOpenChange, saleReturn }: SaleReturnDialogProps) {
  const isViewMode = !!saleReturn;
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  
  const [orderCode, setOrderCode] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
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
      const itemsToSelect: Record<string, number> = {};
      saleReturn.items.forEach(item => {
        itemsToSelect[item.productId] = item.quantity;
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

    const newSelectedItems = { ...selectedItems, [productId]: validQuantity };
     if (validQuantity === 0) {
        delete newSelectedItems[productId];
    }
    setSelectedItems(newSelectedItems);
  };

  useEffect(() => {
    if (foundOrder) {
      const totalRefund = Object.keys(selectedItems).reduce((acc, productId) => {
        const item = foundOrder.items.find(i => i.productId === productId);
        if (item) {
          return acc + (item.priceAtTimeOfOrder * selectedItems[productId]);
        }
        return acc;
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
    const currentReturnTotal = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
    const totalOriginalItems = foundOrder.items.reduce((sum, item) => sum + item.quantity, 0);

    if (totalReturnedSoFar + currentReturnTotal >= totalOriginalItems) {
        updates.returnStatus = 'fully_returned';
    } else {
        updates.returnStatus = 'partially_returned';
    }
    
    await update(orderRef, updates);


    for (const productId in selectedItems) {
        const productRef = ref(db, `products/${productId}`);
        const quantityReturned = selectedItems[productId];
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
    const openShiftRef = ref(db, `shifts`);
    const shiftSnapshot = await get(query(openShiftRef, orderByChild('cashier/id'), equalTo(appUser.id)));
    let openShiftId: string | null = null;
    if (shiftSnapshot.exists()) {
        const shifts = shiftSnapshot.val();
        for (const id in shifts) {
            if (!shifts[id].endTime) {
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
            category: 'sale_return',
            date: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            branchId: foundOrder.branchId,
            branchName: foundOrder.branchName
        };
        await set(expenseRef, expense);

        // Deduct from shift cash
        const currentShiftRef = ref(db, `shifts/${openShiftId}`);
        await runTransaction(currentShiftRef, (currentShift: Shift) => {
            if (currentShift) {
                currentShift.cash = (currentShift.cash || 0) - refundAmount;
            }
            return currentShift;
        });
    } else {
        toast({ title: "تنبيه", description: "لم يتم العثور على وردية مفتوحة. لم يتم تسجيل المصروف.", variant: "destructive" });
    }

    // --- Save the SaleReturn record ---
    const returnedItems = foundOrder.items
        .filter(item => selectedItems[item.productId])
        .map(item => ({ ...item, quantity: selectedItems[item.productId] }));

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
  
    function formatDate(dateString?: string | Date) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('ar-EG', {day: '2-digit', month: '2-digit', year: 'numeric'});
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isViewMode ? `عرض مرتجع بيع ${saleReturn?.returnCode}` : 'إنشاء مرتجع بيع'}</DialogTitle>
          <DialogDescription>
            {isViewMode ? 'تفاصيل المرتجع.' : 'ابحث عن الطلب الأصلي لتسجيل مرتجع بيع.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4 pl-1">
          <div className="flex gap-2 items-end">
            <div className="flex-grow space-y-2">
                <Label htmlFor="orderCode">كود الطلب الأصلي</Label>
                <Input
                    id="orderCode"
                    value={orderCode}
                    onChange={(e) => setOrderCode(e.target.value)}
                    disabled={isViewMode}
                />
            </div>
            {!isViewMode && (
              <Button onClick={handleSearchOrder} className="gap-1">
                <Search className="h-4 w-4" /> بحث
              </Button>
            )}
          </div>
          
          {foundOrder && !isViewMode && (
            <Card>
                <CardHeader>
                    <CardTitle>تفاصيل الطلب الأصلي</CardTitle>
                    <CardDescription>العميل: {foundOrder.customerName} - بتاريخ: {formatDate(foundOrder.orderDate)}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label>اختر الأصناف المرتجعة:</Label>
                        {foundOrder.items.map(item => {
                            const alreadyReturned = previouslyReturnedQuantities[item.productId] || 0;
                            const maxReturnable = item.quantity - alreadyReturned;

                            if (maxReturnable <= 0) {
                                return (
                                     <div key={item.productId} className="flex items-center gap-4 rounded-md border p-3 bg-muted/50 text-muted-foreground">
                                        <Checkbox id={`item-${item.productId}`} disabled checked={false} />
                                        <Label htmlFor={`item-${item.productId}`} className="flex-grow">{item.productName} (الكمية: {item.quantity})</Label>
                                        <span>تم إرجاع هذه الكمية بالكامل.</span>
                                    </div>
                                )
                            }

                            return (
                                <div key={item.productId} className="flex items-center gap-4 rounded-md border p-3">
                                    <Checkbox
                                        id={`item-${item.productId}`}
                                        checked={!!selectedItems[item.productId]}
                                        onCheckedChange={(checked) => handleItemQuantityChange(item.productId, checked ? 1 : 0)}
                                    />
                                    <Label htmlFor={`item-${item.productId}`} className="flex-grow">{item.productName}</Label>
                                    <div className='flex items-center gap-2'>
                                        <Label className="text-xs">الكمية:</Label>
                                        <Input 
                                            type="number" 
                                            className="h-8 w-20"
                                            value={selectedItems[item.productId] || 0}
                                            onChange={(e) => handleItemQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                                            max={maxReturnable}
                                            min={0}
                                        />
                                        <span className="text-xs text-muted-foreground">/ {maxReturnable}</span>
                                    </div>
                                    <span className="font-mono">{item.priceAtTimeOfOrder.toLocaleString()} ج.م</span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
          )}

          {isViewMode && saleReturn && (
             <Card>
                <CardHeader>
                    <CardTitle>الأصناف المرتجعة</CardTitle>
                </CardHeader>
                <CardContent>
                    {saleReturn.items.map(item => (
                         <div key={item.productId} className="flex items-center justify-between rounded-md border p-3">
                            <p>{item.productName}</p>
                            <p>الكمية: {item.quantity}</p>
                         </div>
                    ))}
                </CardContent>
            </Card>
          )}

          {(Object.keys(selectedItems).length > 0 || isViewMode) && (
            <>
                <Separator/>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>إجمالي المبلغ المسترد</Label>
                        <Input value={`${refundAmount.toLocaleString()} ج.م`} readOnly className="bg-muted text-lg font-bold text-destructive" />
                    </div>
                </div>
            </>
          )}
        </div>
        {!isViewMode && (
            <DialogFooter>
                <Button onClick={handleSave} disabled={!foundOrder || Object.keys(selectedItems).length === 0 || Object.values(selectedItems).every(q => q === 0)}>
                    <Undo2 className="ml-2 h-4 w-4"/>
                    حفظ المرتجع
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
