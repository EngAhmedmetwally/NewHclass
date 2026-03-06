
'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Search, Package, TrendingUp, TrendingDown, ArrowLeftRight, ShieldAlert, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/app-layout';
import React, { useState, useMemo } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Product, StockMovement } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const formatMovementDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InventoryHistoryPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const { data: allProducts, isLoading: isLoadingProducts } = useRtdbList<Product>('products');

  const handleSearch = () => {
    if (!searchTerm) return;
    
    setIsLoadingSearch(true);
    setSearchAttempted(true);
    
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    
    let formattedBarcode = lowercasedSearchTerm;
    if (/^\d+$/.test(lowercasedSearchTerm) && lowercasedSearchTerm.length < 9) {
        formattedBarcode = '9' + lowercasedSearchTerm.padStart(8, '0');
    }

    const product = allProducts.find(p => 
        p.productCode?.toLowerCase() === formattedBarcode ||
        p.name.toLowerCase().includes(lowercasedSearchTerm) ||
        p.productCode?.toLowerCase().includes(lowercasedSearchTerm)
    );

    setTimeout(() => {
        setFoundProduct(product || null);
        setIsLoadingSearch(false);
    }, 500); // Simulate network delay for better UX
  };

  const stockMovements = useMemo(() => {
    if (!foundProduct?.stockMovements) return [];
    return Object.values(foundProduct.stockMovements).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [foundProduct]);

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
            تتبع التغييرات التي طرأت على مخزون منتج معين عبر الزمن.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2 max-w-md mx-auto">
                <Input 
                    placeholder="أدخل كود المنتج أو اسمه للبحث..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button className="gap-2" onClick={handleSearch} disabled={isLoadingProducts || isLoadingSearch}>
                  {isLoadingSearch ? "جاري البحث..." : <><Search className="h-4 w-4"/> بحث</>}
                </Button>
            </div>
        </CardContent>
      </Card>
      
      {(isLoadingProducts || isLoadingSearch) && searchAttempted ? (
        <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      ) : searchAttempted && !foundProduct ? (
        <Card>
            <CardContent className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                 <ShieldAlert className="h-10 w-10 text-destructive" />
                <p className="font-semibold">لم يتم العثور على المنتج</p>
                <p>الرجاء التأكد من الكود أو اسم المنتج والمحاولة مرة أخرى.</p>
            </CardContent>
        </Card>
      ) : foundProduct && (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <CardTitle>{foundProduct.name} - {foundProduct.size}</CardTitle>
                    </div>
                     <CardDescription>كود: {foundProduct.productCode}</CardDescription>
                </CardHeader>
                 <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">المخزون الحالي</p>
                        <p className="text-lg font-bold font-mono">{foundProduct.quantityInStock}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">متاح للعمليات</p>
                        <p className="text-lg font-bold font-mono text-green-600">{foundProduct.quantityInStock - foundProduct.quantityRented}</p>
                    </div>
                     <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">مؤجر حاليًا</p>
                        <p className="text-lg font-bold font-mono text-blue-600">{foundProduct.quantityRented}</p>
                    </div>
                     <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">مباع</p>
                        <p className="text-lg font-bold font-mono text-red-600">{foundProduct.quantitySold}</p>
                    </div>
                 </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <CardTitle>سجل حركة المخزون</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">النوع</TableHead>
                                <TableHead className="text-right">ملاحظات</TableHead>
                                <TableHead className="text-center">الكمية قبل</TableHead>
                                <TableHead className="text-center">الحركة</TableHead>
                                <TableHead className="text-center">الكمية بعد</TableHead>
                                <TableHead className="text-right">بواسطة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockMovements.map((move) => (
                                <TableRow key={move.id}>
                                    <TableCell className="font-mono text-xs text-right">{formatMovementDate(move.date)}</TableCell>
                                    <TableCell className="text-right">
                                      {move.type === 'addition' && <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300"><TrendingUp className="h-3 w-3"/> إضافة</Badge>}
                                      {move.type === 'return' && <Badge variant="default" className="gap-1 bg-blue-100 text-blue-800 border-blue-300"><ArrowLeftRight className="h-3 w-3"/> مرتجع بيع</Badge>}
                                      {move.type === 'sale' && <Badge variant="destructive" className="gap-1 bg-red-100 text-red-800 border-red-300"><TrendingDown className="h-3 w-3"/> صرف بيع</Badge>}
                                      {move.type === 'initial' && <Badge variant="outline">رصيد افتتاحي</Badge>}
                                      {move.type === 'edit' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">تعديل</Badge>}
                                      {move.type === 'rental_out' && <Badge variant="destructive" className="gap-1 bg-orange-100 text-orange-800 border-orange-300"><ArrowUpRight className="h-3 w-3"/> خروج إيجار</Badge>}
                                      {move.type === 'rental_in' && <Badge variant="default" className="gap-1 bg-teal-100 text-teal-800 border-teal-300"><ArrowDownLeft className="h-3 w-3"/> رجوع إيجار</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{move.notes || '-'}</TableCell>
                                    <TableCell className="text-center font-mono">{move.quantityBefore}</TableCell>
                                    <TableCell className="font-mono font-bold text-center">
                                      <span className={move.quantity > 0 ? 'text-green-600' : 'text-destructive'}>
                                        {move.quantity > 0 ? `+${move.quantity}` : move.quantity}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">{move.quantityAfter}</TableCell>
                                    <TableCell className="text-right text-xs">{move.userName}</TableCell>
                                </TableRow>
                            ))}
                            {stockMovements.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">لا توجد حركات مخزون مسجلة لهذا المنتج.</TableCell>
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
            <InventoryHistoryPageContent />
        </AppLayout>
    )
}
