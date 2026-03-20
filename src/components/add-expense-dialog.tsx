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

const expenseCategories = [
    { value: 'salaries', label: 'مرتبات' },
    { value: 'rent', label: 'إيجار' },
    { value: 'utilities', label: 'فواتير ومرافق' },
    { value: 'maintenance', label: 'صيانة' },
    { value: 'marketing', label: 'تسويق وإعلان' },
    { value: 'supplies', label: 'مستلزمات تشغيل' },
    { value: 'other', label: 'أخرى' },
]

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
  
  // Check if user has permission to view/manage treasuries
  const { permissions, isLoading: isLoadingPerms } = usePermissions(['treasuries:view'] as const);

  const [sourceType, setSourceType] = useState<'shift' | 'treasury'>(expense?.treasuryId ? 'treasury' : 'shift');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>(expense?.treasuryId || '');

  // Reset source type if permissions change or on open
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
      category: expenseCategories.find(c => c.label === expense?.category)?.value || 'other',
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
    const amount = parseFloat(formData.amount);
    
    try {
        if (isEditMode && expense) {
            // EDIT LOGIC
            const expenseRef = ref(db, `expenses/${expense.id}`);
            const oldAmount = expense.amount;
            const diff = amount - oldAmount;

            await update(expenseRef, {
                description: formData.description,
                amount: amount,
                category: expenseCategories.find(c => c.value === formData.category)?.label || formData.category,
                notes: formData.notes,
                updatedAt: new Date().toISOString()
            });

            if (expense.shiftId) {
                const shiftRef = ref(db, `shifts/${expense.shiftId}`);
                await runTransaction(shiftRef, (s) => { if (s) s.refunds = (s.refunds || 0) + diff; return s; });
            } else if (expense.treasuryId) {
                const treasuryRef = ref(db, `treasuries/${expense.treasuryId}`);
                await runTransaction(treasuryRef, (t: Treasury) => {
                    if (t) {
                        t.balance = (t.balance || 0) - diff;
                        // Find the corresponding treasury transaction to update it too
                        if (t.transactions) {
                            const txId = Object.keys(t.transactions).find(k => t.transactions![k].description.includes(expense.id));
                            if (txId) t.transactions[txId].amount = -amount;
                        }
                    }
                    return t;
                });
            }

            toast({ title: "تم التحديث بنجاح" });
            setOpen(false);
        } else {
            // CREATE LOGIC
            const expenseData: Omit<Expense, 'id'> = {
                description: formData.description,
                amount: amount,
                category: expenseCategories.find(c => c.value === formData.category)?.label || formData.category,
                date: new Date().toISOString(),
                userId: appUser.id,
                userName: appUser.fullName,
                branchId: appUser.branchId || 'all',
                branchName: appUser.branchName || 'عام',
                notes: formData.notes
            };

            const expenseRef = push(ref(db, 'expenses'));
            const expenseId = expenseRef.key!;

            if (sourceType === 'shift') {
                let shiftIdToUse: string;
                if (isFixedShiftMode && targetShift) {
                    shiftIdToUse = targetShift.id;
                } else {
                    const openShift = shifts.find(s => s.cashier?.id === appUser.id && !s.endTime);
                    if (!openShift) {
                        toast({ variant: "destructive", title: "لا توجد وردية مفتوحة" });
                        setShowStartShiftDialog(true);
                        setIsLoading(false);
                        return;
                    }
                    shiftIdToUse = openShift.id;
                }
                expenseData.shiftId = shiftIdToUse;
                await set(expenseRef, expenseData);
                await runTransaction(ref(db, `shifts/${shiftIdToUse}`), (s) => { if (s) s.refunds = (s.refunds || 0) + amount; return s; });
            } else {
                // Treasury Logic
                expenseData.treasuryId = selectedTreasuryId;
                await set(expenseRef, expenseData);
                
                const treasuryRef = ref(db, `treasuries/${selectedTreasuryId}`);
                await runTransaction(treasuryRef, (t: Treasury) => {
                    if (t) {
                        t.balance = (t.balance || 0) - amount;
                        const txRef = push(ref(db, `treasuries/${selectedTreasuryId}/transactions`));
                        const txId = txRef.key!;
                        if (!t.transactions) t.transactions = {};
                        t.transactions[txId] = {
                            id: txId,
                            type: 'expense',
                            amount: -amount,
                            description: `مصروف: ${formData.description} (${expenseId})`,
                            date: new Date().toISOString(),
                            userId: appUser.id,
                            userName: appUser.fullName
                        };
                    }
                    return t;
                });
            }

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
            {/* Show Source Type only if user has Treasury View Permission AND it's not a fixed shift mode or edit mode */}
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
                        <SelectContent>{expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">ملاحظات</Label>
                    <Textarea value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} className="col-span-3" rows={2} />
                </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleSave} disabled={isLoading || isLoadingPerms} className="w-full h-12">
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                {isEditMode ? 'حفظ التعديلات' : 'تأكيد وحفظ المصروف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}