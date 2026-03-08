
"use client";

import { useState, useEffect } from "react";
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
import { DollarSign } from "lucide-react";
import type { Order, Shift } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, update, push, runTransaction } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useRtdbList } from "@/hooks/use-rtdb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { StartShiftDialog } from "./start-shift-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { Textarea } from "./ui/textarea";

const requiredPermissions = ['orders:add-payment'] as const;

type AddPaymentDialogProps = {
  order: Order;
  trigger: React.ReactNode;
};

const formatCurrency = (amount: number) => `${amount.toLocaleString()} ج.م`;

function AddPaymentDialogInner({ order, closeDialog }: { order: Order, closeDialog: () => void }) {
  const [amount, setAmount] = useState(order.remainingAmount);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  const { appUser } = useUser();
  const { data: shifts } = useRtdbList<Shift>('shifts');
  const db = useDatabase();
  const { toast } = useToast();
  
  const handleSave = async () => {
    if (amount <= 0) {
      toast({ variant: "destructive", title: "مبلغ غير صحيح" });
      return;
    }
    if (!appUser) return;

    setIsLoading(true);
    let openShift = shifts.find(shift => shift.cashier?.id === appUser.id && !shift.endTime);
    if (!openShift) {
        setShowStartShiftDialog(true);
        setIsLoading(false);
        return;
    }

    const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
    const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);
    const updates: any = {
        paid: (order.paid || 0) + amount,
        remainingAmount: order.total - ((order.paid || 0) + amount),
        updatedAt: new Date().toISOString(),
    };
    
    const paymentId = push(ref(db, `daily-entries/${datePath}/orders/${order.id}/payments`)).key;
    if(paymentId) {
        updates[`payments/${paymentId}`] = { id: paymentId, amount, method: paymentMethod, date: new Date().toISOString(), userId: appUser.id, userName: appUser.fullName, shiftId: openShift.id, note };
    }
    
    try {
      await update(orderRef, updates);
      await runTransaction(ref(db, `shifts/${openShift.id}`), (s) => {
        if (s) {
            if (paymentMethod === 'Cash') s.cash = (s.cash || 0) + amount;
            else if (paymentMethod === 'Vodafone Cash') s.vodafoneCash = (s.vodafoneCash || 0) + amount;
            else if (paymentMethod === 'InstaPay') s.instaPay = (s.instaPay || 0) + amount;
        }
        return s;
      });
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      closeDialog();
    } catch (e: any) {
       toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <div className="grid gap-4 py-4">
        <div className="p-3 rounded-md bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">المبلغ المتبقي</p>
            <p className="font-bold text-lg text-destructive">{formatCurrency(order.remainingAmount)}</p>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">طريقة الدفع</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="Cash">نقدًا (كاش)</SelectItem>
                  <SelectItem value="Vodafone Cash">فودافون كاش</SelectItem>
                  <SelectItem value="InstaPay">إنستا باي</SelectItem>
              </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">المبلغ</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">ملاحظات</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="col-span-3" rows={2} />
        </div>
        <Button onClick={handleSave} className="w-full" disabled={isLoading}>{isLoading ? 'جاري الحفظ...' : 'حفظ الدفعة'}</Button>
      </div>
    </>
  );
}

export function AddPaymentDialog({ order, trigger }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { permissions } = usePermissions(requiredPermissions);

  if (!permissions.canOrdersAddPayment) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />إضافة دفعة للطلب - {order.orderCode}</DialogTitle>
          <DialogDescription>تسجيل دفعة جديدة من العميل.</DialogDescription>
        </DialogHeader>
        {open && <AddPaymentDialogInner order={order} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
