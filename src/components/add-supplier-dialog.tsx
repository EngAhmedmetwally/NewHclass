
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
import type { Supplier } from "@/lib/definitions";
import { useDatabase } from "@/firebase";
import { ref, set, push, update } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";

type AddSupplierDialogProps = {
    supplier?: Supplier;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSupplierCreated?: (supplierId: string) => void;
}

export function AddSupplierDialog({ supplier, open, onOpenChange, onSupplierCreated }: AddSupplierDialogProps) {
  const isEditMode = !!supplier;
  const db = useDatabase();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      address: '',
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && supplier) {
        setFormData({
            name: supplier.name || '',
            phone: supplier.phone || '',
            address: supplier.address || '',
        });
      } else {
        setFormData({
            name: '',
            phone: '',
            address: '',
        });
      }
    }
  }, [open, supplier, isEditMode]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setFormData(prev => ({...prev, [id]: value}));
  }

  const handleSave = async () => {
      if (!formData.name) {
          toast({ variant: "destructive", title: "اسم المورد مطلوب" });
          return;
      }
      
      const supplierData = {
          ...formData,
          updatedAt: new Date().toISOString(),
      };

      try {
          if (isEditMode && supplier.id) {
              const supplierRef = ref(db, `suppliers/${supplier.id}`);
              await update(supplierRef, supplierData);
              toast({ title: "تم تحديث المورد بنجاح" });
              onSupplierCreated?.(supplier.id);
          } else {
              const newSupplierRef = push(ref(db, 'suppliers'));
              const newSupplierId = newSupplierRef.key;
              if (!newSupplierId) throw new Error("Failed to create new supplier ID.");
              await set(newSupplierRef, { ...supplierData, id: newSupplierId, createdAt: new Date().toISOString() });
              toast({ title: "تم إضافة المورد بنجاح" });
              onSupplierCreated?.(newSupplierId);
          }
          onOpenChange(false);
      } catch (error: any) {
          toast({ variant: "destructive", title: "حدث خطأ", description: error.message });
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'تعديل مورد' : 'إضافة مورد جديد'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'قم بتحديث تفاصيل المورد.' : 'املأ تفاصيل المورد الجديد هنا.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              اسم المورد
            </Label>
            <Input id="name" value={formData.name} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              رقم الهاتف
            </Label>
            <Input id="phone" value={formData.phone} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              العنوان
            </Label>
            <Input id="address" value={formData.address} onChange={handleChange} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>حفظ المورد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
