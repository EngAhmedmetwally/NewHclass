'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDatabase, useUser } from '@/firebase';
import { ref, push, set, update, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Shift, Treasury, TreasuryTransaction } from '@/lib/definitions';
import { Loader2, Landmark, Wallet, ArrowUpRight } from 'lucide-react';

type PostShiftDialogProps = {
  shift: Shift;
  trigger: React.ReactNode;
};

export function PostShiftDialog({ shift, trigger }: PostShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const db = useDatabase();
  const { appUser } = useUser();
  const { toast } = useToast();
  const { data: treasuries } = useRtdbList<Treasury>('treasuries');

  const handlePost = async () => {
    if (!selectedTreasuryId || !appUser) {
      toast({ variant: 'destructive', title: 'الرجاء اختيار الخزينة' });
      return;
    }

    const amount = shift.closingBalance || 0;
    if (amount <= 0) {
        toast({ variant: 'destructive', title: 'خطأ في الترحيل', description: 'لا يمكن ترحيل وردية برصيد صفر أو سالب.' });
        return;
    }

    setIsLoading(true);
    try {
      const treasury = treasuries.find(t => t.id === selectedTreasuryId);
      const shiftRef = ref(db, `shifts/${shift.id}`);
      const treasuryRef = ref(db, `treasuries/${selectedTreasuryId}`);
      
      // 1. Record transaction in Treasury
      const txRef = push(ref(db, `treasuries/${selectedTreasuryId}/transactions`));
      const txId = txRef.key!;
      const txData: TreasuryTransaction = {
        id: txId,
        type: 'deposit',
        amount: amount,
        description: `توريد نقدية وردية رقم ${shift.shiftCode || shift.id.slice(-6).toUpperCase()}`,
        date: new Date().toISOString(),
        userId: appUser.id,
        userName: appUser.fullName,
        notes: `كاشير: ${shift.cashier.name}`,
      };

      // 2. Update Treasury Balance
      await runTransaction(treasuryRef, (currentData: Treasury) => {
        if (currentData) {
          currentData.balance = (currentData.balance || 0) + amount;
          if (!currentData.transactions) currentData.transactions = {};
          currentData.transactions[txId] = txData;
          currentData.updatedAt = new Date().toISOString();
        }
        return currentData;
      });

      // 3. Mark Shift as Posted
      await update(shiftRef, {
        isPosted: true,
        postedToTreasuryId: selectedTreasuryId,
        postedToTreasuryName: treasury?.name || '',
        postedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast({ title: 'تم ترحيل الوردية وإيداع المبلغ بنجاح' });
      setOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ في الترحيل', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Important: Stop propagation to prevent card click */}
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {trigger}
      </div>
      <DialogContent className="sm:max-w-md text-right" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            ترحيل الوردية للخزينة
          </DialogTitle>
          <DialogDescription className="text-right">
            سيتم إيداع رصيد الإغلاق الفعلي للوردية في الخزينة المختارة.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex flex-col items-center bg-primary/5 p-6 rounded-xl border border-dashed border-primary/20">
              <span className="text-sm text-muted-foreground mb-1">المبلغ المراد ترحيله</span>
              <span className="text-3xl font-black font-mono text-primary">
                  {(shift.closingBalance || 0).toLocaleString()} ج.م
              </span>
          </div>

          <div className="space-y-3">
            <Label className="font-bold flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                اختر الخزينة المستهدفة
            </Label>
            <Select value={selectedTreasuryId} onValueChange={setSelectedTreasuryId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="اختر الخزينة للإيداع" />
              </SelectTrigger>
              <SelectContent>
                {treasuries.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} (الرصيد: {Math.round(t.balance).toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1" disabled={isLoading}>إلغاء</Button>
          <Button onClick={handlePost} disabled={isLoading || !selectedTreasuryId} className="flex-1 gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            تأكيد الترحيل الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}