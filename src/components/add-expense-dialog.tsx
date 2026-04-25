
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
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2, Wallet, Clock, Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useRtdbList } from "@/hooks/use-rtdb";
import type { Shift, Expense, Treasury } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, push, set, runTransaction, update } from "firebase/database";
import { StartShiftDialog } from "./start-shift-dialog";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export const DEFAULT_EXPENSE_CATEGORIES = [
    'مرتبات',
    'إيجار',
    'فواتير ومرافق',
    'صيانة',
    'تسويق وإعلان',
    'مستلزمات تشغيل',
    'أخرى',
];

type AddExpenseDialogProps = {
    expense?: Expense;
    targetShift?: Shift;
    trigger?: React.ReactNode;
}

export function AddExpenseDialog({ expense, targetShift, trigger }: AddExpenseDialogProps) {
  const isEditMode = !!expense;
  const isFixedShiftMode = !!targetShift;
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { data: shifts } = useRtdbList<Shift>('shifts');
  const { data: treasuries } = useRtdbList<Treasury>('treasuries');
  const { data: customCategories } = useRtdbList<{name: string}>('expenseCategories');
  
  const { permissions, isLoading: isLoadingPerms } = usePermissions(['treasuries:view'] as const);

  const availableCategories = useMemo(() => {
      const customOnes = customCategories.map(c => c.name);
      const combined = Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customOnes]));
      return combined.map(cat => ({ value: cat, label: cat }));
  }, [customCategories]);

  const [sourceType, setSourceType] = useState<'shift' | 'treasury'>(expense?.treasuryId ? 'treasury' : 'shift');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>(expense?.treasuryId || '');

  useEffect(() => {
    if (open && !isEditMode && !isFixedShiftMode) {
        if (!permissions.canTreasuriesView) {
            setSourceType('shift');
        }
    }
  }, [open, permissions.canTreasuriesView, isEditMode, isFixedShiftMode]);

  const [formData, setFormData] = useState({
      description: expense?.description || '',
      amount: expense?.amount?.toString() || '',
      category: expense?.category || 'أخرى',
      notes: expense?.notes || '',
  });

  const handleInputChange = (id: string, value: string) => {
      setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount || !formData.category) {
        toast({ variant: "destructive", title: "الحقول مطلوبة" });
        return;
    }

    if (sourceType === 'treasury' && !selectedTreasuryId) {
        toast({ variant: "destructive", title: "الرجاء اختيار الخزينة" });
        return;
    }

    if (!appUser) return;

    setIsLoading(true);
    const amountNum = parseFloat(formData.amount);
    const nowISO = new Date().toISOString();
    
    try {
        if (isEditMode && expense) {
            const expenseRef = ref(db, `expenses/${expense.id}`);
            const oldAmount = expense.amount;
            const diff = amountNum - oldAmount;

            await update(expenseRef, {
                description: formData.description,
                amount: amountNum,
                category: formData.category,
                notes: formData.notes,
                updatedAt: nowISO
            });

            if (expense.shiftId) {
                const shiftRef = ref(db, `shifts/${expense.shiftId}`);
                await runTransaction(shiftRef, (s) => { 
                  if (s) {
                    s.refunds = (s.refunds || 0) + diff;
                    s.updatedAt = nowISO;
                  }
                  return s; 
                });
            } else if (expense.treasuryId) {
                const treasuryRef = ref(db, `treasuries/${expense.treasuryId}`);
                await runTransaction(treasuryRef, (t: Treasury) => {
                    if (t) {
                        t.balance = (t.balance || 0) - diff;
                        t.updatedAt = nowISO;
                    }
                    return t;
                });
            }
            // تحديث عام لإشعار محرك المزامنة
            await update(ref(db, 'expenses'), { updatedAt: nowISO });

            toast({ title: "تم التحديث بنجاح" });
            setOpen(false);
        } else {
            const expenseData: Omit<Expense, 'id'> = {
                description: formData.description,
                amount: amountNum,
                category: formData.category,
                date: nowISO,
                userId: appUser.id,
                userName: appUser.fullName,
                branchId: appUser.branchId || 'all',
                branchName: appUser.branchName || 'عام',
                notes: formData.notes
            };

            if (sourceType === 'shift') {
                let shiftIdToUse: string;
                if (isFixedShiftMode && targetShift) {
                    shiftIdToUse = targetShift.id;
                } else {
                    const openShift = shifts.find(s => s.cashier?.id === appUser.id && !s.endTime);
                    if (!openShift) {
                        setShowStartShiftDialog(true);
                        setIsLoading(false);
                        return;
                    }
                    shiftIdToUse = openShift.id;
                }
                expenseData.shiftId = shiftIdToUse;
                const expenseRef = push(ref(db, 'expenses'));
                await set(expenseRef, { ...expenseData, id: expenseRef.key });
                await runTransaction(ref(db, `shifts/${shiftIdToUse}`), (s) => { 
                  if (s) {
                    s.refunds = (s.refunds || 0) + amountNum; 
                    s.updatedAt = nowISO;
                  }
                  return s; 
                });
            } else {
                expenseData.treasuryId = selectedTreasuryId;
                const expenseRef = push(ref(db, 'expenses'));
                await set(expenseRef, { ...expenseData, id: expenseRef.key });
                
                const treasuryRef = ref(db, `treasuries/${selectedTreasuryId}`);
                await runTransaction(treasuryRef, (t: Treasury) => {
                    if (t) {
                        t.balance = (t.balance || 0) - amountNum;
                        t.updatedAt = nowISO;
                        const txRef = push(ref(db, `treasuries/${selectedTreasuryId}/transactions`));
                        const txId = txRef.key!;
                        if (!t.transactions) t.transactions = {};
                        t.transactions[txId] = {
                            id: txId,
                            type: 'expense',
                            amount: -amountNum,
                            description: `مصروف: ${formData.description}`,
                            date: nowISO,
                            userId: appUser.id,
                            userName: appUser.fullName
                        };
                    }
                    return t;
                });
            }
            await update(ref(db, 'expenses'), { updatedAt: nowISO });
            toast({ title: "تم تسجيل المصروف بنجاح" });
            setOpen(false);
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" />إضافة مصروف</Button>}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{isEditMode ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}</DialogTitle>
            <DialogDescription className="text-right">أدخل تفاصيل المصروف وتأكد من اختيار المصدر الصحيح.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {!isEditMode && !isFixedShiftMode && permissions.canTreasuriesView && (
                <div className="space-y-3">
                    <Label className="font-bold">مصدر التمويل</Label>
                    <RadioGroup value={sourceType} onValueChange={(v: any) => setSourceType(v)} className="grid grid-cols-2 gap-4">
                        <Label htmlFor="src-shift" className={cn("flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent cursor-pointer", sourceType === 'shift' ? "border-primary" : "border-muted")}>
                            <RadioGroupItem value="shift" id="src-shift" className="sr-only" />
                            <Clock className="mb-2 h-6 w-6 text-primary" />
                            <span className="font-bold">الوردية الحالية</span>
                        </Label>
                        <Label htmlFor="src-treasury" className={cn("flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent cursor-pointer", sourceType === 'treasury' ? "border-primary" : "border-muted")}>
                            <RadioGroupItem value="treasury" id="src-treasury" className="sr-only" />
                            <Wallet className="mb-2 h-6 w-6 text-primary" />
                            <span className="font-bold">خزينة</span>
                        </Label>
                    </RadioGroup>
                </div>
            )}

            {sourceType === 'treasury' && permissions.canTreasuriesView && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <Label>اختر الخزينة</Label>
                    <Select value={selectedTreasuryId} onValueChange={setSelectedTreasuryId}>
                        <SelectTrigger><SelectValue placeholder="اختر الخزينة للمصروف" /></SelectTrigger>
                        <SelectContent>
                            {treasuries.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name} (رصيد: {Math.round(t.balance).toLocaleString()})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid gap-4 bg-muted/30 p-4 rounded-lg">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">الوصف</Label>
                    <Input value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">المبلغ</Label>
                    <Input type="number" value={formData.amount} onChange={(e) => handleInputChange('amount', e.target.value)} className="col-span-3 font-mono font-bold" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">الفئة</Label>
                    <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>{availableCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">ملاحظات</Label>
                    <Textarea value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} className="col-span-3" rows={2} />
                </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleSave} disabled={isLoading} className="w-full h-12">
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                {isEditMode ? 'حفظ التعديلات' : 'تأكيد وحفظ المصروف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
