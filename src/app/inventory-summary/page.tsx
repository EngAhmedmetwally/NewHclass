
"use client";

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Archive, ShieldAlert, SlidersHorizontal, Package, Hash } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Product, Branch } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import { AppLayout } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

const ITEMS_PER_PAGE = 50;

function InventorySummaryPageContent() {
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    
    const { appUser } = useUser();
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(['reports:inventory-summary'] as const);
    const { data: products, isLoading: loadingProducts } = useRtdbList<Product>('products');
    const { data: branches, isLoading: loadingBranches } = useRtdbList<Branch>('branches');
    
    const isLoading = loadingProducts || loadingBranches || isLoadingPermissions;

    useEffect(() => {
        if (appUser && appUser.branchId !== 'all') {
            setSelectedBranch(appUser.branchId || 'all');
        }
    }, [appUser]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedBranch, selectedCategory, selectedStatus]);

    const inventoryData = useMemo(() => {
        if (isLoading) return { filteredProducts: [], totalValue: 0, totalItems: 0, totalRented: 0, availableItems: 0 };
        
        let filtered = products;
        
        if (selectedBranch !== 'all') {
            filtered = filtered.filter(p => p.branchId === selectedBranch);
        }
        
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.category === selectedCategory);
        }

        if (selectedStatus !== 'all') {
            filtered = filtered.filter(p => {
                const available = (p.quantityInStock || 0) - (p.quantityRented || 0);
                if (selectedStatus === 'available') return available > 0;
                if (selectedStatus === 'rented') return (p.quantityRented || 0) > 0;
                if (selectedStatus === 'out_of_stock') return (p.quantityInStock || 0) === 0;
                return true;
            });
        }

        const totalValue = filtered.reduce((sum, p) => sum + (Number(p.price) * (p.quantityInStock || 0)), 0);
        const totalItems = filtered.reduce((sum, p) => sum + (p.quantityInStock || 0), 0);
        const totalRented = filtered.reduce((sum, p) => sum + (p.quantityRented || 0), 0);

        return {
            filteredProducts: filtered,
            totalValue,
            totalItems,
            totalRented,
            availableItems: totalItems - totalRented,
        };
    }, [selectedBranch, selectedCategory, selectedStatus, products, isLoading]);

    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return inventoryData.filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [inventoryData.filteredProducts, currentPage]);

    const totalPages = Math.ceil(inventoryData.filteredProducts.length / ITEMS_PER_PAGE);

    const getBranchName = (branchId: string) => {
        return branches.find(b => b.id === branchId)?.name || 'N/A';
    }
    
    const getStatus = (product: Product) => {
        const available = (product.quantityInStock || 0) - (product.quantityRented || 0);
        if ((product.quantityInStock || 0) === 0) return <Badge variant="destructive">نفذت الكمية</Badge>;
        if ((product.quantityRented || 0) > 0 && available === 0) return <Badge className="bg-blue-500 text-white">مؤجر بالكامل</Badge>;
        if ((product.quantityRented || 0) > 0 && available > 0) return <Badge className="bg-orange-500 text-white">مؤجر جزئياً</Badge>;
        return <Badge className="bg-green-600 text-white">متوفر</Badge>;
    }

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case 'sale':
                return <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">بيع</Badge>;
            case 'rental':
                return <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">إيجار</Badge>;
            case 'both':
                return <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:text-green-300">بيع وإيجار</Badge>;
            default:
                return <Badge variant="outline">{category}</Badge>;
        }
    };

    if (!isLoading && !permissions.canReportsInventorySummary) {
        return (
            <div className="flex flex-col gap-8">
                <PageHeader title="تقرير ملخص المخزون الحالي" showBackButton />
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
        )
    }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير ملخص المخزون الحالي" showBackButton />
        
        <Card>
            <CardHeader className="pb-3">
                 <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">فلترة المخزون</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 <div className="space-y-2">
                    <Label htmlFor="branch">الفرع:</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isLoading || (!!appUser?.branchId && appUser.branchId !== 'all')}>
                        <SelectTrigger id="branch">
                            <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الفروع</SelectItem>
                            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="category">نوع الصنف (طبيعة المنتج):</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
                        <SelectTrigger id="category">
                            <SelectValue placeholder="اختر النوع" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الأنواع</SelectItem>
                            <SelectItem value="sale">بيع فقط</SelectItem>
                            <SelectItem value="rental">إيجار فقط</SelectItem>
                            <SelectItem value="both">بيع وإيجار</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="status-filter">حالة الصنف:</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus} disabled={isLoading}>
                        <SelectTrigger id="status-filter">
                            <SelectValue placeholder="اختر الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="available">متوفر للعمليات</SelectItem>
                            <SelectItem value="rented">مؤجر (جزئي أو كلي)</SelectItem>
                            <SelectItem value="out_of_stock">نفذت الكمية</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
            </CardContent>
        </Card>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
                <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">إجمالي قيمة المخزون</p>
                    {isLoading ? <Skeleton className="h-8 w-32 mx-auto" /> : <p className="text-2xl font-bold font-mono text-primary">{inventoryData.totalValue.toLocaleString()} ج.م</p>}
                </CardContent>
            </Card>
            <Card className="bg-muted/50 border-muted">
                <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">إجمالي عدد القطع</p>
                    {isLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : <p className="text-2xl font-bold font-mono">{inventoryData.totalItems}</p>}
                </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/10">
                <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">القطع المتاحة للعمليات</p>
                    {isLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : <p className="text-2xl font-bold font-mono text-green-600">{inventoryData.availableItems}</p>}
                </CardContent>
            </Card>
        </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <CardTitle>تفاصيل المخزون</CardTitle>
          </div>
          <CardDescription>
            {isLoading ? 'جاري التحميل...' : `عرض ${inventoryData.filteredProducts.length} صنف (صفحة ${currentPage} من ${totalPages || 1})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
            
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center w-[120px]">كود الصنف</TableHead>
                            <TableHead className="text-right">المنتج</TableHead>
                            <TableHead className="text-center">النوع</TableHead>
                            <TableHead className="text-center">الفرع الأساسي</TableHead>
                            <TableHead className="text-center">المخزون الكلي</TableHead>
                            <TableHead className="text-center">مؤجر حالياً</TableHead>
                            <TableHead className="text-center">متاح للعمليات</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24 mx-auto rounded-full" /></TableCell>
                            </TableRow>
                        )) : paginatedProducts.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="text-center font-mono text-xs">{p.productCode}</TableCell>
                                <TableCell className="font-medium text-right">{p.name} - {p.size}</TableCell>
                                <TableCell className="text-center">
                                    {getCategoryBadge(p.category)}
                                </TableCell>
                                <TableCell className="text-center">{getBranchName(p.branchId)}</TableCell>
                                <TableCell className="text-center font-mono font-semibold">{p.quantityInStock || 0}</TableCell>
                                <TableCell className="text-center font-mono text-blue-600">{p.quantityRented || 0}</TableCell>
                                <TableCell className="text-center font-mono text-green-600 font-bold">{(p.quantityInStock || 0) - (p.quantityRented || 0)}</TableCell>
                                <TableCell className="text-center">{getStatus(p)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden space-y-4">
                {isLoading ? [...Array(3)].map((_, i) => (
                    <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
                )) : paginatedProducts.map(p => (
                    <Card key={p.id} className="overflow-hidden">
                        <CardHeader className="pb-2 bg-muted/20">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-base text-right leading-relaxed">{p.name} - {p.size}</CardTitle>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                        <Hash className="h-3 w-3" />
                                        {p.productCode}
                                    </div>
                                </div>
                                {getStatus(p)}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <CardDescription className="text-right">الفرع: {getBranchName(p.branchId)}</CardDescription>
                                {getCategoryBadge(p.category)}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 rounded-md bg-muted/30">
                                    <p className="text-[10px] text-muted-foreground mb-1">المخزون</p>
                                    <p className="font-mono font-bold">{p.quantityInStock || 0}</p>
                                </div>
                                <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20">
                                    <p className="text-[10px] text-blue-600 mb-1">مؤجر</p>
                                    <p className="font-mono font-bold text-blue-600">{p.quantityRented || 0}</p>
                                </div>
                                <div className="p-2 rounded-md bg-green-50 dark:bg-green-900/20">
                                    <p className="text-[10px] text-green-600 mb-1">متاح</p>
                                    <p className="font-mono font-bold text-green-600">{(p.quantityInStock || 0) - (p.quantityRented || 0)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!isLoading && inventoryData.filteredProducts.length === 0 && (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
                    <Package className="h-8 w-8 opacity-20" />
                    <p>لا توجد منتجات تطابق الفلترة المحددة.</p>
                </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
                <div className="pt-6 border-t mt-6">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="cursor-pointer"
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <span className="px-4 text-sm font-medium">صفحة {currentPage} من {totalPages}</span>
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="cursor-pointer"
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventorySummaryPage() {
    return (
        <AppLayout>
            <InventorySummaryPageContent />
        </AppLayout>
    );
}
