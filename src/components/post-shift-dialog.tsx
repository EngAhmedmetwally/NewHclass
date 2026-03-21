
'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useDatabase, useUser } from '@/firebase';
import { ref, push, update, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Shift, Treasury, TreasuryTransaction, Order, Expense } from '@/lib/definitions';
import { Loader2, Landmark, Wallet, ArrowUpRight, CheckCircle2, Phone, Smartphone, Banknote } from 'lucide-react';
import { Separator } from './ui/separator';

type PostShiftDialogProps = {
  shift: Shift;
  trigger: React.ReactNode;
};

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString()} ج.م`;

export function PostShiftDialog({ shift, trigger }: PostShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const db = useDatabase();
  const { appUser } = useUser();
  const { toast } = useToast();
  const { data: treasuries } = useRtdbList<Treasury>('treasuries');
  const { data: orders } = useRtdbList<Order>('daily-entries');
  const { data: expenses } = useRtdbList<Expense>('expenses');

  // Logic to calculate distribution based on shift data
  const distribution = useMemo(() => {
    let receivedVodafone = 0;
    let receivedInstaPay = 0;

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(8640000000000000);

    orders.forEach(order => {
        if (order.status === 'Cancelled') return;
        if (order.payments) {
            Object.values(order.payments).forEach((p: any) => {
                const pDate = new Date(p.date);
                const paymentIsLinked = p.shiftId === shift.id;
                if (paymentIsLinked || (!p.shiftId && p.userId === shift.cashier.id && pDate >= shiftStartTime && pDate <= shiftEndTime)) {
                    if (p.method === 'Vodafone Cash') receivedVodafone += p.amount;
                    else if (p.method === 'InstaPay') receivedInstaPay += p.amount;
                }
            });
        }
    });

    return [
        { 
            id: 'treasury_cash', 
            name: 'الخزينة النقدية (Cash)', 
            amount: shift.closingBalance || 0, 
            icon: Banknote,
            color: 'text-primary'
        },
        { 
            id: 'treasury_vodafone', 
            name: 'خزينة فودافون كاش', 
            amount: receivedVodafone, 
            icon: Phone,
            color: 'text-purple-600'
        },
        { 
            id: 'treasury_instapay', 
            name: 'خزينة إنستا باي', 
            amount: receivedInstaPay, 
            icon: Smartphone,
            color: 'text-teal-600'
        },
    ].filter(d => d.amount > 0);
  }, [shift, orders]);

  const handlePost = async () => {
    if (!appUser || !db) return;

    setIsLoading(true);
    try {
      const shiftRef = ref(db, `shifts/${shift.id}`);
      const shiftCode = shift.shiftCode || shift.id.slice(-6).toUpperCase();
      const updates: Record<string, any> = {};
      
      let postedDetails = [];

      for (const item of distribution) {
          const targetTreasury = treasuries.find(t => t.id === item.id || t.name === item.name);
          if (!targetTreasury) {
              throw new Error(`تعذر العثور على ${item.name}. يرجى التأكد من وجودها في شاشة الخزائن.`);
          }

          const treasuryRef = ref(db, `treasuries/${targetTreasury.id}`);
          const txRef = push(ref(db, `treasuries/${targetTreasury.id}/transactions`));
          const txId = txRef.key!;
          
          const txData: TreasuryTransaction = {
            id: txId,
            type: 'deposit',
            amount: item.amount,
            description: `توريد من وردية رقم ${shiftCode}`,
            date: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName,
            notes: `بواسطة: ${shift.cashier.name}`,
          };

          // Update Treasury Balance via Transaction
          await runTransaction(treasuryRef, (currentData: Treasury) => {
            if (currentData) {
              currentData.balance = (currentData.balance || 0) + item.amount;
              if (!currentData.transactions) currentData.transactions = {};
              currentData.transactions[txId] = txData;
              currentData.updatedAt = new Date().toISOString();
            }
            return currentData;
          });
          
          postedDetails.push(item.name);
      }

      // Mark Shift as Posted
      await update(shiftRef, {
        isPosted: true,
        postedAt: new Date().toISOString(),
        postedToTreasuryName: "ترحيل مقسم (نقدي/إلكتروني)",
        updatedAt: new Date().toISOString()
      });

      toast({ title: 'تم الترحيل بنجاح', description: `تم توريد المبالغ إلى ${postedDetails.length} خزائن.` });
      setOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ في الترحيل', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {trigger}
      </div>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            ترحيل الوردية (توزيع تلقائي)
          </DialogTitle>
          <DialogDescription className="text-right">
            سيقوم النظام بتوزيع نقدية الوردية والمبالغ الإلكترونية على الخزائن المختصة آلياً.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-3">
              <Label className="font-bold">تفاصيل التوزيع المقترح:</Label>
              <div className="grid gap-2">
                  {distribution.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2">
                              <item.icon className={cn("h-4 w-4", item.color)} />
                              <span className="text-xs font-medium">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-primary">{formatCurrency(item.amount)}</span>
                      </div>
                  ))}
                  {distribution.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground border-dashed border-2 rounded-lg">
                          لا توجد مبالغ مستحقة للترحيل.
                      </div>
                  )}
              </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-blue-800 text-[10px]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>سيتم تسجيل "إيداع" في كل خزينة أعلاه بقيمة المبلغ الموضح، وستعتبر الوردية "مُرحلة" بالكامل.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1" disabled={isLoading}>إلغاء</Button>
          <Button onClick={handlePost} disabled={isLoading || distribution.length === 0} className="flex-1 gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            تأكيد التوزيع والترحيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
