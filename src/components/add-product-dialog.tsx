
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "./ui/textarea";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Switch } from "./ui/switch";
import type { Product, Branch, Counter } from "@/lib/definitions";
import { useRtdbList } from "@/hooks/use-rtdb";
import { useDatabase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { ref, set, push, runTransaction, get } from "firebase/database";
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
  const { appUser, isUserLoading } = useUser();
  const db = useDatabase();
  const { toast } = useToast();

  const [name, setName] = useState(product?.name || '');
  const [size, setSize] = useState(product?.size || '');
  const [group, setGroup] = useState(product?.group || '');
  const [category, setCategory] = useState<string | undefined>(product?.category);
  const [price, setPrice] = useState(Number(product?.price) || 0);
  const [productCode, setProductCode] = useState(product?.productCode || '');
  const [initialStock, setInitialStock] = useState(product?.initialStock || 1);
  const [branchId, setBranchId] = useState<string | undefined>(product?.branchId);
  const [isGlobalProduct, setIsGlobalProduct] = useState(product?.showInAllBranches || false);
  const [notes, setNotes] = useState(product?.description || '');

  const { data: allProducts } = useRtdbList<Product>('products');
  const { data: branches } = useRtdbList<Branch>('branches');

  useEffect(() => {
    if (!isEditMode && !productCode) {
        const counterRef = ref(db, 'counters/products');
        runTransaction(counterRef, (c) => {
            if (!c) return { name: 'products', value: 90000001 };
            c.value++; return c;
        }).then(res => setProductCode(res.snapshot.val().value.toString()));
    }
  }, [isEditMode, db, productCode]);

  const handleSave = async () => {
    if (!name || !category || !price || !productCode) {
        toast({ variant: "destructive", title: "الحقول مطلوبة" });
        return;
    }
    const productData = {
        name, size, group, category, price, productCode, initialStock, 
        branchId: isGlobalProduct ? '' : (branchId || appUser?.branchId || ''),
        showInAllBranches: isGlobalProduct, description: notes,
        quantityInStock: isEditMode ? product!.quantityInStock : initialStock,
        quantityRented: product?.quantityRented || 0,
        quantitySold: product?.quantitySold || 0,
        updatedAt: new Date().toISOString(),
        createdAt: product?.createdAt || new Date().toISOString(),
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
    <div className="grid md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto">
        <div className="space-y-4">
            <Label>اسم المنتج</Label><Input value={name} onChange={e => setName(e.target.value)} />
            <Label>المقاس</Label><div className="flex gap-2"><Input value={size} readOnly /><SelectSizeDialog onSelectSize={setSize} /></div>
            <Label>المجموعة</Label><div className="flex gap-2"><Input value={group} readOnly /><SelectProductGroupDialog onSelectProductGroup={setGroup} /></div>
            <Label>الفئة</Label>
            <Select onValueChange={setCategory} value={category}>
                <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                <SelectContent><SelectItem value="rental">إيجار فقط</SelectItem><SelectItem value="sale">بيع فقط</SelectItem><SelectItem value="both">بيع وإيجار</SelectItem></SelectContent>
            </Select>
        </div>
        <div className="space-y-4">
            <Label>السعر</Label><Input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value))} />
            <Label>الباركود</Label><Input value={productCode} readOnly />
            <Label>الكمية</Label><Input type="number" value={initialStock} onChange={e => setInitialStock(parseInt(e.target.value))} />
            <div className="flex items-center gap-2 pt-4"><Switch checked={isGlobalProduct} onCheckedChange={setIsGlobalProduct} /><Label>عرض في كل الفروع</Label></div>
        </div>
        <Button onClick={handleSave} className="md:col-span-2 h-12">حفظ المنتج</Button>
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
          <DialogTitle>{product ? 'تعديل منتج' : 'إضافة منتج جديد'}</DialogTitle>
          <DialogDescription>أكمل بيانات المنتج لحفظه.</DialogDescription>
        </DialogHeader>
        {open && <AddProductDialogInner product={product} closeDialog={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
