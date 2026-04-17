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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import type { User, Shift } from "@/lib/definitions";
import { useDatabase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, set, push, runTransaction } from "firebase/database";
import { useSyncManager } from "@/providers/sync-provider";
import { db } from "@/lib/db";
import { useRtdbList } from "@/hooks/use-rtdb";

type StartShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

export function StartShiftDialog({ open, onOpenChange, user }: StartShiftDialogProps) {
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dbRTDB = useDatabase();
  const { toast } = useToast();
  const { isOnline } = useSyncManager();
  const { data: allShifts } = useRtdbList<Shift>('shifts');

  const handleStartShift = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "خطأ", description: "المستخدم غير معروف."});
        return;
    }
    
    // Check for existing open shift
    if (allShifts && allShifts.some(shift => shift.cashier.id === user.id && !shift.endTime)) {
      toast({
        variant: "destructive",
        title: "لديك وردية مفتوحة بالفعل",
        description: "لا يمكنك بدء وردية جديدة حتى يتم إغلاق ورديتك الحالية.",
      });
      return;
    }
    
    setIsLoading(true);
    
    // 1. Get Sequential Shift Number
    let shiftCode = '';
    if (isOnline) {
        try {
            const counterRef = ref(dbRTDB, 'counters/shifts');
            const counterResult = await runTransaction(counterRef, (currentData) => {
                if (currentData === null) return { value: 1 };
                currentData.value++;
                return currentData;
            });
            if (counterResult.committed) {
                shiftCode = counterResult.snapshot.val().value.toString();
            }
        } catch (e) {
            console.error("Failed to get shift sequence", e);
        }
    }

    const cashierData = { id: user.id, name: user.fullName };
    const shiftPayload = {
        cashier: cashierData,
        shiftCode: shiftCode || `S-${Date.now().toString().slice(-6)}`,
        startTime: new Date().toISOString(),
        openingBalance: openingBalance,
        cash: 0,
        vodafoneCash: 0,
        instaPay: 0,
        visa: 0,
        refunds: 0,
        discounts: 0,
        salesTotal: 0,
        rentalsTotal: 0,
    };

    if (!isOnline) {
        try {
            await db.syncQueue.add({
                type: 'start-shift',
                payload: shiftPayload,
                timestamp: Date.now(),
            });
            toast({ title: 'أنت غير متصل', description: 'تم حفظ الوردية محليًا وستتم مزامنتها عند عودة الاتصال.' });
            setOpeningBalance(0);
            onOpenChange(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: 'خطأ في الحفظ المحلي', description: e.message });
        } finally {
            setIsLoading(false);
        }
        return;
    }

    try {
        const newShiftRef = push(ref(dbRTDB, 'shifts'));
        const newShiftId = newShiftRef.key;

        if (!newShiftId) {
            throw new Error("Could not create a unique ID for the new shift.");
        }

        const shiftData = {
            id: newShiftId,
            ...shiftPayload
        };

        await set(newShiftRef, shiftData);

        toast({
            title: "تم بدء الوردية بنجاح!",
            description: `وردية ${user.fullName} بدأت برصيد افتتاحي ${openingBalance.toLocaleString()} ج.م.`
        });
        setOpeningBalance(0);
        onOpenChange(false);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "خطأ في بدء الوردية",
            description: error.message
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            بدء وردية جديدة
          </DialogTitle>
          <DialogDescription>
            أدخل الرصيد الافتتاحي لبدء وردية جديدة لتسجيل العمليات المالية.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="openingBalance" className="text-right">
              الرصيد الافتتاحي
            </Label>
            <Input
              id="openingBalance"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
              className="col-span-3"
              placeholder="0.00"
            />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              المستخدم
            </Label>
            <Input
              value={user.fullName}
              readOnly
              className="col-span-3 bg-muted border-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleStartShift} disabled={isLoading}>
            {isLoading ? "جاري التحميل..." : "بدء الوردية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
