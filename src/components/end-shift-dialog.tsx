
"use client";

import { useState } from "react";
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
import { LogOut } from "lucide-react";
import type { Shift } from "@/lib/definitions";
import { Separator } from "./ui/separator";
import { useDatabase } from "@/firebase";
import { ref, update } from "firebase/database";
import { useToast } from "@/hooks/use-toast";

type EndShiftDialogProps = {
  shift: Shift;
  trigger: React.ReactNode;
};

const formatCurrency = (amount: number) => `${amount.toLocaleString()} ج.م`;

export function EndShiftDialog({ shift, trigger }: EndShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [closingBalance, setClosingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const db = useDatabase();
  const { toast } = useToast();

  const handleEndShift = async () => {
    setIsLoading(true);
    try {
        const shiftRef = ref(db, `shifts/${shift.id}`);
        await update(shiftRef, {
            endTime: new Date().toISOString(),
            closingBalance: closingBalance,
        });

        toast({
            title: "تم إنهاء الوردية بنجاح",
            description: `تم إغلاق وردية ${shift.cashier.name}.`,
        });
        setOpen(false);
        setClosingBalance(0);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "خطأ في إنهاء الوردية",
            description: error.message,
        });
    } finally {
        setIsLoading(false);
    }
  };

  // Expected physical cash in drawer = Opening + Cash received during shift - Physical expenses/refunds
  // Note: Discounts are NOT subtracted because they represent money never received, 
  // and 'shift.cash' should only count actual cash received.
  const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0);
  const totalRevenue = (shift.salesTotal || 0) + (shift.rentalsTotal || 0);
  const difference = closingBalance - cashInDrawer;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-primary" />
            استلام وإنهاء الوردية
          </DialogTitle>
          <DialogDescription>
            قم بمراجعة ملخص الوردية وأدخل المبلغ الفعلي في الدرج لإنهاء الوردية.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm p-4 border rounded-lg bg-muted/50">
             <div className="col-span-2 font-semibold text-base">ملخص الوردية</div>
             <div className="text-muted-foreground">الموظف:</div>
             <div className="font-medium text-right">{shift.cashier?.name}</div>

             <div className="text-muted-foreground">إجمالي الإيرادات (صافي):</div>
             <div className="font-mono font-semibold text-right">{formatCurrency(totalRevenue)}</div>

             <div className="text-muted-foreground font-bold">النقدية المتوقعة بالدرج:</div>
             <div className="font-mono font-bold text-right text-primary">{formatCurrency(cashInDrawer)}</div>
          </div>

          <Separator />

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="closingBalance" className="text-right col-span-4 sm:col-span-1">
              الرصيد عند الإغلاق
            </Label>
            <Input
              id="closingBalance"
              type="number"
              value={closingBalance}
              onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
              className="col-span-4 sm:col-span-3"
              placeholder="0.00"
            />
          </div>

          {closingBalance > 0 && (
            <div className={`p-3 rounded-md text-center font-bold ${difference !== 0 ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
              {difference > 0 && `يوجد فائض: ${formatCurrency(difference)}`}
              {difference < 0 && `يوجد عجز: ${formatCurrency(Math.abs(difference))}`}
              {difference === 0 && `المبلغ مطابق`}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleEndShift} className="w-full" disabled={isLoading}>
            {isLoading ? 'جاري الحفظ...' : 'تأكيد واستلام الوردية'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
