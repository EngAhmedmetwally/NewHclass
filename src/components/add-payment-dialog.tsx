
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Order, Shift } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, update, push, runTransaction } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useRtdbList } from "@/hooks/use-rtdb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { StartShiftDialog } from "./start-shift-dialog";
import { usePermissions } from "@/hooks/use-permissions";

const requiredPermissions = ['orders:add-payment'] as const;

function AddPaymentDialogInner({ order, closeDialog }: { order: Order, closeDialog: () => void }) {
  const [amount, setAmount] = useState(order.remainingAmount);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  const { appUser } = useUser();
  const { data: shifts, isLoading: shiftsLoading } = useRtdbList<Shift>('shifts');
  const db = useDatabase();
  const { toast } = useToast();
  
  const openShift = useMemo(() => {
      if (!appUser || !shifts) return null;
      return shifts.find(s => s.cashier?.id === appUser.id && !s.endTime);
  }, [shifts, appUser]);

  const handleSave = async () => {
    if (amount <= 0 || !appUser || !order.id || isSaving) return;

    if (!openShift) {
        if (shiftsLoading) {
            toast({ title: "جاري التحميل", description: "يرجى الانتظار ثواني للتحقق من الوردية..." });
        } else {
            setShowStartShiftDialog(true);
        }
        return;
    }

    setIsSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
      
      const paymentRef = push(ref(db, `daily-entries/${datePath}/orders/${order.id}/payments`));
      const paymentId = paymentRef.key!;
      
      const paymentData = { 
          id: paymentId, 
          amount: Number(amount), 
          method: paymentMethod, 
          date: nowISO, 
          userId: appUser.id, 
          userName: appUser.fullName, 
          shiftId: openShift.id, 
          note 
      };

      const newPaid = Number(order.paid || 0) + Number(amount);
      const newRemaining = Math.max(0, Number(order.total) - newPaid);

      // 1. Atomic Order & Payment Update
      // We update the 'updatedAt' of the parent date node to trigger RTDB delta sync
      const updates: any = {};
      updates[`daily-entries/${datePath}/orders/${order.id}/payments/${paymentId}`] = paymentData;
      updates[`daily-entries/${datePath}/orders/${order.id}/paid`] = newPaid;
      updates[`daily-entries/${datePath}/orders/${order.id}/remainingAmount`] = newRemaining;
      updates[`daily-entries/${datePath}/orders/${order.id}/updatedAt`] = nowISO;
      updates[`daily-entries/${datePath}/updatedAt`] = nowISO;
      
      await update(ref(db), updates);

      // 2. Update shift balance
      const shiftRef = ref(db, `shifts/${openShift.id}`);
      await runTransaction(shiftRef, (s: Shift) => {
        if (s) {
            const amtNum = Number(amount);
            if (paymentMethod === 'Vodafone Cash') s.vodafoneCash = (Number(s.vodafoneCash) || 0) + amtNum;
            else if (paymentMethod === 'InstaPay') s.instaPay = (Number(s.instaPay) || 0) + amtNum;
            else if (paymentMethod === 'Visa') s.visa = (Number(s.visa) || 0) + amtNum;
            else s.cash = (Number(s.cash) || 0) + amtNum;
            s.updatedAt = nowISO;
        }
        return s;
      });

      toast({ title: "تم تسجيل الدفعة بنجاح", description: `تمت إضافة ${amount.toLocaleString()} ج.م إلى ميزان الوردية.` });
      closeDialog();
    } catch (e: any) {
       console.error("Payment Record Error:", e);
       toast({ variant: "destructive", title: "خطأ في الحفظ", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <div className="grid gap-6 py-4" dir="rtl">
        <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10 text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium">المبلغ المتبقي المطلوب تحصيله</p>
            <p className="text-3xl font-black font-mono text-destructive">
                {Number(order.remainingAmount).toLocaleString()} <span className="text-sm font-bold">ج.م</span>
            </p>
        </div>

        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="pay-amount" className="font-bold">المبلغ المراد دفعه الآن</Label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="pay-amount"
                        type="number" 
                        value={amount || ''} 
                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} 
                        className="h-12 text-lg font-mono font-bold pl-10" 
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label className="font-bold">طريقة التحصيل</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">نقداً (Cash)</SelectItem>
                        <SelectItem value="Vodafone Cash">فودافون كاش</SelectItem>
                        <SelectItem value="InstaPay">إنستا باي (InstaPay)</SelectItem>
                        <SelectItem value="Visa">فيزا (Visa)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="p-3 rounded-md bg-primary/5 border border-primary/10 flex items-center gap-3">
            {shiftsLoading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">جاري التحقق من الوردية المفتوحة...</span>
                </>
            ) : openShift ? (
                <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-bold text-green-700">سيتم تسجيل المبلغ في وردية: {openShift.cashier.name}</span>
                </>
            ) : (
                <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700">لا توجد وردية مفتوحة حالياً. سيطلب النظام فتح وردية عند الحفظ.</span>
                </>
            )}
        </div>

        <Button 
            onClick={handleSave} 
            className="w-full h-12 text-lg font-bold gap-2" 
            disabled={isSaving || amount <= 0 || shiftsLoading}
        >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <DollarSign className="h-5 w-5" />}
            تأكيد تحصيل المبلغ
        </Button>
      </div>
    </>
  );
}

export function AddPaymentDialog({ order, trigger }: { order: Order, trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { permissions } = usePermissions(requiredPermissions);
  if (!permissions.canOrdersAddPayment) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
            <DialogTitle className="text-right">تحصيل دفعة جديدة</DialogTitle>
            <DialogDescription className="text-right">فاتورة رقم: {order.orderCode} للعميل {order.customerName}</DialogDescription>
        </DialogHeader>
        {open && <AddPaymentDialogInner order={order} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
