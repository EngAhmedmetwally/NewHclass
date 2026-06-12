
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
import { PlusCircle, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React, { useEffect, useState } from "react";
import { Switch } from "./ui/switch";
import type { Product, Branch } from "@/lib/definitions";
import { useRtdbList } from "@/hooks/use-rtdb";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, set, push, runTransaction } from "firebase/database";
import { SelectSizeDialog } from "./select-size-dialog";
import { SelectProductGroupDialog } from "./select-product-group-dialog";

type AddProductDialogProps = {
    product?: Product;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function AddProductDialogInner({ product, closeDialog }: { product?: Product, closeDialog: () => void }) {
  const isEditMode = !!product;
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();

  const { data: branches } = useRtdbList<Branch>('branches');

  const [name, setName] = useState(product?.name || '');
  const [size, setSize] = useState(product?.size || '');
  const [group, setGroup] = useState(product?.group || '');
  const [category, setCategory] = useState<'rental' | 'sale' | 'both' | undefined>(product?.category as any);
  const [salePrice, setSalePrice] = useState(Number(product?.salePrice) || Number(product?.price) || 0);
  const [rentalPrice, setRentalPrice] = useState(Number(product?.rentalPrice) || 0);
  const [productCode, setProductCode] = useState(product?.productCode || '');
  const [initialStock, setInitialStock] = useState(product?.initialStock || 1);
  const [branchId, setBranchId] = useState<string | undefined>(product?.branchId);
  const [isGlobalProduct, setIsGlobalProduct] = useState(product?.showInAllBranches || false);

  // اختيار أول فرع تلقائياً عند الإضافة
  useEffect(() => {
    if (!isEditMode && branches.length > 0 && !branchId) {
        setBranchId(branches[0].id);
    }
  }, [isEditMode, branches, branchId]);

  useEffect(() => {
    if (!isEditMode && !productCode) {
        const counterRef = ref(db, 'counters/products');
        runTransaction(counterRef, (c) => {
            if (!c) return { name: 'products', value: 90000001 };
            c.value++; return c;
        }).then(res => {
            if (res.committed) setProductCode(res.snapshot.val().value.toString());
        });
    }
  }, [isEditMode, db, productCode]);

  const handleSave = async () => {
    if (!name || !category || !productCode) {
        toast({ variant: "destructive", title: "الحقول مطلوبة" });
        return;
    }
    
    if ((category === 'sale' || category === 'both') && salePrice <= 0) {
         return toast({ variant: "destructive", title: "السعر مطلوب", description: "الرجاء إدخال سعر البيع." });
    }
    if ((category === 'rental' || category === 'both') && rentalPrice <= 0) {
         return toast({ variant: "destructive", title: "السعر مطلوب", description: "الرجاء إدخال سعر الإيجار." });
    }
    if (!isGlobalProduct && !branchId) {
        return toast({ variant: "destructive", title: "الفرع مطلوب", description: "الرجاء اختيار فرع المنتج." });
    }

    const mainPrice = category === 'rental' ? rentalPrice : salePrice;

    const productData = {
        name, 
        size, 
        group, 
        category, 
        price: mainPrice, 
        salePrice: category === 'rental' ? 0 : salePrice,
        rentalPrice: category === 'sale' ? 0 : rentalPrice,
        productCode, 
        initialStock, 
        branchId: isGlobalProduct ? '' : (branchId || ''),
        showInAllBranches: isGlobalProduct,
        quantityInStock: isEditMode ? product!.quantityInStock : initialStock,
        quantityRented: product?.quantityRented || 0,
        quantitySold: product?.quantitySold || 0,
        rentalCount: product?.rentalCount || 0,
        updatedAt: new Date().toISOString(),
        createdAt: product?.createdAt || new Date().toISOString(),
        status: (isEditMode ? product!.quantityInStock : initialStock) > 0 ? 'Available' : 'Unavailable'
    };

    try {
        const productRef = isEditMode ? ref(db, `products/${product!.id}`) : push(ref(db, 'products'));
        await set(productRef, productData);
        toast({ title: "تم الحفظ بنجاح" });
        closeDialog();
    } catch (e: any) {
        toast({ variant: "destructive", title: "خطأ", description: e.message });
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4" dir="rtl">
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> الفرع التابع له</Label>
                <Select value={branchId} onValueChange={setBranchId} disabled={isGlobalProduct}>
                    <SelectTrigger className="h-10">
                        <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>اسم المنتج</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: فستان سهرة مطرز" />
            </div>
            <div className="space-y-2">
                <Label>المقاس</Label>
                <div className="flex gap-2">
                    <Input value={size} readOnly className="bg-muted" />
                    <SelectSizeDialog onSelectSize={setSize} />
                </div>
            </div>
            <div className="space-y-2">
                <Label>المجموعة</Label>
                <div className="flex gap-2">
                    <Input value={group} readOnly className="bg-muted" />
                    <SelectProductGroupDialog onSelectProductGroup={setGroup} />
                </div>
            </div>
            <div className="space-y-2">
                <Label>الفئة</Label>
                <Select onValueChange={(v: any) => setCategory(v)} value={category}>
                    <SelectTrigger>
                        <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="rental">إيجار فقط</SelectItem>
                        <SelectItem value="sale">بيع فقط</SelectItem>
                        <SelectItem value="both">بيع وإيجار</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-4">
            {(category === 'sale' || category === 'both') && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-primary font-bold">سعر البيع</Label>
                    <Input type="number" value={salePrice} onChange={e => setSalePrice(parseFloat(e.target.value) || 0)} />
                </div>
            )}
            {(category === 'rental' || category === 'both') && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-blue-600 font-bold">سعر الإيجار</Label>
                    <Input type="number" value={rentalPrice} onChange={e => setRentalPrice(parseFloat(e.target.value) || 0)} />
                </div>
            )}
            <div className="space-y-2">
                <Label>الباركود / الكود</Label>
                <Input value={productCode} readOnly className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
                <Label>الكمية المتاحة (رصيد أول مدة)</Label>
                <Input type="number" value={initialStock} onChange={e => setInitialStock(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex items-center gap-3 pt-4 p-3 bg-muted/20 rounded-md">
                <Switch id="global-product" checked={isGlobalProduct} onCheckedChange={setIsGlobalProduct} />
                <Label htmlFor="global-product" className="cursor-pointer">هذا المنتج متاح للعرض والطلب في كل الفروع</Label>
            </div>
        </div>
        <Button onClick={handleSave} className="md:col-span-2 h-12 text-lg font-bold">
            {isEditMode ? 'تحديث بيانات المنتج' : 'حفظ المنتج الجديد'}
        </Button>
    </div>
  );
}

export function AddProductDialog({ product, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: AddProductDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" />أضف منتج</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-right">{product ? 'تعديل منتج' : 'إضافة منتج جديد'}</DialogTitle>
          <DialogDescription className="text-right">أكمل بيانات المنتج لحفظه في المخزون.</DialogDescription>
        </DialogHeader>
        {open && <AddProductDialogInner product={product} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
