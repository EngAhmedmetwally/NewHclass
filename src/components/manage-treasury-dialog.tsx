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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDatabase, useUser } from '@/firebase';
import { ref, push, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Branch } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';

type ManageTreasuryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ManageTreasuryDialog({ open, onOpenChange }: ManageTreasuryDialogProps) {
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const db = useDatabase();
  const { appUser } = useUser();
  const { toast } = useToast();
  const { data: branches } = useRtdbList<Branch>('branches');

  const handleSave = async () => {
    if (!name || !branchId || !appUser) {
      toast({ variant: 'destructive', title: 'بيانات غير مكتملة' });
      return;
    }

    setIsLoading(true);
    try {
      const branch = branches.find(b => b.id === branchId);
      const newTreasuryRef = push(ref(db, 'treasuries'));
      const treasuryId = newTreasuryRef.key!;

      const treasuryData = {
        id: treasuryId,
        name,
        branchId,
        branchName: branch?.name || '',
        balance: initialBalance,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // If initial balance > 0, create an initial transaction
      if (initialBalance > 0) {
        const txRef = push(ref(db, `treasuries/${treasuryId}/transactions`));
        const txData = {
          id: txRef.key!,
          type: 'deposit',
          amount: initialBalance,
          description: 'رصيد افتتاحي',
          date: new Date().toISOString(),
          userId: appUser.id,
          userName: appUser.fullName,
        };
        (treasuryData as any).transactions = { [txData.id]: txData };
      }

      await set(newTreasuryRef, treasuryData);
      toast({ title: 'تم إنشاء الخزينة بنجاح' });
      onOpenChange(false);
      setName('');
      setBranchId('');
      setInitialBalance(0);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة خزينة جديدة</DialogTitle>
          <DialogDescription className="text-right">قم بإنشاء خزينة جديدة لربط العمليات المالية والعهدة بها.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم الخزينة</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: الخزينة الرئيسية" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch">الفرع التابعة له</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger id="branch"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance">الرصيد الافتتاحي (ج.م)</Label>
            <Input id="balance" type="number" value={initialBalance} onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إنشاء الخزينة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}