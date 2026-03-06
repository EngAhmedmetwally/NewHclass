

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

export function AddPaymentDialog({ order, trigger }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  const { appUser } = useUser();
  
  useEffect(() => {
    if (open) {
      setAmount(order.remainingAmount);
      setNote("");
    }
  }, [open, order]);


  const { data: shifts } = useRtdbList<Shift>('shifts');
  const db = useDatabase();
  const { toast } = useToast();
  
  const handleSave = async () => {
    if (amount <= 0) {
      toast({ variant: "destructive", title: "مبلغ غير صحيح", description: "الرجاء إدخال مبلغ أكبر من صفر." });
      return;
    }
    if (!appUser) {
        toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على بيانات المستخدم." });
        return;
    }

    setIsLoading(true);
    
    // --- 1. Find open shift or prompt to create one ---
    let openShift = shifts.find(shift => shift.cashier?.id === appUser.id && !shift.endTime);
    
    if (!openShift) {
        toast({ variant: "destructive", title: "لا توجد وردية مفتوحة", description: "يجب بدء وردية جديدة لتسجيل الدفعات." });
        setShowStartShiftDialog(true);
        setIsLoading(false);
        return;
    }

    // --- 2. Prepare Order Update ---
    const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
    const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);
    
    const updates: any = {};
    updates.paid = (order.paid || 0) + amount;
    updates.remainingAmount = order.total - updates.paid;
    updates.updatedAt = new Date().toISOString();
    
    const paymentNote = `[دفعة] [${new Date().toLocaleString('ar-EG')}] تم استلام ${formatCurrency(amount)} بواسطة ${appUser.fullName}. ${note ? `ملاحظة: ${note}` : ''}`;
    updates.notes = `${order.notes || ''}\n${paymentNote}`;

    const paymentId = push(ref(db, `daily-entries/${datePath}/orders/${order.id}/payments`)).key;
    if(paymentId) {
        updates[`payments/${paymentId}`] = {
            id: paymentId,
            amount: amount,
            method: paymentMethod,
            date: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            shiftId: openShift.id,
            note: note || null,
        };
    }
    
    // --- 3. Prepare Shift Update ---
    const shiftRef = ref(db, `shifts/${openShift.id}`);

    try {
      await update(orderRef, updates);

      // --- 4. Use transaction for shift update to avoid race conditions ---
      await runTransaction(shiftRef, (currentShift) => {
        if (currentShift) {
            if (paymentMethod === 'Cash') {
                currentShift.cash = (currentShift.cash || 0) + amount;
            } else if (paymentMethod === 'Vodafone Cash') {
                currentShift.vodafoneCash = (currentShift.vodafoneCash || 0) + amount;
            } else if (paymentMethod === 'InstaPay') {
                currentShift.instaPay = (currentShift.instaPay || 0) + amount;
            }
        }
        return currentShift;
      });
      
      toast({
          title: "تم تسجيل الدفعة بنجاح",
          description: `تمت إضافة مبلغ ${formatCurrency(amount)} إلى الطلب ${order.orderCode}.`,
      });
      setAmount(0);
      setOpen(false);

    } catch (error: any) {
       toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدفعة",
          description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!permissions.canOrdersAddPayment) {
    return null;
  }

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              إضافة دفعة للطلب - {order.orderCode}
            </DialogTitle>
            <DialogDescription>
              تسجيل دفعة جديدة من العميل لهذا الطلب.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 rounded-md bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">المبلغ المتبقي حاليًا</p>
                <p className="font-bold text-lg text-destructive">{formatCurrency(order.remainingAmount)}</p>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment-method" className="text-right">
                طريقة الدفع
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" className="col-span-3">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="Cash">نقدًا (كاش)</SelectItem>
                      <SelectItem value="Vodafone Cash">فودافون كاش</SelectItem>
                      <SelectItem value="InstaPay">إنستا باي</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                المبلغ المدفوع
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="col-span-3"
                placeholder="0.00"
              />
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="note" className="text-right pt-2">
                    ملاحظات
                </Label>
                <Textarea 
                    id="note" 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="col-span-3" 
                    placeholder="أضف ملاحظة على هذه الدفعة (اختياري)..." 
                />
             </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSave} className="w-full" disabled={isLoading}>
              {isLoading ? 'جاري الحفظ...' : 'حفظ الدفعة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
