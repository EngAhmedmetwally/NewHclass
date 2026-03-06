
"use client";

import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import type { User, Branch } from "@/lib/definitions";
import { Switch } from "./ui/switch";
import { useDatabase } from '@/firebase';
import { ref, set, push, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { PERMISSIONS_CONFIG, type PermissionCategory } from '@/lib/permissions';
import { useUser } from '@/firebase';

type AddUserDialogProps = {
    user?: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ActionPermission = { id: string; label: string };

export function AddUserDialog({ user, open, onOpenChange }: AddUserDialogProps) {
  const isEditMode = !!user;
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { data: branches, isLoading: branchesLoading } = useRtdbList<Branch>('branches');

  const [formData, setFormData] = useState({
      fullName: '',
      username: '',
      password: '',
      branchId: 'all',
      isActive: true,
      role: 'seller' as 'seller' | 'cashier' | 'admin',
      permissions: [] as string[],
  });
  
  useEffect(() => {
    if (open) {
      if (isEditMode && user) {
          let userPerms = user.permissions || [];
          if (typeof userPerms === 'object' && !Array.isArray(userPerms)) {
              userPerms = Object.values(userPerms);
          }
           if (user.role === 'admin' && !userPerms.includes('all')) {
              userPerms = ['all'];
          }
          setFormData({
              fullName: user.fullName || '',
              username: user.username || '',
              password: '', 
              branchId: user.branchId || 'all',
              isActive: user.isActive ?? true,
              role: user.role || 'seller',
              permissions: userPerms,
          });
      } else {
          setFormData({
              fullName: '',
              username: '',
              password: '',
              branchId: 'all',
              isActive: true,
              role: 'seller',
              permissions: [],
          });
      }
    }
  }, [user, open, isEditMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setFormData(prev => ({...prev, [id]: value}));
  }

  const handleSelectChange = (field: keyof typeof formData) => (value: string) => {
      setFormData(prev => ({...prev, [field]: value}));
      if (field === 'role' && value === 'admin') {
          setFormData(prev => ({...prev, permissions: ['all']}));
      } else if (field === 'role' && formData.role === 'admin') {
          setFormData(prev => ({...prev, permissions: []}));
      }
  }

  const handleSwitchChange = (field: keyof typeof formData) => (checked: boolean) => {
      setFormData(prev => ({...prev, [field]: checked}));
  }

  const handlePermissionChange = (permId: string, checked: boolean) => {
    setFormData(prev => {
        const newPermissions = checked
            ? [...prev.permissions, permId]
            : prev.permissions.filter(p => p !== permId);
        return {...prev, permissions: newPermissions};
    });
  }

  const handleCategoryPermissionChange = (category: PermissionCategory, checked: boolean) => {
    setFormData(prev => {
      const categoryPerms = [
        category.view?.id,
        ...('actions' in category && category.actions ? Object.values(category.actions).map((action: any) => action.id) : [])
      ].filter(Boolean) as string[];

      const otherPerms = prev.permissions.filter(p => !categoryPerms.includes(p));

      const newPermissions = checked ? [...otherPerms, ...categoryPerms] : otherPerms;
      return { ...prev, permissions: newPermissions };
    });
  };

  const areAllCategoryPermsChecked = (category: PermissionCategory) => {
    const categoryPerms = [
        category.view?.id,
        ...('actions' in category && category.actions ? Object.values(category.actions).map((action: any) => action.id) : [])
      ].filter(Boolean) as string[];
    
    if (categoryPerms.length === 0) return false;
    
    return categoryPerms.every(p => formData.permissions.includes(p));
  }


  const handleSave = async () => {
    if (!formData.fullName || !formData.username || (!isEditMode && !formData.password)) {
        toast({
            variant: "destructive",
            title: "الحقول مطلوبة",
            description: "الرجاء تعبئة الاسم الكامل، اسم المستخدم، وكلمة المرور.",
        });
        return;
    }
    
    const branchName = branches.find(b => b.id === formData.branchId)?.name || 'كل الفروع';

    const userData: Partial<User> = {
        fullName: formData.fullName,
        username: formData.username,
        branchId: formData.branchId,
        branchName,
        isActive: formData.isActive,
        role: formData.role,
        isSeller: formData.role === 'seller' || formData.role === 'admin',
        permissions: formData.role === 'admin' ? ['all'] : formData.permissions,
        updatedAt: new Date().toISOString(),
    };
    
    if (formData.password) {
        userData.password = formData.password;
    }

    try {
        if(isEditMode && user?.id) {
            const userRef = ref(db, `users/${user.id}`);
            await update(userRef, userData);
        } else {
            const newUserRef = push(ref(db, 'users'));
            const newId = newUserRef.key;
            if (!newId) throw new Error("Failed to create user ID.");

            userData.id = newId;
            userData.createdAt = new Date().toISOString();
            await set(newUserRef, userData);
        }

        toast({
            title: "تم الحفظ بنجاح",
            description: `تم ${isEditMode ? 'تحديث' : 'حفظ'} بيانات المستخدم ${formData.fullName}.`,
        });
        
        onOpenChange(false);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "حدث خطأ",
            description: error.message || "لم يتم حفظ بيانات المستخدم.",
        });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      // FORCE DOM CLEANUP when closing to fix "frozen screen"
      if (!val) {
        setTimeout(() => {
          document.body.style.pointerEvents = 'auto';
          document.body.style.overflow = '';
          // Forcefully hide any overlays that might be stuck
          document.querySelectorAll('[data-radix-overlay]').forEach(el => {
            (el as HTMLElement).style.display = 'none';
          });
        }, 100);
      }
    }}>
      <DialogContent className="sm:max-w-4xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'قم بتحديث تفاصيل المستخدم وصلاحياته.' : 'املأ تفاصيل المستخدم الجديد وحدد صلاحياته.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                 <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">البيانات الأساسية</h4>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fullName" className="text-right">
                        الاسم الكامل
                        </Label>
                        <Input id="fullName" value={formData.fullName} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="username" className="text-right">
                        اسم المستخدم
                        </Label>
                        <Input id="username" value={formData.username} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                        كلمة المرور
                        </Label>
                        <Input id="password" type="password" value={formData.password} onChange={handleInputChange} className="col-span-3" placeholder={isEditMode ? "اتركه فارغًا لعدم التغيير" : ""} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="branch" className="text-right">
                        الفرع
                        </Label>
                        <Select value={formData.branchId} onValueChange={handleSelectChange('branchId')} disabled={branchesLoading}>
                        <SelectTrigger id="branch" className="col-span-3">
                            <SelectValue placeholder="اختر الفرع (أو اتركه فارغًا للكل)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الفروع</SelectItem>
                            {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                            الدور
                        </Label>
                        <Select value={formData.role} onValueChange={handleSelectChange('role')}>
                        <SelectTrigger id="role" className="col-span-3">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="seller">بائع</SelectItem>
                            <SelectItem value="cashier">كاشير</SelectItem>
                            <SelectItem value="admin">مدير</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            الحالة
                        </Label>
                        <div className="col-span-3 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="isActive" checked={formData.isActive} onCheckedChange={handleSwitchChange('isActive')} />
                                <Label htmlFor="isActive">نشط</Label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> الصلاحيات</h4>
                    
                    {formData.role !== 'admin' ? (
                        <Accordion type="multiple" className="w-full">
                            {Object.values(PERMISSIONS_CONFIG).map(category => (
                                <AccordionItem value={category.id} key={category.id}>
                                    <div className="flex items-center">
                                        <div className="flex items-center gap-3 p-2">
                                                <Checkbox
                                                checked={areAllCategoryPermsChecked(category)}
                                                onCheckedChange={(checked) => handleCategoryPermissionChange(category, !!checked)}
                                                aria-label={`Select all permissions for ${category.label}`}
                                            />
                                        </div>
                                        <AccordionTrigger className="flex-1 hover:no-underline p-2">
                                            {category.label}
                                        </AccordionTrigger>
                                    </div>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                                            {category.view && (
                                                <div className="flex items-center gap-3 col-span-full">
                                                    <Checkbox
                                                        id={`perm-${category.view.id}`}
                                                        checked={formData.permissions.includes(category.view.id)}
                                                        onCheckedChange={(checked) => handlePermissionChange(category.view!.id, !!checked)}
                                                    />
                                                    <Label htmlFor={`perm-${category.view.id}`} className="font-semibold">{category.view.label}</Label>
                                                </div>
                                            )}
                                            {'actions' in category && category.actions && Object.values(category.actions).map((action: ActionPermission) => (
                                                    <div key={action.id} className="flex items-center gap-3 pr-4">
                                                    <Checkbox
                                                        id={`perm-${action.id}`}
                                                        checked={formData.permissions.includes(action.id)}
                                                        onCheckedChange={(checked) => handlePermissionChange(action.id, !!checked)}
                                                    />
                                                    <Label htmlFor={`perm-${action.id}`} className="font-normal text-sm">{action.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="flex items-center justify-center text-center h-full text-muted-foreground p-4 bg-muted/50 rounded-md">
                           <p>المدير يمتلك جميع الصلاحيات بشكل افتراضي.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>{isEditMode ? 'حفظ التغييرات' : 'حفظ المستخدم'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
