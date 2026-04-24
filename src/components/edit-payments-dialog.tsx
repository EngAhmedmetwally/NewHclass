
"use client";

import React, { useState } from 'react';
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
import { CreditCard, Loader2, Save, Wallet } from 'lucide-react';
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
  
  const db = useDatabase();
  const { toast } = useToast();

  const payments = order.payments ? Object.values(order.payments) : [];

  const handleMethodChange = (paymentId: string, newMethod: string) => {
      setPaymentChanges(prev => ({ ...prev, [paymentId]: newMethod }));
  };

  const handleSave = async () => {
    if (Object.keys(paymentChanges).length === 0 || !db || !order.id) {
        setOpen(false);
        return;
    }

    setIsLoading(true);
    try {
      const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
      
      for (const paymentId in paymentChanges) {
          const newMethod = paymentChanges[paymentId];
          const payment = order.payments?.[paymentId];
          if (!payment || payment.method === newMethod) continue;

          const oldMethod = payment.method;
          const amount = payment.amount;

          // 1. Update Payment Record in Order
          await update(ref(db, `daily-entries/${datePath}/orders/${order.id}/payments/${paymentId}`), {
              method: newMethod
          });

          // 2. Update Shift Counters if shift exists and is not posted
          if (payment.shiftId) {
              const shiftRef = ref(db, `shifts/${payment.shiftId}`);
              await runTransaction(shiftRef, (s: Shift) => {
                  if (s && !s.isPosted) {
                      // Deduct from old method
                      if (oldMethod === 'Vodafone Cash') s.vodafoneCash = (s.vodafoneCash || 0) - amount;
                      else if (oldMethod === 'InstaPay') s.instaPay = (s.instaPay || 0) - amount;
                      else if (oldMethod === 'Visa') s.visa = (s.visa || 0) - amount;
                      else s.cash = (s.cash || 0) - amount;

                      // Add to new method
                      if (newMethod === 'Vodafone Cash') s.vodafoneCash = (s.vodafoneCash || 0) + amount;
                      else if (newMethod === 'InstaPay') s.instaPay = (s.instaPay || 0) + amount;
                      else if (newMethod === 'Visa') s.visa = (s.visa || 0) + amount;
                      else s.cash = (s.cash || 0) + amount;
                  }
                  return s;
              });
          }
      }

      toast({ title: "تم تحديث طرق الدفع وتعديل الوردية بنجاح" });
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
            يمكنك تغيير طريقة دفع أي مبلغ مسجل. سيقوم النظام بتصحيح ميزان الوردية آلياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
                    لا توجد مدفوعات مسجلة لهذه الفاتورة.
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
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
