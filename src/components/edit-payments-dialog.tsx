
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
import { useDatabase, useUser } from '@/firebase';
import { ref, update, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { Order, OrderPayment, Shift } from '@/lib/definitions';
import { CreditCard, Loader2, Save, Wallet, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

type EditPaymentsDialogProps = {
  order: Order;
  trigger: React.ReactNode;
  onSuccess?: () => void;
};

export function EditPaymentsDialog({ order, trigger, onSuccess }: EditPaymentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentChanges, setPaymentChanges] = useState<Record<string, string>>({});
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();

  const payments = useMemo(() => {
    let pList = order.payments ? Object.values(order.payments) : [];
    
    if (pList.length === 0 && order.paid > 0) {
        pList.push({
            id: "initial-payment",
            amount: order.paid,
            method: "Cash",
            date: order.createdAt || order.orderDate,
            userId: order.processedByUserId,
            userName: order.processedByUserName,
            shiftId: order.shiftId || ""
        } as any);
    }
    return pList;
  }, [order]);

  const handleMethodChange = (paymentId: string, newMethod: string) => {
      setPaymentChanges(prev => ({ ...prev, [paymentId]: newMethod }));
  };

  const handleSave = async () => {
    if (Object.keys(paymentChanges).length === 0 || !db || !order.id || !appUser) {
        setOpen(false);
        return;
    }

    setIsLoading(true);
    try {
      const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
      let historyNotes = order.notes || "";

      for (const paymentId in paymentChanges) {
          const newMethod = paymentChanges[paymentId];
          const existingPayment = order.payments?.[paymentId] || (paymentId === "initial-payment" ? payments[0] : null);
          
          if (!existingPayment || existingPayment.method === newMethod) continue;

          const oldMethod = existingPayment.method;
          const amount = existingPayment.amount;

          // 1. Update Payment Record
          await update(ref(db, `daily-entries/${datePath}/orders/${order.id}/payments/${paymentId}`), {
              ...existingPayment,
              method: newMethod
          });

          // 2. Update Shift Counters
          if (existingPayment.shiftId) {
              const shiftRef = ref(db, `shifts/${existingPayment.shiftId}`);
              await runTransaction(shiftRef, (s: Shift) => {
                  if (s && !s.isPosted) {
                      // Deduct from old
                      if (oldMethod === 'Vodafone Cash') s.vodafoneCash = (s.vodafoneCash || 0) - amount;
                      else if (oldMethod === 'InstaPay') s.instaPay = (s.instaPay || 0) - amount;
                      else if (oldMethod === 'Visa') s.visa = (s.visa || 0) - amount;
                      else s.cash = (s.cash || 0) - amount;

                      // Add to new
                      if (newMethod === 'Vodafone Cash') s.vodafoneCash = (s.vodafoneCash || 0) + amount;
                      else if (newMethod === 'InstaPay') s.instaPay = (s.instaPay || 0) + amount;
                      else if (newMethod === 'Visa') s.visa = (s.visa || 0) + amount;
                      else s.cash = (s.cash || 0) + amount;
                  }
                  return s;
              });
          }

          // 3. Prepare Audit Note
          const timestamp = new Date().toLocaleString('ar-EG');
          historyNotes += `\n[تعديل دفع] [${timestamp}] بواسطة ${appUser.fullName}: تم تغيير طريقة دفع مبلغ (${amount} ج.م) من [${oldMethod}] إلى [${newMethod}].`;
      }

      // Update Order Notes
      await update(ref(db, `daily-entries/${datePath}/orders/${order.id}`), {
          notes: historyNotes,
          updatedAt: new Date().toISOString()
      });

      toast({ title: "تم تحديث طرق الدفع وتصحيح ميزان الوردية" });
      onSuccess?.();
      setOpen(false);
    } catch (error: any) {
      console.error("Edit Payments Error:", error);
      toast({ variant: "destructive", title: "خطأ في التحديث", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            تعديل طرق الدفع للفاتورة
          </DialogTitle>
          <DialogDescription className="text-right">
            تغيير وسيلة تحصيل المبالغ لتصحيح ميزان الدرج والترحيل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <span>لا توجد مدفوعات مسجلة.</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {payments.map((p) => (
                        <div key={p.id} className="p-3 border rounded-lg bg-card space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-primary font-mono">{p.amount.toLocaleString()} ج.م</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px]">طريقة الدفع</Label>
                                <Select 
                                    defaultValue={p.method} 
                                    onValueChange={(v) => handleMethodChange(p.id, v)}
                                    disabled={isLoading}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">نقداً (Cash)</SelectItem>
                                        <SelectItem value="Vodafone Cash">فودافون كاش</SelectItem>
                                        <SelectItem value="InstaPay">إنستا باي (InstaPay)</SelectItem>
                                        <SelectItem value="Visa">فيزا (Visa)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="flex-1">إلغاء</Button>
          <Button onClick={handleSave} disabled={isLoading || payments.length === 0} className="flex-1 gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            تأكيد وحفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
