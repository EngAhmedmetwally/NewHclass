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
import type { Region } from "@/lib/definitions";
import { useDatabase } from "@/firebase";
import { ref, set, push, update } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";

type AddRegionDialogProps = {
    region?: Region;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddRegionDialog({ region, open, onOpenChange }: AddRegionDialogProps) {
  const isEditMode = !!region;
  const db = useDatabase();
  const { toast } = useToast();
  
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      if (isEditMode && region) {
        setName(region.name || '');
      } else {
        setName('');
      }
    }
  }, [open, region, isEditMode]);
  
  const handleSave = async () => {
      if (!name.trim()) {
          toast({ variant: "destructive", title: "اسم المنطقة مطلوب" });
          return;
      }
      
      try {
          if (isEditMode && region.id) {
              const regionRef = ref(db, `regions/${region.id}`);
              await update(regionRef, {
                  name: name.trim(),
                  updatedAt: new Date().toISOString(),
              });
              toast({ title: "تم تحديث المنطقة بنجاح" });
          } else {
              const newRegionRef = push(ref(db, 'regions'));
              const newId = newRegionRef.key!;
              await set(newRegionRef, {
                  id: newId,
                  name: name.trim(),
                  createdAt: new Date().toISOString()
              });
              toast({ title: "تم إضافة المنطقة بنجاح" });
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
          <DialogTitle>{isEditMode ? 'تعديل منطقة' : 'إضافة منطقة جديدة'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'قم بتحديث اسم المنطقة.' : 'أدخل اسم المنطقة الجغرافية الجديدة.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              اسم المنطقة
            </Label>
            <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="col-span-3" 
                placeholder="مثال: مدينة نصر"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>حفظ المنطقة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
