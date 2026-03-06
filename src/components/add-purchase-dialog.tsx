
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { DatePickerDialog } from './ui/date-picker-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Supplier, Product, PurchaseOrder, StockMovement, Counter } from '@/lib/definitions';
import { useDatabase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ref, set, push, get, runTransaction, update } from 'firebase/database';
import { PlusCircle, Trash2 } from 'lucide-react';
import { ProductCombobox } from './product-combobox';
import { AddProductDialog } from './add-product-dialog';
import { format } from 'date-fns';
import { AddSupplierDialog } from './add-supplier-dialog';

type PurchaseItem = {
    id: string; // Unique ID for React key
    productId?: string;
    productName: string;
    quantity: number;
    costPrice: number;
    totalCost: number;
    isNew: boolean;
};

type AddPurchaseDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchaseOrder?: PurchaseOrder;
};

export function AddPurchaseDialog({ open, onOpenChange, purchaseOrder }: AddPurchaseDialogProps) {
    const isViewMode = !!purchaseOrder;
    const { appUser } = useUser();
    const db = useDatabase();
    const { toast } = useToast();
    
    const [supplierId, setSupplierId] = useState<string | undefined>();
    const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);

    const { data: suppliers, isLoading: suppliersLoading } = useRtdbList<Supplier>('suppliers');
    const { data: products, isLoading: productsLoading } = useRtdbList<Product>('products');
    const { data: counters, isLoading: countersLoading } = useRtdbList<Counter>('counters');

    useEffect(() => {
        if (open) {
            if (isViewMode && purchaseOrder) {
                setSupplierId(purchaseOrder.supplierId);
                setPurchaseDate(new Date(purchaseOrder.purchaseDate));
                setItems(purchaseOrder.items.map(item => ({
                    id: item.productId,
                    productId: item.productId,
                    productName: products.find(p => p.id === item.productId)?.name || 'منتج غير معروف',
                    quantity: item.quantity,
                    costPrice: item.costPrice,
                    totalCost: item.quantity * item.costPrice,
                    isNew: false
                })));
                setNotes(purchaseOrder.notes || '');
            } else {
                setSupplierId(undefined);
                setPurchaseDate(new Date());
                setItems([]);
                setNotes('');
            }
        }
    }, [open, purchaseOrder, isViewMode, products]);
    
    const getNextPurchaseCode = useCallback(async () => {
        if (countersLoading) return '';
        const counterRef = ref(db, 'counters/purchaseOrders');
        let nextCode = '';

        try {
            const { committed, snapshot } = await runTransaction(counterRef, (currentData) => {
                if (currentData === null) {
                    return { name: 'purchaseOrders', prefix: 'P', value: 10001 };
                }
                currentData.value++;
                return currentData;
            });

            if (committed && snapshot && snapshot.exists()) {
                const counter = snapshot.val();
                nextCode = `${counter.prefix}${counter.value}`;
            } else {
                 const snapshot = await get(counterRef);
                if(snapshot.exists()){
                    const counter = snapshot.val();
                    nextCode = `${counter.prefix}${(counter.value + (committed ? 0 : 1))}`;
                } else {
                     throw new Error("Could not read counter after transaction abort.");
                }
            }
        } catch (error) {
            console.error("Transaction failed: ", error);
            toast({
                title: "فشل إنشاء كود الفاتورة",
                description: "لم يتمكن من الحصول على كود جديد من قاعدة البيانات.",
                variant: "destructive"
            });
        }
        return nextCode;
    }, [db, countersLoading, toast]);


    const handleProductSelect = (itemId: string, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        setItems(prevItems => prevItems.map(item => 
            item.id === itemId ? {
                ...item,
                productId: product.id,
                productName: `${product.name} - ${product.size}`,
                costPrice: Number(product.price) / 2, // default cost price
                totalCost: (Number(product.price) / 2) * item.quantity,
                isNew: false,
            } : item
        ));
    };

    const handleItemChange = (itemId: string, field: keyof PurchaseItem, value: any) => {
        setItems(prevItems => {
            const newItems = prevItems.map(item => {
                if (item.id === itemId) {
                    const updatedItem = { ...item, [field]: value };
                    if (field === 'quantity' || field === 'costPrice') {
                        updatedItem.totalCost = (updatedItem.quantity || 0) * (updatedItem.costPrice || 0);
                    }
                    return updatedItem;
                }
                return item;
            });
            return newItems;
        });
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            id: Date.now().toString(),
            productName: 'منتج جديد',
            quantity: 1,
            costPrice: 0,
            totalCost: 0,
            isNew: true,
        }]);
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const totalCost = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);

    const handleSave = async () => {
        if (!supplierId || !purchaseDate || items.length === 0 || items.some(i => !i.productId)) {
            toast({ variant: 'destructive', title: 'بيانات غير كاملة', description: "الرجاء التأكد من اختيار المورد وتاريخ الفاتورة وجميع الأصناف." });
            return;
        }

        if (!appUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'المستخدم غير معروف.' });
            return;
        }
        
        const purchaseOrderCode = await getNextPurchaseCode();
        if (!purchaseOrderCode) return;

        // Process stock updates
        for (const item of items) {
            if (!item.productId) continue;
            const productRef = ref(db, `products/${item.productId}`);
            
            await runTransaction(productRef, (currentProduct: Product) => {
                if(currentProduct) {
                    const movementRef = push(ref(db, `products/${item.productId}/stockMovements`));
                    const quantityBefore = currentProduct.quantityInStock || 0;
                    currentProduct.quantityInStock = quantityBefore + item.quantity;
                    
                    const newMovement: StockMovement = {
                        id: movementRef.key!,
                        date: new Date().toISOString(),
                        type: 'addition',
                        quantity: item.quantity,
                        quantityBefore: quantityBefore,
                        quantityAfter: currentProduct.quantityInStock,
                        notes: `فاتورة شراء ${purchaseOrderCode}`,
                        userId: appUser.id,
                        userName: appUser.fullName,
                    };
                    if (!currentProduct.stockMovements) {
                        currentProduct.stockMovements = {};
                    }
                    currentProduct.stockMovements[newMovement.id] = newMovement;
                }
                return currentProduct;
            });
        }
        
        const purchaseData = {
            purchaseOrderCode,
            supplierId,
            supplierName: suppliers.find(s => s.id === supplierId)?.name || '',
            purchaseDate: format(purchaseDate, 'yyyy-MM-dd'),
            items: items.map(({ id, productName, isNew, totalCost, ...rest }) => rest),
            totalCost,
            notes,
            createdAt: new Date().toISOString(),
            userId: appUser.id,
            userName: appUser.fullName
        };

        const newPurchaseRef = push(ref(db, 'purchaseOrders'));
        const newId = newPurchaseRef.key;
        if (!newId) throw new Error("Failed to create purchase order ID.");
        
        await set(newPurchaseRef, { ...purchaseData, id: newId });
        
        toast({ title: "تم حفظ فاتورة الشراء بنجاح" });
        onOpenChange(false);
    };

    return (
        <>
            <AddSupplierDialog 
                open={isAddSupplierOpen} 
                onOpenChange={setIsAddSupplierOpen}
                onSupplierCreated={setSupplierId}
            />
            <AddProductDialog open={showAddProduct} onOpenChange={setShowAddProduct} />
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{isViewMode ? `عرض فاتورة شراء ${purchaseOrder?.purchaseOrderCode}` : 'إضافة فاتورة شراء جديدة'}</DialogTitle>
                        <DialogDescription>{isViewMode ? `تفاصيل الفاتورة المستلمة من المورد.` : 'سجل فاتورة شراء جديدة وأضف الأصناف للمخزون.'}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4 pl-1">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="supplier">المورد</Label>
                                <div className="flex gap-2">
                                    <Select value={supplierId} onValueChange={setSupplierId} disabled={suppliersLoading || isViewMode}>
                                        <SelectTrigger id="supplier">
                                            <SelectValue placeholder="اختر المورد" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                     {!isViewMode && (
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsAddSupplierOpen(true)}>
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchaseDate">تاريخ الفاتورة</Label>
                                <DatePickerDialog value={purchaseDate} onValueChange={setPurchaseDate} disabled={isViewMode} />
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <Label className="font-semibold">الأصناف</Label>
                            <div className="space-y-4 rounded-md border p-4">
                                {items.map(item => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-12 md:col-span-6 space-y-1">
                                            <Label className="text-xs">الصنف</Label>
                                            <ProductCombobox
                                                products={products}
                                                value={item.productId || ''}
                                                onChange={(productId) => handleProductSelect(item.id, productId)}
                                                disabled={productsLoading || isViewMode}
                                                placeholder="ابحث أو اختر منتج..."
                                            />
                                        </div>
                                        <div className="col-span-4 md:col-span-2 space-y-1">
                                            <Label className="text-xs">الكمية</Label>
                                            <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)} disabled={isViewMode} />
                                        </div>
                                        <div className="col-span-4 md:col-span-2 space-y-1">
                                            <Label className="text-xs">سعر التكلفة</Label>
                                            <Input type="number" value={item.costPrice} onChange={e => handleItemChange(item.id, 'costPrice', parseFloat(e.target.value) || 0)} disabled={isViewMode} />
                                        </div>
                                        <div className="col-span-3 md:col-span-1 space-y-1">
                                            <Label className="text-xs">الإجمالي</Label>
                                            <Input value={item.totalCost.toLocaleString()} readOnly className="bg-muted border-none" />
                                        </div>
                                        {!isViewMode && (
                                            <div className="col-span-1 flex items-center h-full">
                                                <Button variant="destructive" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!isViewMode && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={addItem} className="gap-1 mt-4">
                                            <PlusCircle className="h-4 w-4" />
                                            إضافة صنف
                                        </Button>
                                        <Button variant="secondary" onClick={() => setShowAddProduct(true)} className="gap-1 mt-4">
                                            <PlusCircle className="h-4 w-4" />
                                            إنشاء صنف جديد
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="notes">ملاحظات</Label>
                                <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} disabled={isViewMode} />
                            </div>
                            <div className="space-y-2">
                                <Label>الإجمالي النهائي للفاتورة</Label>
                                <Input value={`${totalCost.toLocaleString()} ج.م`} readOnly className="bg-muted text-lg font-bold text-primary" />
                            </div>
                        </div>

                    </div>
                    {!isViewMode && (
                        <DialogFooter>
                            <Button onClick={handleSave}>حفظ الفاتورة</Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
