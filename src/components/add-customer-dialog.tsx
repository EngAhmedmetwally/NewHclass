"use client";

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
import { PlusCircle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, push, set } from 'firebase/database';
import type { Customer } from "@/lib/definitions";
import { usePermissions } from "@/hooks/use-permissions";

const requiredPermissions = ['customers:add'] as const;

type AddCustomerDialogProps = {
    trigger?: React.ReactNode;
    onCustomerCreated?: (customerId: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AddCustomerDialog({ trigger, onCustomerCreated, open: externalOpen, onOpenChange: externalOnOpenChange }: AddCustomerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  
  const setOpen = (val: boolean) => {
      if (externalOnOpenChange) externalOnOpenChange(val);
      else setInternalOpen(val);
      
      // Cleanup body pointer-events when closing
      if (!val) {
          setTimeout(() => {
              document.body.style.pointerEvents = 'auto';
              document.body.style.overflow = '';
          }, 100);
      }
  };

  const [name, setName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const { permissions } = usePermissions(requiredPermissions);

  const db = useDatabase();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name || !primaryPhone) {
        toast({
            variant: "destructive",
            title: "الحقول مطلوبة",
            description: "الرجاء تعبئة اسم العميل ورقم الهاتف الأساسي.",
        });
        return;
    }
    
    const newCustomerRef = push(ref(db, 'customers'));
    const customerId = newCustomerRef.key;
    if (!customerId) {
        toast({ variant: "destructive", title: "خطأ", description: "لم يتم إنشاء معرف فريد للعميل." });
        return;
    }

    const customerData: Customer = {
        id: customerId,
        name,
        primaryPhone,
        secondaryPhone,
    };

    try {
        await set(newCustomerRef, customerData);
        toast({
            title: "تم الحفظ بنجاح",
            description: `تم إضافة العميل "${name}".`,
        });
        
        onCustomerCreated?.(customerId);

        setName('');
        setPrimaryPhone('');
        setSecondaryPhone('');
        setOpen(false);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "حدث خطأ أثناء الحفظ",
            description: error.message,
        });
    }
  }


  const defaultTrigger = (
     <Button size="sm" className="gap-1">
        <PlusCircle className="h-4 w-4" />
        أضف عميل
    </Button>
  );
  
  if (!permissions.canCustomersAdd && !trigger) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة عميل جديد</DialogTitle>
          <DialogDescription>
            املأ تفاصيل العميل الجديد هنا.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              اسم العميل
            </Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="primaryPhone" className="text-right">
              الهاتف الأساسي
            </Label>
            <Input id="primaryPhone" value={primaryPhone} onChange={e => setPrimaryPhone(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="secondaryPhone" className="text-right">
              الهاتف الثانوي
            </Label>
            <Input id="secondaryPhone" value={secondaryPhone} onChange={e => setSecondaryPhone(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>حفظ العميل</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}