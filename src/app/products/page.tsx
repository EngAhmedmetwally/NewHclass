
"use client";

import { MoreHorizontal, PlusCircle, Printer, Search, SlidersHorizontal, ShoppingCart, Eye, Package as PackageIcon, FileUp, Trash2, CalendarSearch } from 'lucide-react';
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
import React, { useEffect, useState, useMemo } from 'react';
import { PrintLabelDialog } from '@/components/print-label-dialog';
import type { Product, Branch, User } from '@/lib/definitions';
import { useUser } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { NewOrderDialog } from '@/components/new-order-dialog';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { useSettings } from '@/hooks/use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { ImportProductsDialog } from '@/components/import-products-dialog';
import { ProductAvailabilityDialog } from '@/components/product-availability-dialog';


const ITEMS_PER_PAGE = 50;
const requiredPermissions = ['products:add', 'products:delete', 'products:print-label', 'orders:add', 'products:view-details', 'products:import'] as const;

function ProductsPageContent() {
    const { settings } = useSettings();
    const [currentPage, setCurrentPage] = useState(1);
    
    const { appUser } = useUser();
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    
    const { data: allProducts, isLoading: isLoadingProducts, error: productsError } = useRtdbList<Product>('products');
    const { data: branches, isLoading: isLoadingBranches, error: branchesError } = useRtdbList<Branch>('branches');
    const { data: rawProductGroups } = useRtdbList<{name: string}>('productGroups');
    const { data: rawSizes } = useRtdbList<{name: string}>('sizes');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sizeFilter, setSizeFilter] = useState('all');

    const [selectedProductToDelete, setSelectedProductToDelete] = useState<Product | undefined>(undefined);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    
    const isLoading = isLoadingProducts || isLoadingBranches || isLoadingPermissions;
    const combinedError = productsError || branchesError;

    /**
     * AGGRESSIVE CLEANUP: 
     * This fixes the "frozen screen" issue where Radix UI leaves 'pointer-events: none' on the body.
     */
    useEffect(() => {
      if (!isAddProductOpen && !isDeleteDialogOpen) {
        const cleanup = () => {
          document.body.style.pointerEvents = 'auto';
          document.body.style.overflow = '';
          document.body.classList.remove('pointer-events-none');
        };
        const timer1 = setTimeout(cleanup, 100);
        const timer2 = setTimeout(cleanup, 500);
        return () => { clearTimeout(timer1); clearTimeout(timer2); };
      }
    }, [isAddProductOpen, isDeleteDialogOpen]);

    const filteredProducts = useMemo(() => {
        if (isLoading || !appUser) return [];

        const isSuperAdmin = appUser.permissions.includes('all');
        let productsToFilter: Product[] = [...allProducts];

        // 1. Filter by branch based on logged-in user, unless they are a super admin
        if (!isSuperAdmin) {
            productsToFilter = productsToFilter.filter(p => 
                p.branchId === appUser.branchId || p.showInAllBranches || !p.branchId
            );
        }

        // 2. Apply "Hide Out of Stock" global setting
        if (settings.product_hideOutOfStock) {
            productsToFilter = productsToFilter.filter(product => {
                if (product.category === 'rental' || product.category === 'both') {
                    return true;
                }
                const availableStock = (product.quantityInStock || 0) - (product.quantityRented || 0);
                return availableStock > 0;
            });
        }

        // 3. Filter by search term
        if (searchTerm) {
            const lowercasedSearchTerm = searchTerm.toLowerCase();
            productsToFilter = productsToFilter.filter(product =>
                (product.name?.toLowerCase().includes(lowercasedSearchTerm)) ||
                (product.description?.toLowerCase().includes(lowercasedSearchTerm)) ||
                (product.productCode?.includes(lowercasedSearchTerm))
            );
        }

        // 4. Filter by transaction type (category)
        if (typeFilter === 'rental') {
            productsToFilter = productsToFilter.filter(p => p.category === 'rental' || p.category === 'both');
        } else if (typeFilter === 'sale') {
            productsToFilter = productsToFilter.filter(p => p.category === 'sale' || p.category === 'both');
        }

        // 5. Filter by stock status
        if (statusFilter !== 'all') {
            productsToFilter = productsToFilter.filter(product => {
                const availableStock = (product.quantityInStock || 0) - (product.quantityRented || 0);
                if (statusFilter === 'available') return availableStock > 0;
                if (statusFilter === 'unavailable') return availableStock <= 0;
                return true;
            });
        }

        // 6. Filter by product group
        if (categoryFilter !== 'all') {
            productsToFilter = productsToFilter.filter(product => product.group === categoryFilter);
        }

        // 7. Filter by size
        if (sizeFilter !== 'all') {
            productsToFilter = productsToFilter.filter(product => product.size === sizeFilter);
        }

        return productsToFilter.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            if (settings.product_sortOrder === 'asc') return dateA - dateB;
            return dateB - dateA;
        });

    }, [allProducts, appUser, searchTerm, typeFilter, statusFilter, categoryFilter, sizeFilter, isLoading, settings.product_sortOrder, settings.product_hideOutOfStock]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredProducts.slice(startIndex, endIndex);
    }, [filteredProducts, currentPage]);


    const availableCategories = useMemo(() => rawProductGroups.map(g => g.name), [rawProductGroups]);
    const availableSizes = useMemo(() => rawSizes.map(s => s.name), [rawSizes]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, typeFilter, categoryFilter, statusFilter, sizeFilter]);

    const openDeleteDialog = (product: Product) => {
        setSelectedProductToDelete(product);
        setTimeout(() => setIsDeleteDialogOpen(true), 50);
    };

    if (combinedError) {
        return <div className="text-red-500">حدث خطأ: {combinedError.message}</div>
    }
    
    const EffectiveProductView = settings.productView;

  return (
    <div className="flex flex-col gap-8">
      <DeleteProductDialog 
        product={selectedProductToDelete} 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
      />
      <PageHeader title="المنتجات" showBackButton>
        <div className="flex items-center gap-2">
            {permissions.canProductsImport && <ImportProductsDialog trigger={
            <Button variant="outline" size="sm" className="gap-1">
                <FileUp className="h-4 w-4" />
                استيراد من Excel
            </Button>
            } />}
            {permissions.canProductsAdd && <AddProductDialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <div className='flex items-center gap-2'>
                <SlidersHorizontal className="h-5 w-5" />
                <CardTitle className="text-lg">فلترة المنتجات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-2 col-span-full">
                <Label htmlFor="search">بحث</Label>
                <Input id="search" placeholder="البحث بالاسم أو الوصف أو الكود..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
             <div className="flex flex-col gap-2">
                <Label htmlFor="type">النوع</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger id="type">
                        <SelectValue placeholder="كل الأنواع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الأنواع</SelectItem>
                        <SelectItem value="rental">إيجار</SelectItem>
                        <SelectItem value="sale">بيع</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label htmlFor="category">الفئة</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger id="category">
                        <SelectValue placeholder="كل الفئات" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الفئات</SelectItem>
                        {availableCategories.map(cat => <SelectItem key={cat} value={cat!}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label htmlFor="status">الحالة</Label>
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                        <SelectValue placeholder="كل الحالات" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="available">متوفر</SelectItem>
                        <SelectItem value="unavailable">غير متوفر</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex flex-col gap-2">
                <Label htmlFor="size">المقاس</Label>
                 <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger id="size">
                        <SelectValue placeholder="كل المقاسات" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل المقاسات</SelectItem>
                        {availableSizes.map(size => <SelectItem key={size} value={size!}>{size}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {isLoading ? (
          <div className="grid gap-4 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Card key={`skeleton-${i}`} className="flex flex-col">
                  <CardHeader className="p-4"><Skeleton className="h-6 w-3/4" /></CardHeader>
                  <CardContent className="p-4 grid gap-2 text-sm flex-grow"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></CardContent>
                  <CardFooter className="p-2 border-t"><div className="w-full grid grid-cols-3 gap-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div></CardFooter>
                </Card>
              ))}
          </div>
      ) : paginatedProducts.length === 0 ? (
          <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 h-96">
                  <PackageIcon className="h-16 w-16 text-muted-foreground" />
                  <h3 className="text-xl font-semibold">لا توجد منتجات</h3>
                  <p className="text-muted-foreground">لا توجد منتجات تطابق الفلترة الحالية أو لم تقم بإضافة منتجات بعد.</p>
                  {permissions.canProductsAdd && <AddProductDialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />}
              </CardContent>
          </Card>
      ) : (
          <>
            {EffectiveProductView === 'grid' ? 
                <ProductsGridView products={paginatedProducts} permissions={permissions} /> : 
                <ProductsTableView products={paginatedProducts} branches={branches} permissions={permissions} onDeleteClick={openDeleteDialog} />}
            
            {totalPages > 1 && (
                <Pagination className="mt-8">
                    <PaginationContent>
                        <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1} /></PaginationItem>
                        <PaginationItem><span className="p-2 font-mono text-sm">صفحة {currentPage} من {totalPages}</span></PaginationItem>
                        <PaginationItem><PaginationNext onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages} /></PaginationItem>
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

    if (availableStock > 0) {
        return <Badge className="bg-green-600 text-white">متوفر ({availableStock})</Badge>;
    }

    if (isRental) {
        return (
            <ProductAvailabilityDialog
                productId={product.id}
                trigger={
                    <Badge variant="destructive" className="cursor-pointer hover:bg-destructive/80 gap-1 animate-pulse">
                        <CalendarSearch className="h-3 w-3" />
                        غير متوفر - استعلم
                    </Badge>
                }
            />
        );
    }

    return <Badge variant="destructive">غير متوفر</Badge>;
}

function ProductsGridView({ products, permissions }: { products: Product[], permissions: any }) {
    const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'rental': return 'إيجار فقط';
      case 'sale': return 'بيع فقط';
      case 'both': return 'بيع وإيجار';
      default: return category;
    }
  };

    return (
        <div className="grid gap-4 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
            <Card key={product.id} className="flex flex-col">
                <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">{product.name} - {product.size}</CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono">{product.productCode}</Badge>
                </div>
                </CardHeader>
                <CardContent className="p-4 grid gap-2 text-sm flex-grow">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">{getCategoryLabel(product.category)}</p>
                    <StatusBadgeWithAvailability product={product} />
                  </div>
                  <p className="font-semibold text-lg">
                      {(Number(product.price) || 0).toLocaleString()} ج.م
                  </p>
                  <div className="space-y-1 text-muted-foreground mt-2 text-xs">
                    <div className="flex justify-between"><span>المخزون الكلي:</span><span className="font-mono">{product.quantityInStock || 0}</span></div>
                    <div className="flex justify-between"><span>مؤجر حالياً:</span><span className="font-mono text-blue-600">{product.quantityRented || 0}</span></div>
                  </div>
                </CardContent>
                <CardFooter className="p-2 border-t bg-card flex-col gap-2">
                    <div className="w-full grid grid-cols-2 gap-2">
                        {permissions.canProductsPrintLabel && (
                            <PrintLabelDialog product={product} trigger={
                                <Button variant="outline" size="sm" className="gap-1 w-full"><Printer className="h-4 w-4" /> باركود</Button>
                            } />
                        )}
                         {permissions.canProductsViewDetails && (
                            <Link href={`/products/${product.id}`} className="w-full">
                                <Button variant="ghost" size="sm" className="gap-1 w-full"><Eye className="h-4 w-4" /> تفاصيل</Button>
                            </Link>
                        )}
                    </div>
                    {permissions.canOrdersAdd && (
                        <NewOrderDialog 
                            productId={product.id}
                            trigger={
                                <Button variant="default" size="sm" className="gap-1 w-full"><ShoppingCart className="h-4 w-4" /> إنشاء طلب</Button>
                            } 
                        />
                    )}
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
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px] text-right">المنتج</TableHead>
                            <TableHead className="text-center">الباركود</TableHead>
                            <TableHead className="text-center">الفرع</TableHead>
                            <TableHead className="text-center">السعر</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell className="font-medium text-right">{product.name} - {product.size}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{product.productCode}</TableCell>
                            <TableCell className="text-center text-xs">{getBranchName(product.branchId)}</TableCell>
                            <TableCell className="text-center font-mono">{(Number(product.price) || 0).toLocaleString()} ج.م</TableCell>
                            <TableCell className="text-center">
                                <StatusBadgeWithAvailability product={product} />
                            </TableCell>
                            <TableCell className="text-center">
                               <div className="flex gap-2 justify-center">
                                    {permissions.canOrdersAdd && (
                                        <NewOrderDialog
                                            productId={product.id}
                                            trigger={<Button variant="default" size="icon" className="h-8 w-8" title="إنشاء طلب"><ShoppingCart className="h-4 w-4" /></Button>}
                                        />
                                    )}
                                    {permissions.canProductsViewDetails && (
                                        <Button variant="ghost" size="icon" asChild className="h-8 w-8" title="عرض التفاصيل">
                                          <Link href={`/products/${product.id}`}><Eye className="h-4 w-4" /></Link>
                                        </Button>
                                    )}
                                    {permissions.canProductsDelete && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="حذف المنتج" onClick={() => onDeleteClick(product)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
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
