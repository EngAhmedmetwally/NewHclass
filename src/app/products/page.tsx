
"use client";

import { MoreHorizontal, PlusCircle, Printer, Search, SlidersHorizontal, ShoppingCart, Eye, Package as PackageIcon, FileUp, Trash2, CalendarSearch, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/page-header';
import { AddProductDialog } from '@/components/add-product-dialog';
import { DeleteProductDialog } from '@/components/delete-product-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import React, { useEffect, useState, useMemo, useTransition } from 'react';
import { PrintLabelDialog } from '@/components/print-label-dialog';
import type { Product, Branch } from '@/lib/definitions';
import { useUser } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { NewOrderDialog } from '@/components/new-order-dialog';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { ImportProductsDialog } from '@/components/import-products-dialog';
import { ProductAvailabilityDialog } from '@/components/product-availability-dialog';

const ITEMS_PER_PAGE = 50;
// تقليل عدد المنتجات المحملة مبدئياً لتسريع استجابة الصفحة مع وجود 3500 صنف
const MAX_INITIAL_PRODUCTS = 500; 

const requiredPermissions = ['products:add', 'products:delete', 'products:print-label', 'orders:add', 'products:view-details', 'products:import'] as const;

function ProductsPageContent() {
    const { settings } = useSettings();
    const [currentPage, setCurrentPage] = useState(1);
    const [isPending, startTransition] = useTransition();
    
    const { appUser } = useUser();
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    
    const { data: allProducts, isLoading: isLoadingProducts, error: productsError } = useRtdbList<Product>('products', {
        limit: MAX_INITIAL_PRODUCTS
    });
    
    const { data: branches, isLoading: isLoadingBranches, error: branchesError } = useRtdbList<Branch>('branches');
    const { data: rawProductGroups } = useRtdbList<{name: string}>('productGroups');
    const { data: rawSizes } = useRtdbList<{name: string}>('sizes');
    
    // نظام البحث المجدول لتجنب البطء
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sizeFilter, setSizeFilter] = useState('all');

    const [selectedProductToDelete, setSelectedProductToDelete] = useState<Product | undefined>(undefined);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    
    const isLoading = isLoadingProducts || isLoadingBranches || isLoadingPermissions;
    const combinedError = productsError || branchesError;

    // تحديث البحث بعد انتهاء الكتابة بـ 400 ملّي ثانية
    useEffect(() => {
        const handler = setTimeout(() => {
            startTransition(() => {
                setDebouncedSearch(searchInput);
                setCurrentPage(1);
            });
        }, 400);
        return () => clearTimeout(handler);
    }, [searchInput]);

    const filteredProducts = useMemo(() => {
        if (isLoading || !appUser) return [];

        const isSuperAdmin = appUser.permissions.includes('all');
        let productsToFilter: Product[] = [...allProducts];

        if (!isSuperAdmin) {
            productsToFilter = productsToFilter.filter(p => 
                p.branchId === appUser.branchId || p.showInAllBranches || !p.branchId
            );
        }

        if (settings.product_hideOutOfStock) {
            productsToFilter = productsToFilter.filter(product => {
                if (product.category === 'rental' || product.category === 'both') return true;
                const availableStock = (product.quantityInStock || 0) - (product.quantityRented || 0);
                return availableStock > 0;
            });
        }

        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase().trim();
            productsToFilter = productsToFilter.filter(product =>
                (product.name?.toLowerCase().includes(q)) ||
                (product.productCode?.toLowerCase().includes(q))
            );
        }

        if (typeFilter !== 'all') {
            if (typeFilter === 'rental') productsToFilter = productsToFilter.filter(p => p.category === 'rental' || p.category === 'both');
            else if (typeFilter === 'sale') productsToFilter = productsToFilter.filter(p => p.category === 'sale' || p.category === 'both');
        }

        if (statusFilter !== 'all') {
            productsToFilter = productsToFilter.filter(product => {
                const availableStock = (product.quantityInStock || 0) - (product.quantityRented || 0);
                if (statusFilter === 'available') return availableStock > 0;
                if (statusFilter === 'unavailable') return availableStock <= 0;
                return true;
            });
        }

        if (categoryFilter !== 'all') productsToFilter = productsToFilter.filter(product => product.group === categoryFilter);
        if (sizeFilter !== 'all') productsToFilter = productsToFilter.filter(product => product.size === sizeFilter);

        return productsToFilter;
    }, [allProducts, appUser, debouncedSearch, typeFilter, statusFilter, categoryFilter, sizeFilter, isLoading, settings]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage]);

    const availableCategories = useMemo(() => rawProductGroups.map(g => g.name), [rawProductGroups]);
    const availableSizes = useMemo(() => rawSizes.map(s => s.name), [rawSizes]);

    const openDeleteDialog = (product: Product) => {
        setSelectedProductToDelete(product);
        setTimeout(() => setIsDeleteDialogOpen(true), 50);
    };

    if (combinedError) return <div className="text-red-500 p-8 text-center">حدث خطأ في تحميل البيانات.</div>;
    
    const EffectiveProductView = settings.productView;

  return (
    <div className="flex flex-col gap-8">
      <DeleteProductDialog product={selectedProductToDelete} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} />
      <PageHeader title="المنتجات" showBackButton>
        <div className="flex items-center gap-2">
            {permissions.canProductsImport && <ImportProductsDialog trigger={<Button variant="outline" size="sm" className="gap-1"><FileUp className="h-4 w-4" />استيراد</Button>} />}
            {permissions.canProductsAdd && <AddProductDialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />}
        </div>
      </PageHeader>
      
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">تصفية وبحث ذكي</CardTitle>
                </div>
                {isPending && <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse"><Loader2 className="h-3 w-3 animate-spin"/> جاري الفلترة...</div>}
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-2 col-span-full">
                <Label htmlFor="search">بحث سريع (اسم أو كود)</Label>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="search" placeholder="ابحث هنا... (سيتم تحديث النتائج تلقائياً)" className="pr-9 h-11 border-primary/30" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> تم تحميل أحدث {MAX_INITIAL_PRODUCTS} صنف للسرعة. استخدم البحث للوصول لأي صنف آخر.
                </p>
            </div>
             <div className="flex flex-col gap-2">
                <Label className="text-xs">النوع</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الأنواع</SelectItem>
                        <SelectItem value="rental">إيجار</SelectItem>
                        <SelectItem value="sale">بيع</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label className="text-xs">الفئة</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الفئات</SelectItem>
                        {availableCategories.map(cat => <SelectItem key={cat} value={cat!}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label className="text-xs">الحالة</Label>
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="available">متوفر فقط</SelectItem>
                        <SelectItem value="unavailable">نفذت الكمية</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label className="text-xs">المقاس</Label>
                 <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل المقاسات</SelectItem>
                        {availableSizes.map(size => <SelectItem key={size} value={size!}>{size}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
      ) : filteredProducts.length === 0 ? (
          <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-4 h-64">
                  <PackageIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                  <p className="text-muted-foreground">لا توجد منتجات تطابق البحث الحالي.</p>
              </CardContent>
          </Card>
      ) : (
          <>
            <div className={cn("transition-opacity duration-200", isPending ? "opacity-50" : "opacity-100")}>
                {EffectiveProductView === 'grid' ? 
                    <ProductsGridView products={paginatedProducts} permissions={permissions} /> : 
                    <ProductsTableView products={paginatedProducts} branches={branches} permissions={permissions} onDeleteClick={openDeleteDialog} />}
            </div>
            
            {totalPages > 1 && (
                <Pagination className="mt-8">
                    <PaginationContent>
                        <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="cursor-pointer"/></PaginationItem>
                        <PaginationItem><span className="p-2 font-mono text-sm">صفحة {currentPage} من {totalPages}</span></PaginationItem>
                        <PaginationItem><PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="cursor-pointer"/></PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
          </>
      )}
    </div>
  );
}

function StatusBadgeWithAvailability({ product }: { product: Product }) {
    const availableStock = (product.quantityInStock || 0) - (product.quantityRented || 0);
    const isRental = product.category === 'rental' || product.category === 'both';
    if (availableStock > 0) return <Badge className="bg-green-600 text-white">متوفر ({availableStock})</Badge>;
    if (isRental) return <ProductAvailabilityDialog productId={product.id} trigger={<Badge variant="destructive" className="cursor-pointer hover:bg-destructive/80 gap-1 animate-pulse"><CalendarSearch className="h-3 w-3" />استعلم</Badge>} />;
    return <Badge variant="destructive">غير متوفر</Badge>;
}

function ProductsGridView({ products, permissions }: { products: Product[], permissions: any }) {
    return (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
            <Card key={product.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-bold leading-tight">{product.name} - {product.size}</CardTitle>
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">{product.productCode}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 grid gap-2 text-xs flex-grow">
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-muted-foreground">{product.category === 'rental' ? 'إيجار' : product.category === 'sale' ? 'بيع' : 'بيع/إيجار'}</span>
                    <StatusBadgeWithAvailability product={product} />
                  </div>
                  <p className="font-bold text-lg text-primary">{(Number(product.price) || 0).toLocaleString()} ج.م</p>
                </CardContent>
                <CardFooter className="p-2 border-t bg-muted/5 flex-col gap-2">
                    <div className="w-full grid grid-cols-2 gap-2">
                        {permissions.canProductsPrintLabel && <PrintLabelDialog product={product} trigger={<Button variant="outline" size="sm" className="h-8 text-[10px] gap-1"><Printer className="h-3 w-3" /> باركود</Button>} />}
                         {permissions.canProductsViewDetails && <Link href={`/products/${product.id}`} className="w-full"><Button variant="ghost" size="sm" className="h-8 text-[10px] w-full gap-1"><Eye className="h-3 w-3" /> تفاصيل</Button></Link>}
                    </div>
                    {permissions.canOrdersAdd && <NewOrderDialog productId={product.id} trigger={<Button variant="default" size="sm" className="h-9 w-full gap-1.5"><ShoppingCart className="h-4 w-4" /> إنشاء طلب</Button>} />}
                </CardFooter>
            </Card>
            ))}
        </div>
    );
}

function ProductsTableView({ products, branches, permissions, onDeleteClick }: { products: Product[], branches: Branch[], permissions: any, onDeleteClick: (product: Product) => void }) {
    const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'غير معروف';
    return (
         <Card>
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[250px] text-right">المنتج</TableHead><TableHead className="text-center">الباركود</TableHead><TableHead className="text-center">الفرع</TableHead><TableHead className="text-center">السعر</TableHead><TableHead className="text-center">الحالة</TableHead><TableHead className="text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell className="font-medium text-right text-sm">{product.name} - {product.size}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{product.productCode}</TableCell>
                            <TableCell className="text-center text-[10px]">{getBranchName(product.branchId)}</TableCell>
                            <TableCell className="text-center font-mono font-bold">{(Number(product.price) || 0).toLocaleString()} ج.م</TableCell>
                            <TableCell className="text-center"><StatusBadgeWithAvailability product={product} /></TableCell>
                            <TableCell className="text-center">
                               <div className="flex gap-1 justify-center">
                                    {permissions.canOrdersAdd && <NewOrderDialog productId={product.id} trigger={<Button variant="default" size="icon" className="h-7 w-7"><ShoppingCart className="h-3.5 w-3.5" /></Button>} />}
                                    {permissions.canProductsViewDetails && <Button variant="ghost" size="icon" asChild className="h-7 w-7"><Link href={`/products/${product.id}`}><Eye className="h-3.5 w-3.5" /></Link></Button>}
                                    {permissions.canProductsDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteClick(product)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                               </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export default function ProductsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <ProductsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
