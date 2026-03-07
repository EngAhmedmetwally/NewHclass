
"use client";

import { useState, useEffect } from "react";
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
import { PlusCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useRtdbList } from "@/hooks/use-rtdb";
import type { Branch, User, Shift, Expense } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, push, set, runTransaction } from "firebase/database";
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

export function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { data: shifts } = useRtdbList<Shift>('shifts');

  const [formData, setFormData] = useState({
      description: '',
      amount: '',
      category: '',
      notes: '',
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

    // 1. Find the current open shift for this user
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

    const amount = parseFloat(formData.amount);
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

    try {
        // 2. Save the expense record
        const expenseRef = push(ref(db, 'expenses'));
        await set(expenseRef, expenseData);

        // 3. Update the shift's "refunds" (deductions) field to reflect the payment
        const shiftRef = ref(db, `shifts/${openShift.id}`);
        await runTransaction(shiftRef, (currentShift: Shift) => {
            if (currentShift) {
                // We add the expense to the 'refunds' pool which acts as a deduction from expected cash
                currentShift.refunds = (currentShift.refunds || 0) + amount;
            }
            return currentShift;
        });

        toast({ title: "تم تسجيل المصروف بنجاح", description: `تم خصم ${amount.toLocaleString()} ج.م من وردية ${appUser.fullName}.` });
        
        // Reset and close
        setFormData({ description: '', amount: '', category: '', notes: '' });
        setOpen(false);
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
          <Button size="sm" className="gap-1">
            <PlusCircle className="h-4 w-4" />
            إضافة مصروف
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تسجيل مصروف جديد</DialogTitle>
            <DialogDescription>
              سيتم تسجيل هذا المصروف وخصمه تلقائياً من ورديتك الحالية في فرع {appUser?.branchName || '...'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-muted-foreground">
                الفرع
              </Label>
              <Input value={appUser?.branchName || 'عام'} readOnly className="col-span-3 bg-muted border-none" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-muted-foreground">
                المسجل
              </Label>
              <Input value={appUser?.fullName || '...'} readOnly className="col-span-3 bg-muted border-none" />
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : null}
                حفظ المصروف وخصمه من الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
