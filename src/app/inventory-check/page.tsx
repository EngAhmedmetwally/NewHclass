
'use client';

import React, { useState, useMemo } from 'react';
import { Search, Package, History, Eye, Palette, Calendar as CalendarIcon, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Product, Order } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { eachDayOfInterval, startOfDay, addDays, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Numpad } from '@/components/numpad';


const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        return '-'
    }
    return date.toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
}


function InventoryCheckPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const { data: allProducts, isLoading: isLoadingProducts } = useRtdbList<Product>('products');
  const { data: allOrders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<any>('branches');
  
  const isLoading = isLoadingProducts || isLoadingOrders || isLoadingBranches;

  const handleNumpadInput = (value: string) => {
    setSearchTerm(prev => prev + value);
  };

  const handleNumpadClear = () => {
      setSearchTerm('');
  };

  const handleNumpadBackspace = () => {
      setSearchTerm(prev => prev.slice(0, -1));
  };


  const productOrders = useMemo(() => {
    if (!foundProduct) return [];
    return allOrders.filter(order => order.items.some(item => item.productId === foundProduct.id));
  }, [foundProduct, allOrders]);

  const bookedDates = useMemo(() => {
    if (!foundProduct || (foundProduct.category !== 'rental' && foundProduct.category !== 'both')) {
      return [];
    }
    
    const dates: Date[] = [];
    
    const rentalOrders = productOrders.filter(order => {
        const itemInOrder = order.items.find(i => i.productId === foundProduct.id);
        const itemType = itemInOrder?.itemTransactionType || order.transactionType;

        return itemType === 'Rental' && 
               order.status !== 'Cancelled' && 
               order.status !== 'Returned' &&
               order.returnStatus !== 'fully_returned';
    });

    rentalOrders.forEach(order => {
        if (order.deliveryDate && order.returnDate) {
            try {
                const start = startOfDay(new Date(order.deliveryDate));
                const end = startOfDay(new Date(order.returnDate));
                
                if (start <= end) {
                    dates.push(...eachDayOfInterval({ start, end }));
                }
            } catch (e) {
                console.error("Invalid date for order:", order.orderCode, e);
            }
        }
    });

    return dates;
  }, [productOrders, foundProduct]);

  const allDaysWithStatus = useMemo(() => {
    if (!foundProduct || (foundProduct.category !== 'rental' && foundProduct.category !== 'both')) {
      return [];
    }

    const today = startOfDay(new Date());
    const rangeEnd = addDays(today, 120); // Look 120 days ahead (4 months)
    const allDatesInRange = eachDayOfInterval({ start: today, end: rangeEnd });

    const bookedTimestamps = new Set(bookedDates.map(d => d.getTime()));

    return allDatesInRange.map(date => ({
        date,
        isBooked: bookedTimestamps.has(date.getTime())
    }));
  }, [bookedDates, foundProduct]);


  const handleSearch = () => {
    setSearchAttempted(true);
    if (!searchTerm) {
      setFoundProduct(null);
      return;
    }

    const lowercasedSearchTerm = searchTerm.toLowerCase();
    
    const product = allProducts.find(p => 
        p.productCode?.includes(lowercasedSearchTerm) ||
        p.name.toLowerCase().includes(lowercasedSearchTerm)
    );
    setFoundProduct(product || null);
  };

  const getBranchName = (branchId: string) => {
    return branches.find((b: any) => b.id === branchId)?.name || 'غير معروف';
  };
  
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Completed':
                return <Badge className="bg-green-500 text-white">مكتمل</Badge>;
            case 'Delivered to Customer':
                return <Badge className="bg-blue-500 text-white">مؤجر</Badge>;
            case 'Ready for Pickup':
                return <Badge variant="secondary">جاهز للتسليم</Badge>;
            case 'Pending':
                return <Badge variant="destructive">قيد التجهيز</Badge>;
            case 'Returned from Tailor':
                return <Badge className="bg-purple-500 text-white">عند الخياط</Badge>;
            case 'Returned':
                return <Badge className="bg-green-100 text-green-800">تم الإرجاع</Badge>;
            case 'Cancelled':
                return <Badge variant="destructive">ملغي</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="الاستعلام عن صنف" showBackButton />

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle>بحث عن صنف</CardTitle>
                <CardDescription>
                  ابحث باستخدام الباركود أو اسم الصنف.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="search"
                    placeholder="أدخل الباركود أو اسم الصنف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    disabled={isLoading}
                  />
                  <Button onClick={handleSearch} className="gap-1" disabled={isLoading}>
                    {isLoading ? "..." : <Search className="h-4 w-4" />}
                    بحث
                  </Button>
                </div>
                <div className="pt-2">
                  <Numpad 
                      onInput={handleNumpadInput}
                      onClear={handleNumpadClear}
                      onBackspace={handleNumpadBackspace}
                  />
                </div>
              </CardContent>
            </Card>
        </div>

        <div className="md:col-span-2 flex flex-col gap-8">
            {isLoading && searchAttempted && (
              <Card>
                  <CardHeader>
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                  </CardHeader>
                  <CardContent>
                      <Skeleton className="h-32 w-full" />
                  </CardContent>
              </Card>
            )}

            {!isLoading && foundProduct ? (
              <div className="flex flex-col gap-8">
                  <Card>
                  <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                      <div>
                          <CardTitle className="font-headline text-2xl">
                          {foundProduct.name} - مقاس {foundProduct.size}
                          </CardTitle>
                          <CardDescription>كود: {foundProduct.productCode}</CardDescription>
                      </div>
                      <Badge className="bg-blue-500 text-white text-base">متوفر</Badge>
                      </div>
                  </CardHeader>
                  <CardContent className="grid gap-6">
                      <Separator />
                      <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <h3 className="font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-primary"/> تفاصيل المنتج</h3>
                          <div className="text-sm space-y-1">
                          <p><strong>السعر:</strong> {(Number(foundProduct.price) || 0).toLocaleString()} ج.م</p>
                          <p><strong>النوع:</strong> {foundProduct.category === 'rental' ? 'إيجار' : 'بيع'}</p>
                          <p><strong>المجموعة:</strong> {foundProduct.group || '-'}</p>
                          <div className="flex items-center gap-2">
                              <Palette className="h-4 w-4 text-muted-foreground" />
                              <p><strong>اللون:</strong> {foundProduct.color || '-'}</p>
                          </div>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <h3 className="font-semibold">توافر الكميات</h3>
                          <div className="text-sm rounded-md border">
                          <div className="flex justify-between p-2 border-b">
                              <span>الفرع الأساسي</span>
                              <span className="font-mono">{getBranchName(foundProduct.branchId)}</span>
                          </div>
                          <div className="flex justify-between p-2 border-b">
                              <span>الكمية المتاحة للعملية</span>
                              <span className="font-mono font-bold text-green-600">{foundProduct.quantityInStock - foundProduct.quantityRented}</span>
                          </div>
                          <div className="flex justify-between p-2 border-b text-red-600">
                              <span>الكمية المباعة</span>
                              <span className="font-mono">{foundProduct.quantitySold}</span>
                          </div>
                          <div className="flex justify-between p-2 text-red-600">
                              <span>الكمية المؤجرة حالياً</span>
                              <span className="font-mono">{foundProduct.quantityRented}</span>
                          </div>
                          </div>
                      </div>
                      </div>
                      {foundProduct.showInAllBranches && (
                          <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                              <p><strong>ملاحظة:</strong> هذا المنتج متاح للعرض والطلب من جميع الفروع.</p>
                          </div>
                      )}
                  </CardContent>
                  </Card>

                  <Card>
                      <CardHeader>
                          <div className="flex items-center gap-2">
                              <History className="h-5 w-5 text-primary" />
                              <CardTitle>سجل حجوزات المنتج</CardTitle>
                          </div>
                          <CardDescription>
                              عرض جميع الطلبات السابقة والحالية التي تحتوي على هذا المنتج.
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                          <Table>
                              <TableHeader>
                              <TableRow>
                                  <TableHead className="text-center">كود الطلب</TableHead>
                                  <TableHead className="text-right">اسم العميل</TableHead>
                                  <TableHead className="text-center">تاريخ التسليم</TableHead>
                                  <TableHead className="text-center">تاريخ الإرجاع</TableHead>
                                  <TableHead className="text-center">الحالة</TableHead>
                                  <TableHead className="text-center">عرض</TableHead>
                              </TableRow>
                              </TableHeader>
                              <TableBody>
                              {productOrders.map((order) => (
                                  <TableRow key={order.id}>
                                  <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                                  <TableCell className="text-right">{order.customerName}</TableCell>
                                  <TableCell className="text-center">{formatDate(order.deliveryDate)}</TableCell>
                                  <TableCell className="text-center">{formatDate(order.returnDate)}</TableCell>
                                  <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                                  <TableCell className="text-center">
                                      <OrderDetailsDialog orderId={order.id}>
                                          <Button variant="ghost" size="icon">
                                              <Eye className="h-4 w-4" />
                                          </Button>
                                      </OrderDetailsDialog>
                                  </TableCell>
                                  </TableRow>
                              ))}
                              {productOrders.length === 0 && (
                                  <TableRow>
                                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                          لا توجد حجوزات لهذا المنتج بعد.
                                      </TableCell>
                                  </TableRow>
                              )}
                              </TableBody>
                          </Table>
                      </CardContent>
                  </Card>

                  {(foundProduct.category === 'rental' || foundProduct.category === 'both') && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-5 w-5 text-primary" />
                          <CardTitle>جدول توفر المنتج (خلال 4 أشهر)</CardTitle>
                        </div>
                        <CardDescription>
                          الأيام المحجوزة باللون الأحمر والأيام المتاحة باللون الأخضر.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                          {allDaysWithStatus.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                  {allDaysWithStatus.map(({ date, isBooked }) => (
                                      <div key={date.toISOString()} className={cn(
                                          "p-2 border rounded-md text-center text-sm",
                                          isBooked 
                                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 dark:border-red-500/30" 
                                              : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-500/30"
                                      )}>
                                          <p className="font-bold">{format(date, 'd')}</p>
                                          <p className="text-xs">{format(date, 'MMMM', { locale: ar })}</p>
                                          <p className="text-xs text-muted-foreground">{format(date, 'EEE', { locale: ar })}</p>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center text-muted-foreground py-10">
                                لا توجد بيانات لعرضها.
                              </div>
                          )}
                      </CardContent>
                    </Card>
                  )}

              </div>
            ) : (
              searchAttempted && !isLoading && (
                <Card>
                  <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <ShieldAlert className="h-10 w-10 text-destructive" />
                    <p className="font-semibold">لم يتم العثور على المنتج</p>
                    <p>الرجاء التأكد من الكود أو اسم المنتج والمحاولة مرة أخرى.</p>
                  </CardContent>
                </Card>
              )
            )}
        </div>
      </div>
    </div>
  );
}

export default function InventoryCheckPage() {
    return (
        <AppLayout>
            <InventoryCheckPageContent />
        </AppLayout>
    )
}
