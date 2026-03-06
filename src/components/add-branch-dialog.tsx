
"use client";

import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { Branch } from "@/lib/definitions";
import { useDatabase } from "@/firebase";
import { ref, set, push, update } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";

type AddBranchDialogProps = {
    branch?: Branch;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddBranchDialog({ branch, open, onOpenChange }: AddBranchDialogProps) {
  const isEditMode = !!branch;
  const db = useDatabase();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
      name: '',
      phoneNumber: '',
      whatsappNumber: '',
      address: '',
      notes: '',
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && branch) {
        setFormData({
            name: branch.name || '',
            phoneNumber: branch.phoneNumber || '',
            whatsappNumber: branch.whatsappNumber || '',
            address: branch.address || '',
            notes: branch.notes || '',
        });
      } else {
        // Reset for "Add New" mode
        setFormData({
            name: '',
            phoneNumber: '',
            whatsappNumber: '',
            address: '',
            notes: '',
        });
      }
    }
  }, [open, branch, isEditMode]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { id, value } = e.target;
      setFormData(prev => ({...prev, [id]: value}));
  }

  const handleSave = async () => {
      if (!formData.name || !formData.phoneNumber || !formData.address) {
          toast({ variant: "destructive", title: "الحقول مطلوبة" });
          return;
      }
      
      const branchData = {
          ...formData,
          updatedAt: new Date().toISOString(),
      };

      try {
          if (isEditMode && branch.id) {
              const branchRef = ref(db, `branches/${branch.id}`);
              await update(branchRef, branchData);
              toast({ title: "تم تحديث الفرع بنجاح" });
          } else {
              const newBranchRef = push(ref(db, 'branches'));
              const newBranchId = newBranchRef.key;
              if (!newBranchId) throw new Error("Failed to create new branch ID.");
              await set(newBranchRef, { ...branchData, id: newBranchId, createdAt: new Date().toISOString() });
              toast({ title: "تم إضافة الفرع بنجاح" });
          }
          
          document.body.style.pointerEvents = 'auto';
          onOpenChange(false);
      } catch (error: any) {
          toast({ variant: "destructive", title: "حدث خطأ", description: error.message });
      }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) {
        document.body.style.pointerEvents = 'auto';
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'تعديل فرع' : 'إضافة فرع جديد'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'قم بتحديث تفاصيل الفرع.' : 'املأ تفاصيل الفرع الجديد هنا.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              اسم الفرع
            </Label>
            <Input id="name" value={formData.name} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phoneNumber" className="text-right">
              رقم الهاتف
            </Label>
            <Input id="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="whatsappNumber" className="text-right">
              رقم واتساب
            </Label>
            <Input id="whatsappNumber" value={formData.whatsappNumber} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              العنوان
            </Label>
            <Input id="address" value={formData.address} onChange={handleChange} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">
              ملاحظات
            </Label>
            <Textarea id="notes" value={formData.notes} onChange={handleChange} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>حفظ الفرع</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
