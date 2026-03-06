
'use client';

import React, { useMemo, useState, use } from 'react';
import {
  FileText,
  DollarSign,
  Package,
  Landmark,
  TrendingUp,
  Boxes,
  History,
  Pencil,
  Printer,
  Trash2,
  Eye,
  TrendingDown,
  ArrowLeftRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { AddProductDialog } from '@/components/add-product-dialog';
import { DeleteProductDialog } from '@/components/delete-product-dialog';
import type { Order, Product, Branch, StockMovement } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { AddStockDialog } from '@/components/add-stock-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';

const requiredPermissions = ['products:edit', 'products:delete', 'products:print-label', 'products:add-stock', 'products:view-details'] as const;

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        return '-'
    }
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function formatMovementDate(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}


function ProductDetailsPageContent({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const { data: products, isLoading: isLoadingProducts } = useRtdbList<Product>('products');
  const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isLoading = isLoadingProducts || isLoadingOrders || isLoadingBranches || isLoadingPermissions;

  const product = useMemo(() => {
    return products.find((p) => p.id === id);
  }, [products, id]);
  
  const productOrders: Order[] = useMemo(() => {
      if (!product) return [];
      return orders.filter(o => o.items.some(item => item.productId === product.id));
  }, [orders, product]);

  const stockMovements = useMemo(() => {
    if (!product?.stockMovements) return [];
    return Object.values(product.stockMovements).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [product]);

  const branchName = useMemo(() => {
      if (!product) return 'غير معروف';
      return branches.find(b => b.id === product.branchId)?.name || 'غير معروف';
  }, [branches, product]);


  if (isLoading) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="جاري تحميل المنتج..." showBackButton><Skeleton className="h-8 w-48" /></PageHeader>
            <div className="grid md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-8">
                    <Card><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>
                </div>
            </div>
             <Card><CardHeader><Skeleton className="h-48 w-full" /></CardHeader></Card>
        </div>
    )
  }

  if (!permissions.canProductsViewDetails) {
    return (
         <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
                <ShieldAlert className="h-12 w-12 text-destructive"/>
                <h3 className="text-2xl font-bold tracking-tight">غير مصرح لك</h3>
                <p className="text-sm text-muted-foreground">
                    ليس لديك الصلاحية لعرض تفاصيل هذا المنتج.
                </p>
                <Link href="/products">
                    <Button className="mt-4">العودة إلى المنتجات</Button>
                </Link>
            </div>
        </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">المنتج غير موجود</h3>
          <p className="text-sm text-muted-foreground">
            لم نتمكن من العثور على المنتج الذي تبحث عنه.
          </p>
          <Link href="/products">
            <Button className="mt-4">العودة إلى المنتجات</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const getTypeBadge = (type: string) => {
    return type === 'Rental' ? (
      <Badge variant="outline">إيجار</Badge>
    ) : (
      <Badge variant="default">بيع</Badge>
    );
  };
  
  const currentPrice = Number(product.price);

  return (
    <div className="flex flex-col gap-8">
      <DeleteProductDialog 
        product={product} 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onSuccess={() => router.push('/products')}
      />
      <PageHeader title={`${product.name} - مقاس ${product.size}`} showBackButton>
        <div className="flex items-center gap-2">
          {(product.category === 'sale' || product.category === 'both') && permissions.canProductsAddStock && <AddStockDialog product={product} />}
          {permissions.canProductsEdit && <AddProductDialog product={product} trigger={
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-4 w-4" /> تعديل
            </Button>
          } />}
          {permissions.canProductsPrintLabel && (
            <Button variant="outline" size="sm" className="gap-1">
                <Printer className="h-4 w-4" /> طباعة الباركود
            </Button>
          )}
          {permissions.canProductsDelete && (
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" /> حذف
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-8">
          <Card>
              <CardHeader>
                  <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle>الوصف</CardTitle>
                  </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                  <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-muted-foreground">السعر الحالي</p>
                          <p className="font-semibold">{currentPrice?.toLocaleString() || 0} ج.م</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-muted-foreground">الحالة</p>
                          <Badge className="bg-blue-500 text-white">{product.status}</Badge>
                      </div>
                  </div>
                    <div className="flex items-center gap-3">
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-muted-foreground">الفرع</p>
                          <p className="font-semibold">{branchName}</p>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-8">
              <Card>
                  <CardHeader>
                       <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <CardTitle>ملخص الاستخدام</CardTitle>
                      </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                          <span>مرات الإيجار:</span>
                          <span className="font-semibold">{product.rentalCount || 0}</span>
                      </div>
                       <div className="flex justify-between">
                          <span>مرات البيع:</span>
                          <span className="font-semibold">{product.quantitySold}</span>
                      </div>
                  </CardContent>
              </Card>
               <Card>
                  <CardHeader>
                      <div className="flex items-center gap-2">
                          <Boxes className="h-5 w-5 text-primary" />
                          <CardTitle>تفاصيل الكميات</CardTitle>
                      </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                          <span>الكمية الأولية:</span>
                          <span className="font-semibold">{product.initialStock}</span>
                      </div>
                       <div className="flex justify-between text-green-600 font-bold">
                          <span>الكمية المتاحة للعملية:</span>
                          <span className="font-semibold">{product.quantityInStock}</span>
                      </div>
                       <div className="flex justify-between text-red-600">
                          <span>الكمية المباعة:</span>
                          <span className="font-semibold">{product.quantitySold}</span>
                      </div>
                       <div className="flex justify-between text-red-600">
                          <span>الكمية المؤجرة حالياً:</span>
                          <span className="font-semibold">{product.quantityRented}</span>
                      </div>
                  </CardContent>
              </Card>
          </div>
          {(product.category === 'sale' || product.category === 'both' || product.category === 'rental') && (
             <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <CardTitle>سجل حركة المخزون</CardTitle>
                    </div>
                    <CardDescription>عرض جميع حركات الإضافة والصرف والتعديلات للمنتج.</CardDescription>
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
                                      {move.type === 'edit' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">تعديل يدوي</Badge>}
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
                                    <TableCell className="text-right">{move.userName}</TableCell>
                                </TableRow>
                            ))}
                            {stockMovements.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">لا توجد حركات مخزون مسجلة.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
          )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>سجل طلبات المنتج</CardTitle>
          </div>
          <CardDescription>
            عرض جميع الطلبات السابقة والحالية التي تحتوي على هذا المنتج.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">كود الطلب</TableHead>
                <TableHead className="text-right">اسم العميل</TableHead>
                <TableHead className="text-center">تاريخ الطلب</TableHead>
                <TableHead className="text-center">نوع المعاملة</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">الإجمالي</TableHead>
                <TableHead className="text-center">عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-center font-mono">{order.orderCode}</TableCell>
                  <TableCell className="text-right">{order.customerName}</TableCell>
                  <TableCell className="text-center">
                    {formatDate(order.orderDate)}
                  </TableCell>
                  <TableCell className="text-center">{getTypeBadge(order.transactionType)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-center font-mono">{(order.total || 0).toLocaleString()} ج.م</TableCell>
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
                        <TableCell colSpan={7} className="text-center h-24">
                           لا توجد طلبات لهذا المنتج بعد.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailsPage({ params }: PageProps) {
    const { id } = use(params);
    return (
        <AppLayout>
            <AuthGuard>
                <ProductDetailsPageContent id={id} />
            </AuthGuard>
        </AppLayout>
    )
}
