'use client';

import React, { useState, useMemo } from 'react';
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
import { Trash2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction, push, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Order, Shift, Product, StockMovement, Expense } from '@/lib/definitions';
import { format } from 'date-fns';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CancelOrderDialogProps = {
    order: Order;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
};

export function CancelOrderDialog({ order, trigger, onSuccess }: CancelOrderDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();
    const { data: shifts } = useRtdbList<Shift>('shifts');

    // تصفية الورديات المفتوحة فقط
    const openShifts = useMemo(() => shifts.filter(s => !s.endTime), [shifts]);

    const handleCancelOrder = async () => {
        if (!appUser || !db || !order.id) return;

        // إذا كان هناك مبالغ مدفوعة، يجب اختيار وردية
        if (order.paid > 0 && !selectedShiftId) {
            toast({
                variant: "destructive",
                title: "الرجاء اختيار وردية",
                description: "يجب اختيار الوردية المفتوحة التي سيتم رد المبلغ منها.",
            });
            return;
        }

        setIsLoading(true);

        try {
            const nowISO = new Date().toISOString();
            const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
            
            const targetShift = openShifts.find(s => s.id === selectedShiftId);

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

            // 2. Create Refund Expense & Update Shift Stats
            if (order.paid > 0 && targetShift) {
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
                    shiftId: targetShift.id,
                    notes: `تم رد المبلغ من وردية ${targetShift.cashier.name}`
                };
                await set(expenseRef, refundExpense);

                const shiftRef = ref(db, `shifts/${targetShift.id}`);
                await runTransaction(shiftRef, (currentShift: Shift) => {
                    if (currentShift) {
                        currentShift.refunds = (currentShift.refunds || 0) + (order.paid || 0);
                        // خصم قيمة الفاتورة من إجمالي الوردية
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
            }

            // 4. Mark Order as Cancelled
            const timestampAr = new Date().toLocaleString('ar-EG');
            const cancellationNote = `\n[إلغاء] [${timestampAr}] بواسطة ${appUser.fullName}: تم إلغاء الطلب ورد مبلغ ${order.paid.toLocaleString()} ج.م للعميل ${targetShift ? `من وردية ${targetShift.cashier.name}` : ''}.`;
            
            const updates: any = {};
            updates[`daily-entries/${datePath}/orders/${order.id}/status`] = 'Cancelled';
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledAt`] = nowISO;
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledByUserId`] = appUser.id;
            updates[`daily-entries/${datePath}/orders/${order.id}/cancelledByUserName`] = appUser.fullName;
            updates[`daily-entries/${datePath}/orders/${order.id}/notes`] = (order.notes || "") + cancellationNote;
            updates[`daily-entries/${datePath}/orders/${order.id}/paid`] = 0;
            updates[`daily-entries/${datePath}/orders/${order.id}/remainingAmount`] = 0;
            updates[`daily-entries/${datePath}/orders/${order.id}/updatedAt`] = nowISO;
            updates[`daily-entries/${datePath}/updatedAt`] = nowISO;

            await update(ref(db), updates);

            toast({ title: "تم إلغاء الطلب وتحديث المخزون والوردية المختارة" });
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
                        
                        {order.paid > 0 && (
                            <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                                <p className="font-bold mb-2">تنبيه لرد المبلغ (إجمالي المدفوع: {order.paid.toLocaleString()} ج.م):</p>
                                <Label className="text-xs mb-2 block">اختر الوردية المفتوحة لخصم مبلغ الاسترداد منها:</Label>
                                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                                    <SelectTrigger className="h-10 bg-white">
                                        <SelectValue placeholder="-- اختر وردية مفتوحة --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {openShifts.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                وردية {s.cashier.name} ({s.shiftCode || s.id.slice(-4)})
                                            </SelectItem>
                                        ))}
                                        {openShifts.length === 0 && <SelectItem value="none" disabled>لا توجد ورديات مفتوحة حالياً!</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel disabled={isLoading}>تراجع</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => { e.preventDefault(); handleCancelOrder(); }}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isLoading || (order.paid > 0 && !selectedShiftId)}
                    >
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تأكيد الإلغاء النهائي
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
