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
import type { Customer, Region } from "@/lib/definitions";
import { usePermissions } from "@/hooks/use-permissions";
import { useRtdbList } from "@/hooks/use-rtdb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

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
  const [regionId, setRegionId] = useState<string>('none');
  
  const { permissions } = usePermissions(requiredPermissions);
  const { data: regions } = useRtdbList<Region>('regions');

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
    if (!customerId) return;

    const region = regions.find(r => r.id === regionId);

    const customerData: Customer = {
        id: customerId,
        name,
        primaryPhone,
        secondaryPhone,
        regionId: regionId === 'none' ? undefined : regionId,
        regionName: region ? region.name : undefined,
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
        setRegionId('none');
        setOpen(false);

    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  }

  const defaultTrigger = (
     <Button size="sm" className="gap-1">
        <PlusCircle className="h-4 w-4" />
        أضف عميل
    </Button>
  );
  
  if (!permissions.canCustomersAdd && !trigger) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة عميل جديد</DialogTitle>
          <DialogDescription>املأ تفاصيل العميل الجديد هنا.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">الاسم</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="primaryPhone" className="text-right">الهاتف</Label>
            <Input id="primaryPhone" value={primaryPhone} onChange={e => setPrimaryPhone(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="region" className="text-right">المنطقة</Label>
            <div className="col-span-3">
                <Select value={regionId} onValueChange={setRegionId}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">غير محدد</SelectItem>
                        {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="secondaryPhone" className="text-right">هاتف آخر</Label>
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
