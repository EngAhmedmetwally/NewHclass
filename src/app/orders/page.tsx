'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MoreHorizontal,
  PlusCircle,
  ArrowUpDown,
  Filter,
  User,
  Store,
  BookUser,
  Eye,
  CalendarIcon,
  Truck,
  CheckCircle2,
  Scissors,
  XCircle,
  Clock,
  Package,
  Phone,
  Info,
  Search,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
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
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Order, Branch } from '@/lib/definitions';
import { useUser } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { NewOrderDialog } from '@/components/new-order-dialog';
import { AuthLayout, AuthGuard } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { startOfDay, endOfDay, subDays, format, startOfToday } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { OrderItemsPreviewDialog } from '@/components/order-items-preview-dialog';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 50;
// تحديد مدى المزامنة بـ 45 يوماً لضمان سرعة الفتح الفائقة
const MAX_SYNC_DAYS = 45; 

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

const isOrderEffectivelyCompleted = (order: Order) => {
    return (order.status === 'Delivered to Customer' && order.transactionType === 'Sale') ||
           order.status === 'Returned' ||
           order.returnStatus === 'fully_returned';
}

function OrdersPageContent() {
  const { appUser } = useUser();
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['orders:add'] as const);
  const [currentPage, setCurrentPage] = useState(1);

  const isSuperAdmin = useMemo(() => appUser?.permissions.includes('all'), [appUser]);

  // --- State for Filters ---
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [status, setStatus] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  // الفتح السريع: افتراضياً آخر 7 أيام فقط لتقليل حمل المعالجة الأولي
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 7)));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  
  const [hideCompleted, setHideCompleted] = useState(true);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

  // مزامنة ذكية: جلب آخر 45 يوماً فقط من قاعدة البيانات لضمان السرعة
  const { data: allOrders, isLoading: isLoadingOrders, error: ordersError } = useRtdbList<Order>('daily-entries', {
      limit: MAX_SYNC_DAYS
  });
  
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');

  const isLoading = isLoadingOrders || isLoadingBranches || !appUser || isLoadingPermissions;

  useEffect(() => {
    if (appUser && !isSuperAdmin) {
        setBranchFilter(appUser.branchId || 'all');
    }
  }, [appUser, isSuperAdmin]);

  const filteredOrders = useMemo(() => {
    if (isLoading) return [];
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    return allOrders.filter(order => {
      // 1. الفلترة التاريخية (أهم عامل للسرعة)
      const orderDate = new Date(order.orderDate || order.createdAt || 0);
      const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
      if (!dateMatch) return false;

      // 2. البحث النصي
      const query = searchTerm.toLowerCase().trim();
      if (query) {
          const searchMatch = 
            (order.orderCode || "").toString().toLowerCase().includes(query) ||
            (order.customerName || "").toLowerCase().includes(query) ||
            (order.customerPhone || "").toLowerCase().includes(query) ||
            order.items?.some(item => item.productName.toLowerCase().includes(query));
          if (!searchMatch) return false;
      }

      // 3. نوع المعاملة
      if (transactionType !== 'all' && order.transactionType !== transactionType) return false;
      
      // 4. الحالة
      if (status === 'overdue') {
        const today = startOfToday();
        const isRental = order.transactionType === 'Rental';
        const isDelivered = order.status === 'Delivered to Customer';
        let isDateOverdue = false;
        if (order.returnDate) {
            try {
                const returnDateObj = new Date(order.returnDate);
                isDateOverdue = returnDateObj < today;
            } catch (e) {
                isDateOverdue = false;
            }
        }
        if (!(isRental && isDelivered && isDateOverdue)) return false;
      } else if (status !== 'all' && order.status !== status) {
        return false;
      }

      // 5. فرع المستخدم
      if (!isSuperAdmin && appUser?.branchId && appUser.branchId !== 'all') {
        if (order.branchId !== appUser.branchId) return false;
      } else if (branchFilter !== 'all' && order.branchId !== branchFilter) {
        return false;
      }

      // 6. خيار إخفاء المكتمل
      if (hideCompleted) {
          if (isOrderEffectivelyCompleted(order) && order.status !== 'Cancelled') return false;
      }

      return true;
    });
  }, [allOrders, searchTerm, transactionType, status, branchFilter, appUser, isLoading, fromDate, toDate, hideCompleted, isSuperAdmin]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, transactionType, status, branchFilter, fromDate, toDate, hideCompleted]);
  
  const getStatusComponent = (order: Order) => {
    if (order.status === 'Cancelled') {
        return <Badge variant="destructive" className="gap-1.5 bg-red-600"><XCircle className="h-3.5 w-3.5" />ملغي</Badge>;
    }

    if (order.returnStatus === 'fully_returned' || order.returnStatus === 'partially_returned') {
        return (
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 gap-1.5">
            {order.returnStatus === 'fully_returned' ? 'تم إرجاع كلي' : 'تم إرجاع جزئي'}
          </Badge>
        );
    }
      
    if (isOrderEffectivelyCompleted(order)) {
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />مكتمل</Badge>;
    }

    switch (order.status) {
      case 'Delivered to Customer':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-2"><Truck className="h-4 w-4" /><span>تم التسليم</span></Badge>;
      case 'Ready for Pickup':
        return <Badge className="bg-yellow-500 text-black">جاهز للتسليم</Badge>;
      case 'Returned from Tailor':
        return <Badge className="bg-purple-500 text-white gap-1.5"><Scissors className="h-3.5 w-3.5"/>من الخياط</Badge>;
      case 'Pending':
        return <Badge variant="secondary">قيد الانتظار</Badge>;
      default:
        return <Badge variant="destructive">{order.status || 'غير معروف'}</Badge>;
    }
  };

  if (ordersError) return <div className="p-8 text-destructive">خطأ في الاتصال: {ordersError.message}</div>;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="إدارة الطلبات" showBackButton>
        {permissions.canOrdersAdd && (
          <NewOrderDialog 
            open={isAddOrderOpen}
            onOpenChange={setIsAddOrderOpen}
            trigger={<Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" />إضافة طلب جديد</Button>} 
          />
        )}
      </PageHeader>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
             <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">فلترة ذكية للطلبات</CardTitle>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
               <div className="flex flex-col gap-2 col-span-full">
                <Label htmlFor="search">بحث سريع</Label>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="search"
                        placeholder="رقم الفاتورة، العميل، الهاتف، أو اسم المنتج..."
                        className="pr-9 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
              </div>
               <div className="flex flex-col gap-2">
                  <Label>من تاريخ</Label>
                  <DatePickerDialog value={fromDate} onValueChange={setFromDate} />
              </div>
               <div className="flex flex-col gap-2">
                  <Label>إلى تاريخ</Label>
                  <DatePickerDialog value={toDate} onValueChange={setToDate} fromDate={fromDate} />
              </div>
               <div className="flex flex-col gap-2">
                <Label htmlFor="type">نوع المعاملة</Label>
                 <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger id="type"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="Rental">إيجار</SelectItem>
                    <SelectItem value="Sale">بيع</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">الحالة</Label>
                 <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">كل الحالات</SelectItem>
                     <SelectItem value="Pending">قيد الانتظار</SelectItem>
                     <SelectItem value="Ready for Pickup">جاهز للتسليم</SelectItem>
                     <SelectItem value="Delivered to Customer">تم التسليم</SelectItem>
                     <SelectItem value="overdue" className="text-destructive font-bold">متأخر</SelectItem>
                     <SelectItem value="Returned">تم الإرجاع</SelectItem>
                     <SelectItem value="Cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 md:col-span-1">
                <div className="flex items-center space-x-2 space-x-reverse rounded-md border p-3 flex-1 bg-muted/10 h-10">
                  <Checkbox id="hide-completed" checked={hideCompleted} onCheckedChange={(checked) => setHideCompleted(!!checked)} />
                  <Label htmlFor="hide-completed" className="font-normal cursor-pointer text-xs">إخفاء المكتمل</Label>
                </div>
              </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
           <Card className="border-dashed h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Package className="h-12 w-12 opacity-10" />
                <p>لا توجد طلبات تطابق الفلتر (يتم عرض آخر 7 أيام افتراضياً).</p>
                <Button variant="outline" size="sm" onClick={() => { setFromDate(startOfDay(subDays(new Date(), 30))); setHideCompleted(false); }}>
                    توسيع مدى البحث (30 يوم)
                </Button>
            </Card>
        ) : (
             <div className="flex flex-col gap-4">
                {/* Desktop Table View */}
                <Card className="hidden md:block">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center">كود الطلب</TableHead>
                                    <TableHead className="text-center">الأصناف</TableHead>
                                    <TableHead className="text-right">العميل</TableHead>
                                    <TableHead className="text-center">الوردية</TableHead>
                                    <TableHead className="text-right">البائع</TableHead>
                                    <TableHead className="text-center">تاريخ الطلب</TableHead>
                                    <TableHead className="text-center">الإجمالي</TableHead>
                                    <TableHead className="text-center">الحالة</TableHead>
                                    <TableHead className="text-center">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedOrders.map((order) => (
                                    <TableRow key={order.uniqueKey || order.id} className={cn(order.status === 'Cancelled' && "bg-destructive/5 opacity-80")}>
                                        <TableCell className="text-center font-mono font-bold text-primary">{order.orderCode}</TableCell>
                                        <TableCell className="text-center"><OrderItemsPreviewDialog items={order.items || []} /></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium">{order.customerName}</span>
                                                {order.customerPhone && <span dir="ltr" className="text-[10px] text-muted-foreground font-mono">{order.customerPhone}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{order.shiftCode || '-'}</Badge></TableCell>
                                        <TableCell className="text-right text-xs">{order.sellerName}</TableCell>
                                        <TableCell className="text-center text-xs">{formatDate(order.orderDate)}</TableCell>
                                        <TableCell className="text-center font-mono font-bold">{order.total.toLocaleString()}</TableCell>
                                        <TableCell className="text-center">{getStatusComponent(order)}</TableCell>
                                        <TableCell className="text-center">
                                            <OrderDetailsDialog orderId={order.id}><Button variant="outline" size="sm" className="h-8 gap-1"><Eye className="h-3.5 w-3.5" />عرض</Button></OrderDetailsDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Mobile Cards View */}
                <div className="grid gap-4 md:hidden">
                    {paginatedOrders.map((order) => (
                        <Card key={order.uniqueKey || order.id}>
                            <CardHeader className="p-4 pb-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-primary">{order.orderCode}</span>
                                    <span className="font-bold">{order.total.toLocaleString()} ج.م</span>
                                </div>
                                <p className="text-sm font-medium text-right mt-1">{order.customerName}</p>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <OrderItemsPreviewDialog items={order.items || []} />
                                    <span className="text-[10px] text-muted-foreground">{formatDate(order.orderDate)}</span>
                                </div>
                                {getStatusComponent(order)}
                            </CardContent>
                            <CardFooter className="p-2 pt-0">
                                <OrderDetailsDialog orderId={order.id}><Button variant="ghost" size="sm" className="w-full text-xs h-8">عرض التفاصيل</Button></OrderDetailsDialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                
                {totalPages > 1 && (
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} /></PaginationItem>
                            <PaginationItem><span className="p-2 font-mono text-xs">صفحة {currentPage} من {totalPages}</span></PaginationItem>
                            <PaginationItem><PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} /></PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
             </div>
        )
      }
    </div>
  );
}

export default function OrdersPage() {
    return (
        <AuthLayout>
            <AuthGuard>
                <OrdersPageContent />
            </AuthGuard>
        </AuthLayout>
    )
}