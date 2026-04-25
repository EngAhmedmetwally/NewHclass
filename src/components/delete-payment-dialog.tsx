
"use client";

import React, { useState, useEffect } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { Order, OrderPayment, Shift } from '@/lib/definitions';
import { format } from 'date-fns';

type DeletePaymentDialogProps = {
    order: Order;
    payment: OrderPayment;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
};

export function DeletePaymentDialog({ order, payment, trigger, onSuccess }: DeletePaymentDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [password, setPassword] = useState("");
    const [open, setOpen] = useState(false);
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();

    /**
     * CRITICAL FIX: Ensures that when the dialog opens/closes, the body pointer events are reset.
     * This fixes the issue where inputs are sometimes not clickable in nested dialogs.
     */
    useEffect(() => {
        if (open) {
            // Short delay to ensure focus trap of the new dialog takes over
            const timer = setTimeout(() => {
                const input = document.getElementById('del-pass');
                if (input) input.focus();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            // Aggressive cleanup when closing
            const cleanup = () => {
                document.body.style.pointerEvents = 'auto';
                document.body.style.overflow = '';
            };
            const t1 = setTimeout(cleanup, 50);
            const t2 = setTimeout(cleanup, 300);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [open]);

    const handleDelete = async () => {
        if (password !== "omarmeto") {
            toast({ variant: "destructive", title: "كلمة المرور غير صحيحة" });
            return;
        }

        if (!appUser || !db || !order.id || !payment.id) return;

        setIsLoading(true);

        try {
            const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
            const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);
            const paymentRef = ref(db, `daily-entries/${datePath}/orders/${order.id}/payments/${payment.id}`);

            // 1. Update Shift Balance (Subtract the payment)
            if (payment.shiftId) {
                const shiftRef = ref(db, `shifts/${payment.shiftId}`);
                await runTransaction(shiftRef, (s: Shift) => {
                    if (s) {
                        const amt = Number(payment.amount);
                        if (payment.method === 'Vodafone Cash') s.vodafoneCash = Math.max(0, (Number(s.vodafoneCash) || 0) - amt);
                        else if (payment.method === 'InstaPay') s.instaPay = Math.max(0, (Number(s.instaPay) || 0) - amt);
                        else if (payment.method === 'Visa') s.visa = Math.max(0, (Number(s.visa) || 0) - amt);
                        else s.cash = Math.max(0, (Number(s.cash) || 0) - amt);
                        s.updatedAt = new Date().toISOString();
                    }
                    return s;
                });
            }

            // 2. Remove Payment from Order
            await remove(paymentRef);

            // 3. Recalculate Order Totals
            const newPaid = Math.max(0, (order.paid || 0) - payment.amount);
            const newRemaining = Math.max(0, (order.total || 0) - newPaid);
            
            const timestamp = new Date().toLocaleString('ar-EG');
            const auditNote = `\n[حذف دفعة] [${timestamp}] بواسطة ${appUser.fullName}:\nتم حذف مبلغ (${payment.amount} ج.م) المسجل بـ [${payment.method}].`;

            await update(orderRef, {
                paid: newPaid,
                remainingAmount: newRemaining,
                notes: (order.notes || "") + auditNote,
                updatedAt: new Date().toISOString()
            });

            toast({ title: "تم حذف الدفعة وتصحيح الحسابات بنجاح" });
            setOpen(false);
            setPassword("");
            onSuccess?.();
        } catch (error: any) {
            console.error("Delete Payment Error:", error);
            toast({ variant: "destructive", title: "خطأ في الحذف", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl" className="text-right" onOpenAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                        حذف مبلغ مدفوع ({payment.amount} ج.م)
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم خصم هذا المبلغ من إجمالي مدفوعات الفاتورة ومن رصيد الوردية المرتبط بها. 
                        الرجاء إدخال كلمة المرور للمتابعة.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="del-pass">كلمة مرور الحذف</Label>
                    <Input 
                        id="del-pass"
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور هنا..."
                        className="text-center h-12 text-lg"
                        autoComplete="off"
                    />
                </div>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel disabled={isLoading}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => { e.preventDefault(); handleDelete(); }}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isLoading || !password}
                    >
                        {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin ml-2" /> : <Trash2 className="ml-2 h-4 w-4 ml-2" />}
                        تأكيد الحذف
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
