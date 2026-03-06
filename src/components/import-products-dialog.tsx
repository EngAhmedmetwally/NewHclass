
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useDatabase, useUser } from '@/firebase';
import { ref, push, set, get, runTransaction, update } from 'firebase/database';
import type { Product, Branch } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';

const mapCategory = (category: string): 'sale' | 'rental' | 'both' | undefined => {
    const cat = category?.toLowerCase().trim();
    if (cat === 'بيع') return 'sale';
    if (cat === 'ايجار' || cat === 'إيجار') return 'rental';
    if (cat === 'بيع و ايجار' || cat === 'بيع و إيجار') return 'both';
    return undefined;
}

export function ImportProductsDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const db = useDatabase();
  const { appUser } = useUser();
  const { data: existingGroups } = useRtdbList<{name: string}>('productGroups');
  const { data: existingSizes } = useRtdbList<{name: string}>('sizes');
  const { data: branches } = useRtdbList<Branch>('branches');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const getNextProductCode = async (): Promise<string> => {
    if (!db) return '';
    const counterRef = ref(db, 'counters/products');
    let nextCode = '';

    try {
        const { committed, snapshot } = await runTransaction(counterRef, (currentData) => {
            if (currentData === null) {
                return { name: 'products', prefix: '9', value: 70000001 };
            }
            currentData.value++;
            return currentData;
        });

        if (committed && snapshot.exists()) {
            const counter = snapshot.val();
            nextCode = counter.value.toString();
        } else {
            const snapshot = await get(counterRef);
            if(snapshot.exists()){
                const counter = snapshot.val();
                const newValue = (counter.value || 0) + 1;
                await set(counterRef, { ...counter, value: newValue });
                nextCode = newValue.toString();
            } else {
                 throw new Error("Could not read counter after transaction abort.");
            }
        }
    } catch (error) {
        console.error("Transaction failed: ", error);
        toast({
            title: "فشل إنشاء الباركود",
            description: "لم يتمكن من الحصول على باركود جديد. قد يتم تكرار الباركود.",
            variant: "destructive"
        });
        nextCode = `MANUAL-${Date.now()}`;
    }
    return nextCode;
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'اسم الصنف',
      'المجموعة',
      'المقاس',
      'السعر',
      'النوع (بيع-ايجار-بيع و ايجار)',
      'الكمية',
      'الفرع',
    ];
    const data = [
      headers,
      ['فستان سهرة أحمر', 'فساتين سهرة', 'M', 1500, 'إيجار', 3, 'الفرع الرئيسي'],
      ['بدلة رجالي كحلي', 'بدل رجالي', '52', 4500, 'بيع', 10, 'فرع المهندسين'],
      ['فستان زفاف', 'فساتين زفاف', 'S', 9000, 'بيع و إيجار', 1, 'الفرع الرئيسي'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'قالب_استيراد_المنتجات.xlsx');
  };

  const handleImport = async () => {
    if (!file || !db || !appUser) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار ملف وتأكد من تسجيل الدخول.' });
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            toast({ variant: 'destructive', title: 'ملف فارغ', description: 'الملف الذي اخترته لا يحتوي على بيانات.' });
            setIsImporting(false);
            return;
        }

        const groupCache = new Set(existingGroups.map(g => g.name.toLowerCase()));
        const sizeCache = new Set(existingSizes.map(s => s.name.toLowerCase()));
        
        const newGroupsRef = ref(db, 'productGroups');
        const newSizesRef = ref(db, 'sizes');

        const productUpdates: Record<string, Partial<Product>> = {};
        
        let importedCount = 0;
        const importErrors: string[] = [];
        let rowIndex = 1; // Headers are row 1

        for (const row of json) {
          rowIndex++;
          const currentRowErrors: string[] = [];

          const groupName = row['المجموعة']?.toString().trim();
          const sizeName = row['المقاس']?.toString().trim();
          const productName = row['اسم الصنف']?.toString().trim();
          const categoryStr = row['النوع (بيع-ايجار-بيع و ايجار)']?.toString().trim();
          const price = parseFloat(row['السعر']);
          const initialStock = parseInt(row['الكمية'], 10);
          const branchName = row['الفرع']?.toString().trim();

          if (!productName) currentRowErrors.push("اسم الصنف مفقود");
          if (!categoryStr) currentRowErrors.push("النوع مفقود");
          if (isNaN(price)) currentRowErrors.push("السعر غير صالح");
          if (isNaN(initialStock)) currentRowErrors.push("الكمية غير صالحة");
          if (!branchName) currentRowErrors.push("الفرع مفقود");

          const category = mapCategory(categoryStr);
          if (categoryStr && !category) {
              currentRowErrors.push(`النوع "${categoryStr}" غير صالح.`);
          }

          const foundBranch = branches.find(b => b.name === branchName);
          if (branchName && !foundBranch) {
              currentRowErrors.push(`الفرع "${branchName}" غير موجود.`);
          }
          
          if(currentRowErrors.length > 0) {
            importErrors.push(`- الصف ${rowIndex}: ${currentRowErrors.join(', ')}`);
            continue;
          }

          if (groupName && !groupCache.has(groupName.toLowerCase())) {
            const newGroupRef = push(newGroupsRef);
            await set(newGroupRef, { name: groupName });
            groupCache.add(groupName.toLowerCase());
          }
           if (sizeName && !sizeCache.has(sizeName.toLowerCase())) {
            const newSizeRef = push(newSizesRef);
            await set(newSizeRef, { name: sizeName });
            sizeCache.add(sizeName.toLowerCase());
          }

          const productCode = await getNextProductCode();
          if (!productCode) {
              importErrors.push(`- الصف ${rowIndex}: فشل في إنشاء باركود.`);
              continue;
          }

          const newProductRef = push(ref(db, 'products'));
          const newProductId = newProductRef.key!;

          const newProductData: Product = {
            id: newProductId,
            name: productName,
            productCode,
            category: category!,
            price,
            size: sizeName || '',
            branchId: foundBranch!.id,
            description: '',
            initialStock,
            quantityInStock: initialStock,
            quantityRented: 0,
            quantitySold: 0,
            rentalCount: 0,
            status: initialStock > 0 ? 'Available' : 'Unavailable',
            group: groupName || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPlaceholder: false,
            showInAllBranches: false,
          };
          
          productUpdates[`products/${newProductId}`] = newProductData;
          importedCount++;
        }

        if (importedCount > 0) {
            await update(ref(db), productUpdates);
        }

        const skippedRowCount = importErrors.length;
        if (skippedRowCount > 0) {
            toast({
                variant: 'destructive',
                title: `فشل استيراد ${skippedRowCount} صف`,
                description: (
                    <div className="text-right">
                        <p className="mb-2">الرجاء إصلاح الأخطاء التالية في ملف Excel والمحاولة مرة أخرى:</p>
                        <ul className="list-disc pr-5 text-xs text-right max-h-40 overflow-y-auto">
                            {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                ),
                duration: 15000,
            });
        } else if (importedCount > 0) {
            toast({
                title: 'اكتمل الاستيراد',
                description: `تم استيراد ${importedCount} منتج بنجاح.`,
            });
            setOpen(false);
        } else {
             toast({
                variant: 'destructive',
                title: 'لم يتم الاستيراد',
                description: 'لم يتم العثور على بيانات صالحة في الملف.',
            });
        }
        
      } catch (error: any) {
        console.error("Import error:", error);
        toast({ variant: 'destructive', title: 'فشل الاستيراد', description: error.message });
      } finally {
        setIsImporting(false);
        setFile(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>استيراد المنتجات من ملف Excel</DialogTitle>
          <DialogDescription>
            اختر ملف Excel لرفع المنتجات بشكل جماعي. تأكد من أن الملف يحتوي على الأعمدة المطلوبة: `اسم الصنف`, `المجموعة`, `المقاس`, `السعر`, `النوع (بيع-ايجار-بيع و ايجار)`, `الكمية`, `الفرع`.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="excel-file">ملف Excel</Label>
            <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
          </div>
          <Button
            variant="link"
            className="gap-1 text-xs justify-start p-0 h-auto"
            onClick={handleDownloadTemplate}
          >
            <Download className="h-3 w-3" />
            تحميل قالب Excel مع بيانات نموذجية
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileUp className="ml-2 h-4 w-4" />}
            {isImporting ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
