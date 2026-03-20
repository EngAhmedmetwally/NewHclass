"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tags, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useDatabase } from '@/firebase';
import { ref, push, set, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

export function ManageExpenseCategoriesDialog() {
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { data: categories, isLoading } = useRtdbList<{name: string}>('expenseCategories');
  const db = useDatabase();
  const { toast } = useToast();

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    // Check for duplicates
    if (categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())) {
        toast({ variant: "destructive", title: "هذه الفئة موجودة بالفعل" });
        return;
    }

    setIsSaving(true);
    try {
      const newRef = push(ref(db, 'expenseCategories'));
      await set(newRef, { name: newCategory.trim() });
      setNewCategory('');
      toast({ title: "تمت إضافة الفئة بنجاح" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ في الحفظ", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    try {
      await remove(ref(db, `expenseCategories/${id}`));
      toast({ title: `تم حذف الفئة "${name}"` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل الحذف", description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Tags className="h-4 w-4" />
          إدارة الفئات
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            إدارة فئات المصروفات
          </DialogTitle>
          <DialogDescription className="text-right">
            يمكنك إضافة أو حذف فئات المصروفات التي تظهر في قائمة الاختيار.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex gap-2">
            <Input 
                placeholder="اسم الفئة الجديدة..." 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={isSaving || !newCategory.trim()}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-2 border rounded-md p-2 max-h-[300px] overflow-y-auto">
            {isLoading ? (
                <div className="py-4 text-center text-muted-foreground">جاري التحميل...</div>
            ) : categories.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <span>لا توجد فئات مخصصة بعد.</span>
                </div>
            ) : (
                categories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-sm group">
                        <span className="font-medium">{cat.name}</span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
