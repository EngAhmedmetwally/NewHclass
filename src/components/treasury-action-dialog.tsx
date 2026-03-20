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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDatabase, useUser } from '@/firebase';
import { ref, push, set, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { Treasury, TreasuryTransaction } from '@/lib/definitions';
import { Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

type TreasuryActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treasury: Treasury | null;
  type: 'deposit' | 'withdrawal';
};

export function TreasuryActionDialog({ open, onOpenChange, treasury, type }: TreasuryActionDialogProps) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const db = useDatabase();
  const { appUser } = useUser();
  const { toast } = useToast();

  const handleAction = async () => {
    if (!treasury || amount <= 0 || !description || !appUser) {
      toast({ variant: 'destructive', title: 'بيانات غير مكتملة' });
      return;
    }

    if (type === 'withdrawal' && amount > treasury.balance) {
        toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'المبلغ المطلوب سحبه أكبر من الرصيد الحالي للخزينة.' });
        return;
    }

    setIsLoading(true);
    try {
      const treasuryRef = ref(db, `treasuries/${treasury.id}`);
      const txRef = push(ref(db, `treasuries/${treasury.id}/transactions`));
      const txId = txRef.key!;

      const txData: TreasuryTransaction = {
        id: txId,
        type,
        amount: type === 'deposit' ? amount : -amount,
        description,
        date: new Date().toISOString(),
        userId: appUser.id,
        userName: appUser.fullName,
        notes,
      };

      await runTransaction(treasuryRef, (currentData: Treasury) => {
        if (currentData) {
          currentData.balance = (currentData.balance || 0) + txData.amount;
          if (!currentData.transactions) currentData.transactions = {};
          currentData.transactions[txId] = txData;
          currentData.updatedAt = new Date().toISOString();
        }
        return currentData;
      });

      toast({ title: type === 'deposit' ? 'تم الإيداع بنجاح' : 'تم السحب بنجاح' });
      onOpenChange(false);
      setAmount(0);
      setDescription('');
      setNotes('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ في العملية', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const isDeposit = type === 'deposit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isDeposit ? <ArrowUpCircle className="h-5 w-5 text-green-600"/> : <ArrowDownCircle className="h-5 w-5 text-destructive"/>}
            {isDeposit ? 'إيداع نقدي' : 'سحب نقدي'} - {treasury?.name}
          </DialogTitle>
          <DialogDescription className="text-right">
              الرصيد الحالي: <strong>{Math.round(treasury?.balance || 0).toLocaleString()} ج.م</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ (ج.م)</Label>
            <Input id="amount" type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">البيان / السبب</Label>
            <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder={isDeposit ? "مثال: توريد مبيعات الأمس" : "مثال: دفعة لمورد"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات إضافية</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAction} disabled={isLoading} variant={isDeposit ? 'default' : 'destructive'} className="w-full">
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تأكيد {isDeposit ? 'الإيداع' : 'السحب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}