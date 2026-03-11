"use client";

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction, push } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { Order, Product, StockMovement, OrderItem } from '@/lib/definitions';
import { format } from 'date-fns';
import { ArrowLeftRight, Loader2, AlertTriangle } from 'lucide-react';
import { SelectProductDialog } from './select-product-dialog';

type ExchangeItemDialogProps = {
  order: Order;
  trigger: React.ReactNode;
  onSuccess?: () => void;
};

export function ExchangeItemDialog({ order, trigger, onSuccess }: ExchangeItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oldItemIndex, setOldItemIdIndex] = useState<string | undefined>();
  const [newProductId, setNewProductId] = useState<string | undefined>();
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { data: allProducts } = useRtdbList<Product>('products');

  const oldItem = useMemo(() => {
      if (oldItemIndex === undefined) return undefined;
      return order.items[parseInt(oldItemIndex)];
  }, [order.items, oldItemIndex]);

  const newProduct = useMemo(() => {
      if (!newProductId) return undefined;
      return allProducts.find(p => p.id === newProductId);
  }, [allProducts, newProductId]);

  const priceDifference = useMemo(() => {
      if (!oldItem || !newProduct) return 0;
      return Number(newProduct.price) - oldItem.priceAtTimeOfOrder;
  }, [oldItem, newProduct]);

  const handleExchange = async () => {
    if (!oldItem || !newProduct || !appUser || !db || oldItemIndex === undefined) return;

    setIsLoading(true);
    try {
      const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
      const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);

      // 1. Return Old Product to Stock
      const oldProdRef = ref(db, `products/${oldItem.productId}`);
      await runTransaction(oldProdRef, (p: Product) => {
          if (p) {
              const qtyBefore = p.quantityInStock || 0;
              p.quantityInStock = qtyBefore + oldItem.quantity;
              if (oldItem.itemTransactionType === 'Rental' || order.transactionType === 'Rental') {
                  p.quantityRented = Math.max(0, (p.quantityRented || 0) - oldItem.quantity);
              } else {
                  p.quantitySold = Math.max(0, (p.quantitySold || 0) - oldItem.quantity);
              }
              
              const moveRef = push(ref(db, `products/${oldItem.productId}/stockMovements`));
              const move: StockMovement = {
                  id: moveRef.key!,
                  date: new Date().toISOString(),
                  type: 'rental_in',
                  quantity: oldItem.quantity,
                  quantityBefore: qtyBefore,
                  quantityAfter: p.quantityInStock,
                  notes: `تبديل صنف (إرجاع) - طلب ${order.orderCode}`,
                  userId: appUser.id,
                  userName: appUser.fullName
              };
              if (!p.stockMovements) p.stockMovements = {};
              p.stockMovements[move.id] = move;
          }
          return p;
      });

      // 2. Take New Product from Stock
      const newProdRef = ref(db, `products/${newProduct.id}`);
      await runTransaction(newProdRef, (p: Product) => {
          if (p) {
              const qtyBefore = p.quantityInStock || 0;
              p.quantityInStock = qtyBefore - oldItem.quantity; // Assuming same quantity
              if (oldItem.itemTransactionType === 'Rental' || order.transactionType === 'Rental') {
                  p.quantityRented = (p.quantityRented || 0) + oldItem.quantity;
                  p.rentalCount = (p.rentalCount || 0) + oldItem.quantity;
              } else {
                  p.quantitySold = (p.quantitySold || 0) + oldItem.quantity;
              }

              const moveRef = push(ref(db, `products/${newProduct.id}/stockMovements`));
              const move: StockMovement = {
                  id: moveRef.key!,
                  date: new Date().toISOString(),
                  type: 'rental_out',
                  quantity: -oldItem.quantity,
                  quantityBefore: qtyBefore,
                  quantityAfter: p.quantityInStock,
                  notes: `تبديل صنف (حجز جديد) - طلب ${order.orderCode}`,
                  userId: appUser.id,
                  userName: appUser.fullName
              };
              if (!p.stockMovements) p.stockMovements = {};
              p.stockMovements[move.id] = move;
          }
          return p;
      });

      // 3. Update Order
      const newItems = [...order.items];
      const index = parseInt(oldItemIndex);
      newItems[index] = {
          ...oldItem,
          productId: newProduct.id,
          productName: `${newProduct.name} - مقاس ${newProduct.size}`,
          productCode: newProduct.productCode,
          priceAtTimeOfOrder: Number(newProduct.price),
          originalPrice: Number(newProduct.price),
      };

      const newTotal = order.total + (priceDifference * oldItem.quantity);
      const newRemaining = newTotal - order.paid;
      const logNote = `\n[تبديل] [${new Date().toLocaleString('ar-EG')}] تم تبديل الصنف (${oldItem.productName}) بالصنف (${newProduct.name} - ${newProduct.size}) بواسطة ${appUser.fullName}. فرق السعر: ${priceDifference.toLocaleString()} ج.م`;

      await update(orderRef, {
          items: newItems,
          total: newTotal,
          remainingAmount: newRemaining,
          notes: (order.notes || "") + logNote,
          updatedAt: new Date().toISOString()
      });

      toast({ title: "تم تبديل الصنف بنجاح" });
      onSuccess?.();
      setOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في التبديل", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const branchProducts = useMemo(() => {
      return allProducts.filter(p => p.branchId === order.branchId || p.showInAllBranches);
  }, [allProducts, order.branchId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تبديل صنف في الطلب</DialogTitle>
          <DialogDescription className="text-right">
            يمكنك استبدال صنف محجوز بصنف آخر. سيقوم النظام بتعديل المخزون والحسابات تلقائياً.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label>الصنف المراد استبداله</Label>
            <Select value={oldItemIndex} onValueChange={setOldItemIdIndex}>
                <SelectTrigger><SelectValue placeholder="اختر الصنف من الطلب" /></SelectTrigger>
                <SelectContent>
                    {order.items.map((item, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{item.productName} ({item.priceAtTimeOfOrder.toLocaleString()} ج.م)</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الصنف الجديد البديل</Label>
            <SelectProductDialog 
                products={branchProducts} 
                onProductSelected={setNewProductId} 
                selectedProductId={newProductId}
            />
          </div>

          {oldItem && newProduct && (
              <div className="p-4 rounded-lg bg-muted space-y-3 border">
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">سعر الصنف القديم:</span>
                      <span className="font-mono">{oldItem.priceAtTimeOfOrder.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">سعر الصنف الجديد:</span>
                      <span className="font-mono">{Number(newProduct.price).toLocaleString()} ج.م</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                      <span>فرق السعر:</span>
                      <span className={cn("font-mono", priceDifference > 0 ? "text-destructive" : "text-green-600")}>
                          {priceDifference > 0 ? `+${priceDifference.toLocaleString()}` : priceDifference.toLocaleString()} ج.م
                      </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                      * سيتم تحديث رصيد العميل المتبقي بهذا الفرق.
                  </p>
              </div>
          )}

          {priceDifference !== 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>تنبيه: سيؤدي التبديل لتغيير إجمالي الطلب. يرجى التأكد من تسوية الحساب مع العميل.</p>
              </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="flex-1">إلغاء</Button>
          <Button onClick={handleExchange} disabled={isLoading || !oldItem || !newProduct} className="flex-1 gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            تأكيد التبديل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}