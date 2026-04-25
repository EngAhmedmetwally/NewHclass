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
  Search
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
import type { Order, Shift, User as UserType, Branch } from '@/lib/definitions';
import { useUser } from '@/firebase';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { NewOrderDialog } from '@/components/new-order-dialog';
import { AuthLayout, AuthGuard } from '@/components/app-layout';
import { OrderDetailsDialog } from '@/components/order-details-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { startOfDay, endOfDay, isPast, startOfToday, subMonths, addMonths, subYears, format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { OrderItemsPreviewDialog } from '@/components/order-items-preview-dialog';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 50;
const MAX_INITIAL_ORDERS = 1000; 

function formatDate(dateString?: string | Date) {
    if (!dateString) return '-';
    const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        return '-'
    }
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

  const [searchTerm, setSearchTerm] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [status, setStatus] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subMonths(new Date(), 1)));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  
  const [hideCompleted, setHideCompleted] = useState(true);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

  const { data: allOrders, isLoading: isLoadingOrders, error: ordersError } = useRtdbList<Order>('daily-entries', {
      limit: MAX_INITIAL_ORDERS
  });
  
  const { data: branches, isLoading: isLoadingBranches, error: branchesError } = useRtdbList<Branch>('branches');

  const isLoading = isLoadingOrders || isLoadingBranches || !appUser || isLoadingPermissions;
  const error = ordersError || branchesError;

  useEffect(() => {
    if (appUser && !isSuperAdmin) {
        setBranchFilter(appUser.branchId || 'all');
    }
  }, [appUser, isSuperAdmin]);

  useEffect(() => {
    if (!isAddOrderOpen) {
      const cleanup = () => {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = '';
        document.body.classList.remove('pointer-events-none');
      };
      const timer1 = setTimeout(cleanup, 100);
      const timer2 = setTimeout(cleanup, 500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [isAddOrderOpen]);


  const filteredOrders = useMemo(() => {
    if (isLoading) return [];
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    return allOrders.filter(order => {
      const orderDate = new Date(order.orderDate || order.createdAt || 0);
      const dateMatch = (!start || orderDate >= start) && (!end || orderDate <= end);
      if (!dateMatch) return false;

      const query = searchTerm.toLowerCase();
      const searchMatch = !searchTerm || 
        (order.orderCode || "").toString().toLowerCase().includes(query) ||
        (order.customerName || "").toLowerCase().includes(query) ||
        (order.customerPhone || "").toLowerCase().includes(query) ||
        order.items?.some(item => item.productName.toLowerCase().includes(query));

      if (!searchMatch) return false;

      const typeMatch = transactionType === 'all' || order.transactionType === transactionType;
      if (!typeMatch) return false;
      
      let statusMatch = true;
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
        statusMatch = isRental && isDelivered && isDateOverdue;
      } else if (status !== 'all') {
        statusMatch = order.status === status;
      }
      if (!statusMatch) return false;

      let branchMatch = true;
      if (!isSuperAdmin && appUser?.branchId && appUser.branchId !== 'all') {
        branchMatch = order.branchId === appUser.branchId;
      } else if (branchFilter !== 'all') {
        branchMatch = order.branchId === branchFilter;
      }
      if (!branchMatch) return false;

      const isCompleted = isOrderEffectivelyCompleted(order);
      const isCancelled = order.status === 'Cancelled';
      const completedMatch = !hideCompleted || isCancelled || !isCompleted;

      return completedMatch;
    });
  }, [allOrders, searchTerm, transactionType, status, branchFilter, appUser, isLoading, fromDate, toDate, hideCompleted, isSuperAdmin]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, transactionType, status, branchFilter, fromDate, toDate, hideCompleted]);
  
  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }

  const getStatusComponent = (order: Order) => {
    if (order.status === 'Cancelled') {
        return (
          <Badge variant="destructive" className="gap-1.5 bg-red-600">
            <XCircle className="h-3.5 w-3.5" />
            ملغي
          </Badge>
        );
    }

    if (order.returnStatus === 'fully_returned' || order.returnStatus === 'partially_returned') {
        return (
          <Badge
            variant="outline"
            className="bg-orange-100 text-orange-800 border-orange-300 gap-1.5"
          >
            {order.returnStatus === 'fully_returned' ? 'تم إرجاع كلي' : 'تم إرجاع جزئي'}
          </Badge>
        );
    }
      
    if (isOrderEffectivelyCompleted(order)) {
        return (
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 border-green-300 gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            مكتمل
          </Badge>
        );
    }

    switch (order.status) {
      case 'Delivered to Customer':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
            <Truck className="h-4 w-4" />
            <span>تم التسليم</span>
          </Badge>
        );
       case 'Returned':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            تم الإرجاع
          </Badge>
        );
      case 'Ready for Pickup':
        return <Badge className="bg-yellow-500 text-black">جاهز للتسليم</Badge>;
      case 'Returned from Tailor':
        return (
            <Badge className="bg-purple-500 text-white gap-1.5">
                <Scissors className="h-3.5 w-3.5"/>
                من الخياط
            </Badge>
        );
      case 'Pending':
        return <Badge variant="secondary">قيد الانتظار</Badge>;
      default:
        return <Badge variant="destructive">{order.status || 'غير معروف'}</Badge>;
    }
  };

    const renderMobileCards = () => (
        <div className="grid gap-4 md:hidden">
        {paginatedOrders.map((order) => (
            <Card key={order.uniqueKey || order.id} className={cn(order.status === 'Cancelled' && "opacity-75 border-destructive/20 bg-destructive/5")}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-lg">{order.orderCode || order.id.slice(-6).toUpperCase()}</CardTitle>
                <div className="text-lg font-mono font-bold">{(order.total || 0).toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground">{order.customerName || 'بدون اسم'}</span>
                        {order.customerPhone && <span dir="ltr" className="text-[9px]">{order.customerPhone}</span>}
                    </div>
                    <span>{formatDate(order.orderDate)}</span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <OrderItemsPreviewDialog items={order.items || []} />
                      <span className="text-xs font-medium">{order.items?.length || 0} أصناف</span>
                    </div>
                    {getStatusComponent(order)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" /> 
                        <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-primary/30">الوردية: {order.shiftCode || '-'}</Badge>
                    </div>
                    <div className="flex items-center gap-1"><BookUser className="h-3 w-3" /> {order.sellerName}</div>
                </div>
            </CardContent>
            <CardFooter className="pt-0">
                <OrderDetailsDialog orderId={order.id}>
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        عرض التفاصيل
                    </Button>
                </OrderDetailsDialog>
            </CardFooter>
            </Card>
        ))}
        </div>
    );

    const renderDesktopTable = () => (
        <Card className="hidden md:block">
            <CardContent className="p-0">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="text-center">كود الطلب</TableHead>
                    <TableHead className="text-center">الأصناف</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-center">الوردية</TableHead>
                    <TableHead className="text-right">البائع</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-center">تاريخ الطلب</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {!isLoading && paginatedOrders.map((order) => (
                    <TableRow key={order.uniqueKey || order.id} className={cn(order.status === 'Cancelled' && "bg-destructive/5 opacity-80")}>
                    <TableCell className="text-center font-mono font-bold text-primary">
                        {order.orderCode || order.id.slice(-6).toUpperCase()}
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderItemsPreviewDialog items={order.items || []} />
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                            <div className="flex flex-col items-end">
                                <span className="font-medium">{order.customerName || '---'}</span>
                                {order.customerPhone && <span dir="ltr" className="text-[10px] text-muted-foreground font-mono">{order.customerPhone}</span>}
                            </div>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-primary border-primary/30">
                            {order.shiftCode || '-'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                            <span className="truncate max-w-[100px]">{order.sellerName}</span>
                            <BookUser className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                            <span className="truncate max-w-[80px]">{order.branchName}</span>
                            <Store className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="text-xs">{formatDate(order.orderDate)}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold">
                        {(order.total || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                        {getStatusComponent(order)}
                    </TableCell>
                    <TableCell className="text-center">
                        <OrderDetailsDialog orderId={order.id}>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            عرض
                        </Button>
                        </OrderDetailsDialog>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="pt-4 border-t">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1} />
                            </PaginationItem>
                            <PaginationItem>
                                <span className="p-2 font-mono text-xs">صفحة {currentPage} من {totalPages}</span>
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages} />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </CardFooter>
            )}
        </Card>
    );

    const renderLoadingState = () => (
        <>
            <div className="grid gap-4 md:hidden">
                {[...Array(5)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-10 w-full" /></CardHeader>
                        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                    </Card>
                ))}
            </div>
            <Card className="hidden md:block">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {[...Array(10)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {[...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                        {[...Array(10)].map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </Card>
      </>
    );


  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="إدارة الطلبات" showBackButton>
        {permissions.canOrdersAdd && (
          <NewOrderDialog 
            open={isAddOrderOpen}
            onOpenChange={setIsAddOrderOpen}
            trigger={
              <Button size="sm" className="gap-1">
                  <PlusCircle className="h-4 w-4" />
                  إضافة طلب جديد
              </Button>
          } />
        )}
      </PageHeader>

      <Collapsible asChild defaultOpen className="rounded-lg border">
        <Card>
          <CollapsibleTrigger asChild>
             <div className="flex w-full items-center justify-between p-4 cursor-pointer">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle className="text-lg">فلترة الطلبات</CardTitle>
              </div>
              <Button variant="ghost" size="sm">تعديل الفلاتر</Button>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-0">
               <div className="flex flex-col gap-2 col-span-full">
                <Label htmlFor="search">بحث</Label>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="search"
                    placeholder="البحث بالطلب، المنتج، العميل أو رقم الهاتف..."
                    className="pr-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> يتم عرض أحدث {MAX_INITIAL_ORDERS} طلب فقط. استخدم البحث للوصول لطلبات محددة.
                </p>
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
                  <SelectTrigger id="type">
                    <SelectValue placeholder="كل الأنواع" />
                  </SelectTrigger>
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
                  <SelectTrigger id="status">
                    <SelectValue placeholder="كل الحالات" />
                  </SelectTrigger>
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
              <div className="flex items-end gap-2">
                <div className="flex items-center space-x-2 space-x-reverse rounded-md border p-3 flex-1">
                  <Checkbox id="hide-completed" checked={hideCompleted} onCheckedChange={(checked) => setHideCompleted(!!checked)} />
                  <Label htmlFor="hide-completed" className="font-normal cursor-pointer">إخفاء المكتمل</Label>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {isLoading ? renderLoadingState() : (
        filteredOrders.length === 0 ? (
           <Card>
              <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>لا توجد طلبات تطابق الفلتر الحالي.</p>
                 {permissions.canOrdersAdd && (
                  <NewOrderDialog 
                    open={isAddOrderOpen}
                    onOpenChange={setIsAddOrderOpen}
                    trigger={<Button variant="outline" size="sm">بدء طلب جديد</Button>} 
                  />
                )}
              </CardContent>
            </Card>
        ) : (
             <>
                {renderMobileCards()}
                {renderDesktopTable()}
             </>
        )
      )}
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
