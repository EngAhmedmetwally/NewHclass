
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
import { ref, update, runTransaction, push, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, Product, StockMovement, Expense } from '@/lib/definitions';
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
        if (!appUser || !db || !order.id) return;

        // التحقق من الوردية المفتوحة للموظف الحالي
        const openShift = shifts.find(s => s.cashier.id === appUser.id && !s.endTime);
        if (!openShift) {
            toast({
                variant: "destructive",
                title: "لا توجد وردية مفتوحة",
                description: "يجب أن يكون لديك وردية مفتوحة لإلغاء الطلب وخصم المبالغ من الدرج.",
            });
            return;
        }

        setIsLoading(true);

        try {
            const nowISO = new Date().toISOString();
            const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
            const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);

            // 1. Return Stock
            for (const item of order.items) {
                const productRef = ref(db, `products/${item.productId}`);
                await runTransaction(productRef, (currentProduct: Product) => {
                    if (currentProduct) {
                        const itemType = item.itemTransactionType || order.transactionType;
                        const quantityBefore = currentProduct.quantityInStock || 0;
                        currentProduct.quantityInStock = quantityBefore + item.quantity;
                        
                        if (itemType === 'Sale') {
                            currentProduct.quantitySold = Math.max(0, (currentProduct.quantitySold || 0) - item.quantity);
                        } else if (itemType === 'Rental') {
                            currentProduct.quantityRented = Math.max(0, (currentProduct.quantityRented || 0) - item.quantity);
                        }

                        const movementRef = push(ref(db, `products/${item.productId}/stockMovements`));
                        const newMovement: StockMovement = {
                            id: movementRef.key!,
                            date: nowISO,
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
                        currentProduct.updatedAt = nowISO;
                    }
                    return currentProduct;
                });
            }

            // 2. Create Refund Expense
            if (order.paid > 0) {
                const expenseRef = push(ref(db, 'expenses'));
                const refundExpense: Omit<Expense, 'id'> = {
                    description: `إلغاء طلب ورد مبلغ: ${order.orderCode} (${order.customerName})`,
                    amount: order.paid,
                    category: 'إلغاء طلبات',
                    date: nowISO,
                    userId: appUser.id,
                    userName: appUser.fullName,
                    branchId: order.branchId,
                    branchName: order.branchName,
                    shiftId: openShift.id,
                    notes: `مرتجع نقدي من الدرج بسبب إلغاء الفاتورة ${order.orderCode}`
                };
                await set(expenseRef, refundExpense);
            }

            // 3. Update Shift Stats
            const shiftRef = ref(db, `shifts/${openShift.id}`);
            await runTransaction(shiftRef, (currentShift: Shift) => {
                if (currentShift) {
                    currentShift.refunds = (currentShift.refunds || 0) + (order.paid || 0);
                    if (order.transactionType === 'Sale') {
                        currentShift.salesTotal = (currentShift.salesTotal || 0) - (order.total || 0);
                    } else if (order.transactionType === 'Rental') {
                        currentShift.rentalsTotal = (currentShift.rentalsTotal || 0) - (order.total || 0);
                    }
                    if (order.discountAmount) {
                        currentShift.discounts = (currentShift.discounts || 0) - order.discountAmount;
                    }
                    currentShift.updatedAt = nowISO;
                }
                return currentShift;
            });

            // 4. Mark Order as Cancelled and Refresh Parent Node for Instant Sync
            const timestampAr = new Date().toLocaleString('ar-EG');
            const cancellationNote = `\n[إلغاء] [${timestampAr}] بواسطة ${appUser.fullName}: تم إلغاء الطلب ورد مبلغ ${order.paid.toLocaleString()} ج.م للعميل.`;
            
            const updates: any = {};
            updates[`daily-entries/${datePath}/orders/${order.id}/status`] = 'Cancelled';
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledAt`] = nowISO;
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledByUserId`] = appUser.id;
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledByUserName`] = appUser.fullName;
            updates[`daily-entries/${datePath}/orders/${order.id}/notes`] = (order.notes || "") + cancellationNote;
            updates[`daily-entries/${datePath}/orders/${order.id}/paid`] = 0;
            updates[`daily-entries/${datePath}/orders/${order.id}/remainingAmount`] = 0;
            updates[`daily-entries/${datePath}/orders/${order.id}/updatedAt`] = nowISO;
            
            // إجبار محرك المزامنة على تحديث اليوم بالكامل لحظياً
            updates[`daily-entries/${datePath}/updatedAt`] = nowISO;

            await update(ref(db), updates);

            toast({ title: "تم إلغاء الطلب لحظياً وتحديث الوردية والمخزون" });
            onSuccess?.();
        } catch (error: any) {
            console.error("Cancel Order Error:", error);
            toast({ variant: "destructive", title: "خطأ في الإلغاء", description: error.message });
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
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        تأكيد إلغاء الطلب {order.orderCode}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ 
                        <br /><br />
                        - سيتم تغيير حالة الطلب إلى <span className="font-bold text-destructive">"ملغي"</span>.
                        <br />
                        - سيتم إرجاع كافة الأصناف للمخزون تلقائياً.
                        <br />
                        - سيتم تسجيل **مرتجع نقدي** بقيمة <span className="font-bold">{(order.paid || 0).toLocaleString()} ج.م</span> في ورديتك الحالية لخصمه من الدرج.
                        <br /><br />
                        هذا الإجراء نهائي ولا يمكن التراجع عنه.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel disabled={isLoading}>تراجع</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => { e.preventDefault(); handleCancelOrder(); }}
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
