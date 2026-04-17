
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Product } from '@/lib/definitions';
import { useDatabase } from '@/firebase';
import { ref, update, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator, SelectLabel, SelectGroup } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CircleDollarSign, SlidersHorizontal, ShieldAlert, Edit, Ban } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

// A simple debounce function to avoid installing a new library
function simpleDebounce<T extends (...args: any[]) => any>(func: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Bulk Update Cost Dialog Component
function BulkUpdateCostDialog({
    isOpen,
    onClose,
    config,
    products,
}: {
    isOpen: boolean;
    onClose: () => void;
    config: { type: 'name' | 'group'; identifier: string } | null;
    products: Product[];
}) {
    const [newCost, setNewCost] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const db = useDatabase();
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen) {
            setNewCost('');
        }
    }, [isOpen]);

    if (!config) return null;

    const handleBulkUpdate = async () => {
        const costValue = parseFloat(newCost);
        if (isNaN(costValue) || costValue < 0) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال سعر تكلفة صالح.' });
            return;
        }

        setIsLoading(true);

        const updates: Record<string, number> = {};
        let targetProducts: Product[];

        if (config.type === 'name') {
            targetProducts = products.filter(p => p.name === config.identifier);
        } else { // group
            targetProducts = products.filter(p => (p.group || 'بدون مجموعة') === config.identifier);
        }

        if (targetProducts.length === 0) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على منتجات للتحديث.' });
            setIsLoading(false);
            return;
        }

        targetProducts.forEach(p => {
            updates[`/products/${p.id}/costPrice`] = costValue;
        });

        try {
            await update(ref(db), updates);
            toast({ title: 'نجاح', description: `تم تحديث سعر التكلفة لـ ${targetProducts.length} منتج.` });
            onClose();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'فشل التحديث', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const title = config.type === 'name' 
        ? `تحديث تكلفة "${config.identifier}"` 
        : `تحديث تكلفة مجموعة "${config.identifier}"`;
    
    const description = config.type === 'name'
        ? 'سيتم تطبيق سعر التكلفة الجديد على جميع مقاسات هذا المنتج.'
        : 'سيتم تطبيق سعر التكلفة الجديد على جميع المنتجات داخل هذه المجموعة.';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="new-cost">سعر التكلفة الجديد</Label>
                    <Input
                        id="new-cost"
                        type="number"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        placeholder="أدخل سعر التكلفة..."
                        className="h-12 text-lg mt-2"
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button onClick={onClose} variant="outline" className="w-full sm:w-auto">إلغاء</Button>
                    <Button onClick={handleBulkUpdate} disabled={isLoading} className="w-full sm:w-auto">
                        {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function InventoryCostPageContent() {
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(['reports:inventory-cost'] as const);
    const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
    const { data: rawProductGroups } = useRtdbList<{name: string}>('productGroups');
    const db = useDatabase();
    const { toast } = useToast();
    
    const [filterGroup, setFilterGroup] = useState('all');
    const [filterName, setFilterName] = useState('');
    const [costTypeFilter, setCostFilter] = useState<'all' | 'zero_only'>('all');
    const [costs, setCosts] = useState<Record<string, number>>({});
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [bulkUpdateConfig, setBulkUpdateConfig] = useState<{ type: 'name' | 'group', identifier: string } | null>(null);

    const isLoading = loadingProducts || isLoadingPermissions;

    const debouncedUpdate = useCallback(simpleDebounce((productId: string, cost: number) => {
        if (!db) return;
        const productRef = ref(db, `products/${productId}/costPrice`);
        set(productRef, cost)
            .then(() => {
                toast({ title: 'تم الحفظ', description: 'تم تحديث سعر التكلفة بنجاح.', duration: 2000 });
            })
            .catch((error) => {
                toast({ variant: 'destructive', title: 'خطأ', description: error.message });
            });
    }, 1000), [db, toast]);

    const handleCostChange = (productId: string, value: string) => {
        const newCost = parseFloat(value) || 0;
        setCosts(prev => ({ ...prev, [productId]: newCost }));
        debouncedUpdate(productId, newCost);
    };

    const handleOpenBulkUpdate = (type: 'name' | 'group', identifier: string) => {
        setBulkUpdateConfig({ type, identifier });
        setIsBulkUpdateOpen(true);
    };

    const inventoryData = useMemo(() => {
        const allProductsWithCostForSummary = products.map(p => {
            const costPrice = costs[p.id] ?? p.costPrice ?? 0;
            const totalCost = costPrice * (p.quantityInStock || 0);
            return { ...p, costPrice, totalCost };
        });

        const valueByGroup = allProductsWithCostForSummary.reduce<Record<string, number>>((acc, p) => {
            const group = p.group || 'بدون مجموعة';
            acc[group] = (acc[group] || 0) + p.totalCost;
            return acc;
        }, {});
        
        if (filterGroup === 'group_by_name') {
            const groupedByName = new Map<string, any>();
            
            products.forEach(p => {
                const name = p.name || 'بدون اسم';
                const costPrice = costs[p.id] ?? p.costPrice ?? 0;
                
                // Cost Filter Logic
                if (costTypeFilter === 'zero_only' && costPrice > 0) return;

                const totalCost = costPrice * (p.quantityInStock || 0);
                const catalogPrice = Number(p.price) || 0;

                if (groupedByName.has(name)) {
                    const entry = groupedByName.get(name);
                    entry.quantityInStock += (p.quantityInStock || 0);
                    entry.totalCost += totalCost;
                    
                    // If cost prices differ within the group, mark it
                    if (entry.costPrice !== 'mixed' && entry.costPrice !== costPrice) {
                        entry.costPrice = 'mixed';
                    }
                    // If catalog prices differ within the group, mark it
                    if (entry.price !== 'mixed' && entry.price !== catalogPrice) {
                        entry.price = 'mixed';
                    }
                } else {
                    groupedByName.set(name, {
                        id: name,
                        name: name,
                        group: p.group,
                        size: "متعدد",
                        price: catalogPrice,
                        costPrice: costPrice,
                        quantityInStock: (p.quantityInStock || 0),
                        totalCost: totalCost,
                        isGrouped: true,
                    });
                }
            });
            
            let displayProducts = Array.from(groupedByName.values());
            
            if (filterName.trim()) {
                displayProducts = displayProducts.filter(p => p.name?.toLowerCase().includes(filterName.trim().toLowerCase()));
            }

            const totalValue = displayProducts.reduce((sum, p) => sum + p.totalCost, 0);
            
            return {
                products: displayProducts,
                totalValue,
                valueByGroup: Object.entries(valueByGroup).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
                isGroupedByName: true
            };

        } else {
            let displayProducts = products;
            if (filterGroup !== 'all') {
                if (filterGroup === 'بدون مجموعة') {
                    displayProducts = displayProducts.filter(p => !p.group);
                } else {
                    displayProducts = displayProducts.filter(p => p.group === filterGroup);
                }
            }
            
            if (filterName.trim()) {
                displayProducts = displayProducts.filter(p =>
                    p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
                );
            }

            // Cost Filter Logic
            if (costTypeFilter === 'zero_only') {
                displayProducts = displayProducts.filter(p => {
                    const cp = costs[p.id] ?? p.costPrice ?? 0;
                    return cp === 0;
                });
            }

            const productsWithCost = displayProducts.map(p => {
                const costPrice = costs[p.id] ?? p.costPrice ?? 0;
                const totalCost = costPrice * (p.quantityInStock || 0);
                return { ...p, costPrice, totalCost };
            });

            const totalValue = productsWithCost.reduce((sum, p) => sum + p.totalCost, 0);

            return {
                products: productsWithCost,
                totalValue,
                valueByGroup: Object.entries(valueByGroup).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
                isGroupedByName: false
            };
        }
    }, [filterGroup, filterName, costTypeFilter, products, costs]);
    
    const productGroups = useMemo(() => rawProductGroups.map(g => g.name), [rawProductGroups]);

    if (!isLoading && !permissions.canReportsInventoryCost) {
        return (
             <div className="flex flex-col gap-8">
                <PageHeader title="تكلفة المخزون" showBackButton />
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8">
                    <div className="flex flex-col items-center gap-1 text-center">
                        <ShieldAlert className="h-12 w-12 text-destructive"/>
                        <h3 className="text-2xl font-bold tracking-tight">غير مصرح لك</h3>
                        <p className="text-sm text-muted-foreground">
                            ليس لديك الصلاحية لعرض هذا التقرير.
                        </p>
                         <Link href="/reports">
                            <Button className="mt-4">العودة إلى التقارير</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }
    
    const formatCurrency = (amount: number | string | undefined | null) => {
        if (amount === undefined || amount === null) {
            return '0 ج.م';
        }
        if (typeof amount === 'string') {
            return amount === 'mixed' ? 'متفاوت' : amount;
        }
        return `${amount.toLocaleString()} ج.م`;
    };

    const renderLoadingState = () => (
        <>
            <div className="grid md:hidden gap-4">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                        <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
            <div className="hidden md:block">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            {[...Array(8)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full"/></TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-8 w-full"/></TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );

    const renderDesktopView = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[20%] text-right">اسم الصنف</TableHead>
                    <TableHead className="text-center w-[10%]">المقاس</TableHead>
                    <TableHead className="text-right w-[15%]">المجموعة</TableHead>
                    <TableHead className="text-center w-[15%]">سعر البيع/الإيجار</TableHead>
                    <TableHead className="text-center w-[15%]">سعر التكلفة</TableHead>
                    <TableHead className="text-center w-[10%]">الكمية</TableHead>
                    <TableHead className="text-center w-[15%]">إجمالي التكلفة</TableHead>
                    <TableHead className="text-center w-[10%]">إجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {inventoryData.products.map(p => (
                    <TableRow key={p.id}>
                        <TableCell className="font-medium text-right">{p.name}</TableCell>
                        <TableCell className="text-center">{p.size}</TableCell>
                        <TableCell className="text-right">{p.group || 'بدون مجموعة'}</TableCell>
                        <TableCell className="text-center font-mono font-semibold">
                            {formatCurrency(p.price)}
                        </TableCell>
                        <TableCell className="text-center">
                             {inventoryData.isGroupedByName ? (
                               <Input 
                                    type="text" 
                                    value={p.costPrice === 'mixed' ? 'أسعار متفاوتة' : p.costPrice} 
                                    readOnly 
                                    className="text-center bg-muted font-bold"
                                />
                            ) : (
                                <Input
                                    type="number"
                                    defaultValue={p.costPrice}
                                    onBlur={(e) => handleCostChange(p.id, e.target.value)}
                                    className={cn("text-center", (p.costPrice === 0 || !p.costPrice) && "border-destructive focus-visible:ring-destructive")}
                                />
                            )}
                        </TableCell>
                        <TableCell className="text-center font-mono">{p.quantityInStock}</TableCell>
                        <TableCell className="text-center font-mono font-bold">{formatCurrency(p.totalCost)}</TableCell>
                        <TableCell className="text-center">
                            <Button variant="ghost" size="icon" title={`تعديل تكلفة كل مقاسات ${p.name}`} onClick={() => handleOpenBulkUpdate('name', p.name)}>
                                <Edit className="h-4 w-4"/>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

     const renderMobileView = () => (
        <div className="grid gap-4">
            {inventoryData.products.map(p => (
                <Card key={p.id} className={cn((p.costPrice === 0 || !p.costPrice) && "border-destructive/50 bg-destructive/5")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-right">{p.name}</CardTitle>
                         <CardDescription className="text-right">
                            {p.group || 'بدون مجموعة'}
                            {p.size && ` - مقاس ${p.size}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/30 text-right">
                                <span className="text-muted-foreground text-xs">سعر البيع/الإيجار</span>
                                <span className="font-mono font-semibold">{formatCurrency(p.price)}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/30 text-right">
                                <span className="text-muted-foreground text-xs">الكمية بالمخزن</span>
                                <span className="font-mono font-semibold">{p.quantityInStock}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`cost-mobile-${p.id}`} className="text-xs font-semibold block text-right">سعر التكلفة للقطعة</Label>
                             {inventoryData.isGroupedByName ? (
                                <Input 
                                    id={`cost-mobile-${p.id}`} 
                                    value={p.costPrice === 'mixed' ? 'أسعار متفاوتة' : p.costPrice} 
                                    readOnly 
                                    className="text-center h-12 text-base bg-muted font-bold"
                                />
                            ) : (
                                <Input
                                    id={`cost-mobile-${p.id}`}
                                    type="number"
                                    defaultValue={p.costPrice}
                                    onBlur={(e) => handleCostChange(p.id, e.target.value)}
                                    className={cn("text-center h-12 text-lg font-mono", (p.costPrice === 0 || !p.costPrice) && "border-destructive")}
                                    placeholder="0.00"
                                />
                            )}
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10 text-center border border-primary/20">
                            <p className="text-xs text-primary mb-1">إجمالي قيمة تكلفة هذا الصنف</p>
                            <p className="font-bold text-xl font-mono text-primary">{formatCurrency(p.totalCost)}</p>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                         <Button variant="outline" className="w-full gap-2 h-10" onClick={() => handleOpenBulkUpdate('name', p.name)}>
                             <Edit className="h-4 w-4"/>
                             تعديل تكلفة كل مقاسات هذا الصنف
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    return (
      <>
        <BulkUpdateCostDialog
            isOpen={isBulkUpdateOpen}
            onClose={() => setIsBulkUpdateOpen(false)}
            config={bulkUpdateConfig}
            products={products}
        />
        <div className="flex flex-col gap-8">
            <PageHeader title="تقرير تكلفة المخزون" showBackButton />
            
            {/* Filters Section */}
            <Card>
                <CardHeader className="pb-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <CardTitle className="text-lg">فلترة البيانات</CardTitle>
                        <SlidersHorizontal className="h-5 w-5 text-primary" />
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2 text-right">
                        <Label htmlFor="group">عرض وتجميع حسب:</Label>
                         <Select value={filterGroup} onValueChange={setFilterGroup} disabled={isLoading}>
                            <SelectTrigger id="group" className="h-10">
                                <SelectValue placeholder="اختر طريقة العرض" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">عرض الكل (منتج فردي)</SelectItem>
                                    <SelectItem value="group_by_name">تجميع حسب اسم الصنف</SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectGroup>
                                    <SelectLabel>فلترة حسب المجموعة</SelectLabel>
                                    {productGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    <SelectItem value="بدون مجموعة">بدون مجموعة</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2 text-right">
                        <Label htmlFor="name-filter">بحث حسب اسم الصنف:</Label>
                        <Input
                            id="name-filter"
                            placeholder="اكتب اسم الصنف..."
                            className="h-10 text-right"
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 text-right">
                        <Label htmlFor="cost-filter">فلترة حسب التكلفة:</Label>
                        <Select value={costTypeFilter} onValueChange={(v: any) => setCostFilter(v)} disabled={isLoading}>
                            <SelectTrigger id="cost-filter" className="h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأصناف</SelectItem>
                                <SelectItem value="zero_only" className="text-destructive font-bold">الأصناف بدون تكلفة فقط (0)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

             {/* Summary Section */}
             <Card>
                <CardHeader className="pb-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <CardTitle className="text-lg">ملخص قيمة المخزون (بالتكلفة)</CardTitle>
                        <CircleDollarSign className="h-5 w-5 text-primary" />
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="p-6 rounded-lg bg-primary/5 flex flex-col items-center justify-center h-full border border-primary/10">
                        <p className="text-muted-foreground text-sm mb-1 text-center">إجمالي قيمة المخزون (للمعروض حالياً)</p>
                        {isLoading ? <Skeleton className="h-12 w-48 mt-2" /> : (
                            <p className="text-3xl md:text-4xl font-bold font-mono text-primary text-center">{formatCurrency(inventoryData.totalValue)}</p>
                        )}
                    </div>
                     <div>
                        <h3 className="font-semibold mb-3 text-sm flex items-center gap-2 justify-end">
                            القيمة حسب المجموعة:
                            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                        </h3>
                        {/* Responsive Group Summary */}
                         <div className="space-y-2 md:hidden">
                            {inventoryData.valueByGroup.map(group => (
                                <div key={group.name} className="flex justify-between items-center p-3 rounded-md bg-muted/30 border">
                                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleOpenBulkUpdate('group', group.name)}>
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                    <div className="flex flex-col text-right">
                                        <span className="font-medium text-sm">{group.name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{formatCurrency(group.value)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop View for Groups */}
                        <div className="max-h-60 overflow-y-auto rounded-md border hidden md:block">
                            <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-right">المجموعة</TableHead>
                                    <TableHead className="text-center">القيمة</TableHead>
                                    <TableHead className="text-center w-[80px]">تحديث</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {inventoryData.valueByGroup.map(group => (
                                      <TableRow key={group.name} className="hover:bg-muted/30">
                                          <TableCell className="font-medium text-right">{group.name}</TableCell>
                                          <TableCell className="text-center font-mono">{formatCurrency(group.value)}</TableCell>
                                          <TableCell className="text-center">
                                              <Button variant="ghost" size="icon" onClick={() => handleOpenBulkUpdate('group', group.name)}>
                                                  <Edit className="h-4 w-4"/>
                                              </Button>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Items Section */}
            <Card>
                <CardHeader className="text-right">
                    <CardTitle className="text-lg">تفاصيل المنتجات والتكلفة</CardTitle>
                    <CardDescription className="text-xs">
                        يمكنك تعديل سعر التكلفة لكل منتج فردي. يتم الحفظ تلقائياً عند مغادرة الحقل.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                     {isLoading ? renderLoadingState() : inventoryData.products.length === 0 ? (
                         <div className="h-48 text-center text-muted-foreground flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                            {costTypeFilter === 'zero_only' ? <Ban className="h-10 w-10 text-green-500 opacity-40" /> : <ShieldAlert className="h-10 w-10 opacity-20" />}
                            <p className="font-bold">
                                {costTypeFilter === 'zero_only' 
                                    ? "ممتاز! لا توجد منتجات بدون تكلفة حالياً." 
                                    : "لا توجد منتجات تطابق معايير البحث."}
                            </p>
                        </div>
                     ) : (
                        <>
                            <div className="md:hidden">
                                {renderMobileView()}
                            </div>
                            <div className="hidden md:block">
                                {renderDesktopView()}
                            </div>
                        </>
                     )}
                </CardContent>
            </Card>
        </div>
      </>
    );
}

export default function InventoryCostPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <InventoryCostPageContent />
            </AuthGuard>
        </AppLayout>
    );
}
