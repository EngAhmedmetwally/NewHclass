
"use client";

import { useState, useMemo, useEffect } from "react";
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
import { DollarSign, Loader2, Clock, Hash } from "lucide-react";
import type { Order, Shift } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, update, push, runTransaction, get, query, limitToLast } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useRtdbList } from "@/hooks/use-rtdb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { StartShiftDialog } from "./start-shift-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "./ui/badge";

const requiredPermissions = ['orders:add-payment'] as const;

function AddPaymentDialogInner({ order, closeDialog }: { order: Order, closeDialog: () => void }) {
  const [amount, setAmount] = useState(order.remainingAmount);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();

  // تحسين البحث عن الوردية المفتوحة عبر جلب آخر 30 وردية فقط بدلاً من الكل
  useEffect(() => {
    const findOpenShift = async () => {
        if (!appUser || !db) return;
        setIsCheckingShift(true);
        try {
            const shiftsRef = ref(db, 'shifts');
            // جلب عينة صغيرة من أحدث الورديات كافٍ جداً للعثور على الوردية المفتوحة حالياً
            const shiftsQuery = query(shiftsRef, limitToLast(30));
            const snapshot = await get(shiftsQuery);
            if (snapshot.exists()) {
                const shiftsData = snapshot.val();
                const found = Object.keys(shiftsData)
                    .map(id => ({ ...shiftsData[id], id }))
                    .find(s => s.cashier?.id === appUser.id && !s.endTime);
                
                setOpenShift(found || null);
            }
        } catch (e) {
            console.error("Shift check error:", e);
        } finally {
            setIsCheckingShift(false);
        }
    };
    findOpenShift();
  }, [appUser, db]);

  const handleSave = async () => {
    if (amount <= 0 || !appUser || !order.id || isSaving) return;

    if (!openShift) {
        setShowStartShiftDialog(true);
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

      const updates: any = {};
      updates[`daily-entries/${datePath}/orders/${order.id}/payments/${paymentId}`] = paymentData;
      updates[`daily-entries/${datePath}/orders/${order.id}/paid`] = newPaid;
      updates[`daily-entries/${datePath}/orders/${order.id}/remainingAmount`] = newRemaining;
      updates[`daily-entries/${datePath}/orders/${order.id}/updatedAt`] = nowISO;
      updates[`daily-entries/${datePath}/updatedAt`] = nowISO;
      
      await update(ref(db), updates);

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

      toast({ title: "تم تحصيل الدفعة بنجاح" });
      closeDialog();
    } catch (e: any) {
       toast({ variant: "destructive", title: "خطأ في الحفظ", description: e.message });
       setIsSaving(false);
    }
  };

  if (isCheckingShift) {
      return (
        <div className="flex flex-col items-center justify-center p-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground animate-pulse">جاري التحقق من الوردية المفتوحة...</p>
        </div>
      );
  }

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <div className="grid gap-6 py-4" dir="rtl">
        
        {openShift ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 text-green-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-bold">الوردية الحالية:</span>
                </div>
                <Badge variant="outline" className="bg-white border-green-200 text-green-700 font-mono font-bold text-base px-3 py-1">
                    <Hash className="h-3 w-3 ml-1" />
                    {openShift.shiftCode || openShift.id.slice(-4).toUpperCase()}
                </Badge>
            </div>
        ) : (
            <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-center">
                <AlertCircle className="h-8 w-8" />
                <div className="space-y-1">
                    <p className="font-bold">لا توجد وردية مفتوحة!</p>
                    <p className="text-xs">يجب فتح وردية أولاً لتتمكن من تحصيل أي مبالغ مالية.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setShowStartShiftDialog(true)}>فتح وردية الآن</Button>
            </div>
        )}

        <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10 text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium">المبلغ المتبقي المطلوب تحصيله</p>
            <p className="text-3xl font-black font-mono text-destructive">
                {Number(order.remainingAmount).toLocaleString()} <span className="text-sm font-bold">ج.م</span>
            </p>
        </div>

        <div className={cn("space-y-4", !openShift && "opacity-40 pointer-events-none")}>
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
                        disabled={isSaving || !openShift}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label className="font-bold">طريقة التحصيل</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving || !openShift}>
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

        <Button 
            onClick={handleSave} 
            className="w-full h-12 text-lg font-bold gap-2" 
            disabled={isSaving || amount <= 0 || !openShift}
        >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin ml-2" /> : <DollarSign className="h-5 w-5" />}
            تأكيد تحصيل المبلغ
        </Button>
      </div>
    </>
  );
}

export function AddPaymentDialog({ order, trigger }: { order: Order, trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { permissions } = usePermissions(requiredPermissions);

  // معالجة قوية لمشكلة Pointer Events عند إغلاق النافذة
  useEffect(() => {
    if (!open) {
      const cleanup = () => {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = '';
        document.body.classList.remove('pointer-events-none');
      };
      const timer = setTimeout(cleanup, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

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
