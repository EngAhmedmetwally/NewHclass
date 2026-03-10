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
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useRtdbList } from "@/hooks/use-rtdb";
import type { Shift, Expense } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, push, set, runTransaction, update } from "firebase/database";
import { StartShiftDialog } from "./start-shift-dialog";

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
    trigger?: React.ReactNode;
}

export function AddExpenseDialog({ expense, trigger }: AddExpenseDialogProps) {
  const isEditMode = !!expense;
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { data: shifts } = useRtdbList<Shift>('shifts');

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
        toast({ variant: "destructive", title: "الحقول مطلوبة", description: "الرجاء إكمال كافة البيانات الأساسية للمصروف." });
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

            // Update Expense
            await update(expenseRef, {
                description: formData.description,
                amount: amount,
                category: expenseCategories.find(c => c.value === formData.category)?.label || formData.category,
                notes: formData.notes,
                updatedAt: new Date().toISOString()
            });

            // Update associated shift if exists
            if (expense.shiftId) {
                const shiftRef = ref(db, `shifts/${expense.shiftId}`);
                await runTransaction(shiftRef, (currentShift: Shift) => {
                    if (currentShift) {
                        currentShift.refunds = (currentShift.refunds || 0) + diff;
                    }
                    return currentShift;
                });
            }

            toast({ title: "تم تحديث المصروف بنجاح" });
            setOpen(false);
        } else {
            // CREATE LOGIC
            const openShift = shifts.find(s => s.cashier?.id === appUser.id && !s.endTime);

            if (!openShift) {
                toast({ 
                    variant: "destructive", 
                    title: "لا توجد وردية مفتوحة", 
                    description: "يجب بدء وردية أولاً لتتمكن من تسجيل المصروفات وخصمها من الدرج." 
                });
                setShowStartShiftDialog(true);
                setIsLoading(false);
                return;
            }

            const expenseData: Omit<Expense, 'id'> = {
                description: formData.description,
                amount: amount,
                category: expenseCategories.find(c => c.value === formData.category)?.label || formData.category,
                date: new Date().toISOString(),
                userId: appUser.id,
                userName: appUser.fullName,
                branchId: appUser.branchId || 'all',
                branchName: appUser.branchName || 'عام',
                shiftId: openShift.id,
                notes: formData.notes
            };

            const expenseRef = push(ref(db, 'expenses'));
            await set(expenseRef, expenseData);

            const shiftRef = ref(db, `shifts/${openShift.id}`);
            await runTransaction(shiftRef, (currentShift: Shift) => {
                if (currentShift) {
                    currentShift.refunds = (currentShift.refunds || 0) + amount;
                }
                return currentShift;
            });

            toast({ title: "تم تسجيل المصروف بنجاح", description: `تم خصم ${amount.toLocaleString()} ج.م من وردية ${appUser.fullName}.` });
            setFormData({ description: '', amount: '', category: '', notes: '' });
            setOpen(false);
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ في الحفظ", description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                إضافة مصروف
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'تعديل بيانات المصروف وتحديث الوردية تلقائياً.' : `سيتم تسجيل هذا المصروف وخصمه تلقائياً من ورديتك الحالية في فرع ${appUser?.branchName || '...'}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                الوصف
              </Label>
              <Input 
                id="description" 
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="col-span-3" 
                placeholder="مثال: فاتورة كهرباء شهر يوليو" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                المبلغ
              </Label>
              <Input 
                id="amount" 
                type="number" 
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="col-span-3" 
                placeholder="0.00" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                الفئة
              </Label>
               <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                  <SelectTrigger id="category" className="col-span-3">
                      <SelectValue placeholder="اختر فئة المصروف" />
                  </SelectTrigger>
                  <SelectContent>
                      {expenseCategories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                              {category.label}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="text-right pt-2">
                ملاحظات
              </Label>
              <Textarea 
                id="notes" 
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="col-span-3" 
                placeholder="أي تفاصيل إضافية..." 
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : null}
                {isEditMode ? 'حفظ التغييرات' : 'حفظ المصروف وخصمه من الوردية'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}