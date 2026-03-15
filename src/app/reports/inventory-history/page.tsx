'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Search, Package, TrendingUp, TrendingDown, ArrowLeftRight, ShieldAlert, ArrowUpRight, ArrowDownLeft, Check, ChevronsUpDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import React, { useState, useMemo } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Product, StockMovement } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const formatMovementDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InventoryHistoryPageContent() {
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allProducts, isLoading: isLoadingProducts } = useRtdbList<Product>('products');

  const foundProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return allProducts.find(p => p.id === selectedProductId) || null;
  }, [allProducts, selectedProductId]);

  const stockMovements = useMemo(() => {
    if (!foundProduct?.stockMovements) return [];
    return Object.values(foundProduct.stockMovements).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [foundProduct]);

  // Filter products locally for better performance when query is long enough
  const filteredProducts = useMemo(() => {
    if (searchQuery.length < 5) return [];
    const q = searchQuery.toLowerCase();
    return allProducts.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.productCode?.toLowerCase().includes(q)
    ).slice(0, 50); // Limit results for snappiness
  }, [allProducts, searchQuery]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير حركة مخزون صنف" showBackButton />
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle>البحث عن منتج</CardTitle>
          </div>
          <CardDescription>
            ابحث عن الصنف بالاسم أو الكود (تظهر الاقتراحات بعد 5 أحرف).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
            <div className="w-full max-w-xl">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between h-12 text-lg"
                            disabled={isLoadingProducts}
                        >
                            {foundProduct 
                                ? `${foundProduct.name} - ${foundProduct.size} (${foundProduct.productCode})` 
                                : isLoadingProducts ? "جاري تحميل الأصناف..." : "ابحث عن صنف..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                            <CommandInput 
                                placeholder="اكتب اسم الصنف أو الباركود..." 
                                className="h-12" 
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                            />
                            <CommandList>
                                {searchQuery.length < 5 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                        <Info className="h-4 w-4" />
                                        أدخل 5 أحرف على الأقل للبحث...
                                    </div>
                                ) : (
                                    <>
                                        {filteredProducts.length === 0 && <CommandEmpty>لم يتم العثور على أي منتج.</CommandEmpty>}
                                        <CommandGroup>
                                            {filteredProducts.map((product) => (
                                                <CommandItem
                                                    key={product.id}
                                                    value={product.id}
                                                    onSelect={() => {
                                                        setSelectedProductId(product.id);
                                                        setOpen(false);
                                                        setSearchQuery(""); // Clear search on select
                                                    }}
                                                    className="flex items-center justify-between py-3 cursor-pointer"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{product.name} - مقاس {product.size}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{product.productCode}</span>
                                                    </div>
                                                    <Check
                                                        className={cn(
                                                            "ml-2 h-4 w-4",
                                                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </CardContent>
      </Card>
      
      {isLoadingProducts ? (
        <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      ) : !foundProduct ? (
        <Card className="border-dashed">
            <CardContent className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                 <Package className="h-10 w-10 opacity-20" />
                <p>الرجاء اختيار صنف من القائمة أعلاه لعرض سجل حركاته.</p>
            </CardContent>
        </Card>
      ) : (
        <>
            <div className="grid md:grid-cols-4 gap-4">
                <Card className="bg-muted/30">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-muted-foreground">المخزون الحالي</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-2xl font-bold font-mono">{foundProduct.quantityInStock}</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-green-600">متاح للعمليات</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-2xl font-bold font-mono text-green-600">{foundProduct.quantityInStock - foundProduct.quantityRented}</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-500/5 border-blue-500/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-blue-600">مؤجر حالياً</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-2xl font-bold font-mono text-blue-600">{foundProduct.quantityRented}</p>
                    </CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs text-destructive">مباع</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-2xl font-bold font-mono text-destructive">{foundProduct.quantitySold}</p>
                    </CardContent>
                </Card>
            </div>

             <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <CardTitle>سجل حركة المخزون لـ {foundProduct.name}</CardTitle>
                    </div>
                    <CardDescription>عرض تفصيلي لعمليات الإضافة، الصرف، الإيجار، والارتجاع.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">النوع</TableHead>
                                <TableHead className="text-right">البيان / ملاحظات</TableHead>
                                <TableHead className="text-center">قبل</TableHead>
                                <TableHead className="text-center">الحركة</TableHead>
                                <TableHead className="text-center">بعد</TableHead>
                                <TableHead className="text-right">بواسطة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockMovements.map((move) => (
                                <TableRow key={move.id}>
                                    <TableCell className="font-mono text-[10px] text-right">{formatMovementDate(move.date)}</TableCell>
                                    <TableCell className="text-right">
                                      {move.type === 'addition' && <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300"><TrendingUp className="h-3 w-3"/> إضافة</Badge>}
                                      {move.type === 'return' && <Badge variant="default" className="gap-1 bg-blue-100 text-blue-800 border-blue-300"><ArrowLeftRight className="h-3 w-3"/> مرتجع بيع</Badge>}
                                      {move.type === 'sale' && <Badge variant="destructive" className="gap-1 bg-red-100 text-red-800 border-red-300"><TrendingDown className="h-3 w-3"/> صرف بيع</Badge>}
                                      {move.type === 'initial' && <Badge variant="outline">رصيد افتتاحي</Badge>}
                                      {move.type === 'edit' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">تعديل</Badge>}
                                      {move.type === 'rental_out' && <Badge variant="destructive" className="gap-1 bg-orange-100 text-orange-800 border-orange-300"><ArrowUpRight className="h-3 w-3"/> خروج إيجار</Badge>}
                                      {move.type === 'rental_in' && <Badge variant="default" className="gap-1 bg-teal-100 text-teal-800 border-teal-300"><ArrowDownLeft className="h-3 w-3"/> رجوع إيجار</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right text-xs max-w-[200px] truncate" title={move.notes}>
                                        {move.notes || '-'}
                                        {move.orderCode && <span className="block font-mono text-[10px] text-muted-foreground mt-0.5">طلب: {move.orderCode}</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">{move.quantityBefore}</TableCell>
                                    <TableCell className="font-mono font-bold text-center">
                                      <span className={move.quantity > 0 ? 'text-green-600' : 'text-destructive'}>
                                        {move.quantity > 0 ? `+${move.quantity}` : move.quantity}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">{move.quantityAfter}</TableCell>
                                    <TableCell className="text-right text-[10px]">{move.userName}</TableCell>
                                </TableRow>
                            ))}
                            {stockMovements.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">لا توجد حركات مخزون مسجلة لهذا المنتج حتى الآن.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </>
      )}

    </div>
  );
}

export default function InventoryHistoryPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <InventoryHistoryPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
