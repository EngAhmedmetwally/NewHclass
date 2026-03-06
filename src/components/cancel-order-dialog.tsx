'use client';

import React, { useState } from 'react';
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
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction, push } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, Product, StockMovement } from '@/lib/definitions';
import { format } from 'date-fns';

type CancelOrderDialogProps = {
    order: Order;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
};

export function CancelOrderDialog({ order, trigger, onSuccess }: CancelOrderDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();
    const { data: shifts } = useRtdbList<Shift>('shifts');

    const handleCancelOrder = async () => {
        if (!appUser || !db) return;

        // 1. Check if shift is open
        const openShift = shifts.find(s => s.cashier.id === appUser.id && !s.endTime);
        if (!openShift) {
            toast({
                variant: "destructive",
                title: "لا توجد وردية مفتوحة",
                description: "يجب أن يكون لديك وردية مفتوحة لإلغاء الطلب وخصم المبالغ.",
            });
            return;
        }

        setIsLoading(true);

        try {
            const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
            const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);

            // 2. Update Stock
            for (const item of order.items) {
                const productRef = ref(db, `products/${item.productId}`);
                await runTransaction(productRef, (currentProduct: Product) => {
                    if (currentProduct) {
                        const itemType = item.itemTransactionType || order.transactionType;
                        const quantityBefore = currentProduct.quantityInStock || 0;
                        
                        // Return to stock
                        currentProduct.quantityInStock = quantityBefore + item.quantity;
                        
                        if (itemType === 'Sale') {
                            currentProduct.quantitySold = Math.max(0, (currentProduct.quantitySold || 0) - item.quantity);
                        } else if (itemType === 'Rental') {
                            currentProduct.quantityRented = Math.max(0, (currentProduct.quantityRented || 0) - item.quantity);
                        }

                        // Add stock movement
                        const movementRef = push(ref(db, `products/${item.productId}/stockMovements`));
                        const newMovement: StockMovement = {
                            id: movementRef.key!,
                            date: new Date().toISOString(),
                            type: 'return',
                            quantity: item.quantity,
                            quantityBefore: quantityBefore,
                            quantityAfter: currentProduct.quantityInStock,
                            notes: `إلغاء الطلب ${order.orderCode}`,
                            orderCode: order.orderCode,
                            userId: appUser.id,
                            userName: appUser.fullName,
                        };
                        if (!currentProduct.stockMovements) currentProduct.stockMovements = {};
                        currentProduct.stockMovements[newMovement.id] = newMovement;
                    }
                    return currentProduct;
                });
            }

            // 3. Update Shift Finances
            const shiftRef = ref(db, `shifts/${openShift.id}`);
            await runTransaction(shiftRef, (currentShift: Shift) => {
                if (currentShift) {
                    // Deduct the paid amount from current cash (assuming Cash for now as it's the most common)
                    // In a more complex system, we'd check the method of each payment in order.payments
                    currentShift.cash = (currentShift.cash || 0) - (order.paid || 0);
                    
                    // Deduct the order totals
                    if (order.transactionType === 'Sale') {
                        currentShift.salesTotal = (currentShift.salesTotal || 0) - (order.total || 0);
                    } else if (order.transactionType === 'Rental') {
                        currentShift.rentalsTotal = (currentShift.rentalsTotal || 0) - (order.total || 0);
                    }
                    
                    // Deduct discounts if any
                    if (order.discountAmount) {
                        currentShift.discounts = (currentShift.discounts || 0) - order.discountAmount;
                    }
                }
                return currentShift;
            });

            // 4. Update Order Status
            const cancellationNote = `\n[إلغاء] [${new Date().toLocaleString('ar-EG')}] تم إلغاء الطلب بواسطة ${appUser.fullName}. تم رد مبلغ ${order.paid.toLocaleString()} ج.م للدرج وإرجاع الأصناف للمخزون.`;
            await update(orderRef, {
                status: 'Cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledByUserId: appUser.id,
                cancelledByUserName: appUser.fullName,
                notes: (order.notes || "") + cancellationNote,
                paid: 0, 
                remainingAmount: 0,
            });

            toast({
                title: "تم إلغاء الطلب",
                description: `تم إلغاء الطلب ${order.orderCode} بنجاح.`,
            });

            onSuccess?.();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "خطأ في الإلغاء",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                {trigger || (
                    <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        إلغاء الطلب
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        تأكيد إلغاء الطلب {order.orderCode}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ 
                        <br /><br />
                        - سيتم تغيير حالة الطلب إلى <span className="font-bold text-destructive">"ملغي"</span>.
                        <br />
                        - سيتم إرجاع جميع الأصناف ({order.items.length}) إلى المخزون.
                        <br />
                        - سيتم خصم مبلغ <span className="font-bold">{(order.paid || 0).toLocaleString()} ج.م</span> من الوردية الحالية.
                        <br /><br />
                        هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel disabled={isLoading}>تراجع</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => {
                            e.preventDefault();
                            handleCancelOrder();
                        }}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تأكيد الإلغاء النهائي
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}