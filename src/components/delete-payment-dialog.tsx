
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
import { Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction } from 'firebase/database';
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
    const [open, setOpen] = useState(false);
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();

    // تنظيف DOM لضمان استجابة الواجهة
    useEffect(() => {
        if (!open) {
            const cleanup = () => {
                document.body.style.pointerEvents = 'auto';
                document.body.style.overflow = '';
            };
            const t1 = setTimeout(cleanup, 50);
            const t2 = setTimeout(cleanup, 400);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [open]);

    const handleDelete = async () => {
        if (!appUser || !db || !order.id || !payment.id) return;

        setIsLoading(true);

        try {
            const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
            const nowISO = new Date().toISOString();
            
            // 1. تحديث رصيد الوردية (معاملة منفصلة)
            if (payment.shiftId) {
                const shiftRef = ref(db, `shifts/${payment.shiftId}`);
                await runTransaction(shiftRef, (s: Shift) => {
                    if (s) {
                        const amt = Number(payment.amount);
                        if (payment.method === 'Vodafone Cash') s.vodafoneCash = Math.max(0, (Number(s.vodafoneCash) || 0) - amt);
                        else if (payment.method === 'InstaPay') s.instaPay = Math.max(0, (Number(s.instaPay) || 0) - amt);
                        else if (payment.method === 'Visa') s.visa = Math.max(0, (Number(s.visa) || 0) - amt);
                        else s.cash = Math.max(0, (Number(s.cash) || 0) - amt);
                        s.updatedAt = nowISO;
                    }
                    return s;
                });
            }

            // 2. التحديث الذري للطلب ولليوم بالكامل لضمان المزامنة الفورية
            const newPaid = Math.max(0, Number(order.paid || 0) - Number(payment.amount));
            const newRemaining = Math.max(0, Number(order.total || 0) - newPaid);
            
            const timestamp = new Date().toLocaleString('ar-EG');
            const auditNote = `\n[حذف دفعة] [${timestamp}] بواسطة ${appUser.fullName}:\nتم حذف مبلغ (${payment.amount} ج.م) المسجل بـ [${payment.method}].`;

            const updates: any = {};
            // مسح الدفعة المحددة
            updates[`daily-entries/${datePath}/orders/${order.id}/payments/${payment.id}`] = null;
            // تحديث إجماليات الطلب
            updates[`daily-entries/${datePath}/orders/${order.id}/paid`] = newPaid;
            updates[`daily-entries/${datePath}/orders/${order.id}/remainingAmount`] = newRemaining;
            updates[`daily-entries/${datePath}/orders/${order.id}/notes`] = (order.notes || "") + auditNote;
            updates[`daily-entries/${datePath}/orders/${order.id}/updatedAt`] = nowISO;
            // تحديث المسار الأب لإجبار المتصفح على استلام التحديث فوراً
            updates[`daily-entries/${datePath}/updatedAt`] = nowISO;

            await update(ref(db), updates);

            toast({ title: "تم حذف الدفعة وتحديث الحسابات بنجاح" });
            setOpen(false);
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                        تأكيد حذف دفعة بقيمة ({payment.amount.toLocaleString()} ج.م)
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من رغبتك في حذف هذا المبلغ؟ سيتم خصمه من إجمالي مدفوعات الفاتورة ومن رصيد الوردية المرتبط بها تلقائياً.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
                    <AlertDialogCancel disabled={isLoading}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => { e.preventDefault(); handleDelete(); }}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />}
                        تأكيد الحذف النهائي
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
