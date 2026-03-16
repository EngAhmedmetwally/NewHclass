
'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { PlusCircle, Clock, MoreVertical, FileText, Wallet, LogOut, Eye, Archive, TrendingDown, BadgePercent, ReceiptText, Hash, Trash2, AlertTriangle, Loader2, Undo } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { EndShiftDialog } from '@/components/end-shift-dialog';
import type { Shift, Order, Expense, SaleReturn } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser, useDatabase } from '@/firebase';
import { AuthLayout, AuthGuard } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ref, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

const requiredPermissions = ['shifts:start', 'shifts:end', 'shifts:delete', 'shifts:view-closed'] as const;

const formatCurrency = (amount: number) => {
    return `${Math.round(amount).toLocaleString()} ج.م`;
}

const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

/**
 * Calculates accurate shift totals from actual transaction lines to ensure consistency with the detailed view.
 */
const getShiftCalculatedTotals = (shift: Shift, orders: Order[], expenses: Expense[]) => {
    let salesGross = 0;
    let rentalsGross = 0;
    let receivedCash = 0;
    let discounts = 0;
    let expenseTotal = 0;
    let saleReturnsTotal = 0;
    let transactionCount = 0;

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(8640000000000000); // Far future if open

    orders.forEach(order => {
        if (order.status === 'Cancelled') return;

        const creationDate = new Date(order.createdAt || order.orderDate);
        
        // Strict ID Link
        const orderIsLinked = order.shiftId === shift.id;
        
        // Legacy Fallback
        const isLegacyMatch = !order.shiftId && 
                             order.processedByUserId === shift.cashier.id && 
                             creationDate >= shiftStartTime && 
                             creationDate <= shiftEndTime;
        
        if (orderIsLinked || isLegacyMatch) {
            const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
            if (order.transactionType === 'Sale') salesGross += subtotal;
            else rentalsGross += subtotal;
            transactionCount++;
        }

        // Discounts
        if (order.discountAmount && order.discountAmount > 0) {
            const dDateStr = order.discountAppliedDate || order.createdAt || order.orderDate;
            const dDate = new Date(dDateStr);
            if (orderIsLinked || (!order.shiftId && order.processedByUserId === shift.cashier.id && dDate >= shiftStartTime && dDate <= shiftEndTime)) {
                discounts += order.discountAmount;
                transactionCount++;
            }
        }

        // Payments
        if (order.payments) {
            Object.values(order.payments).forEach(p => {
                const pDate = new Date(p.date);
                const paymentIsLinked = p.shiftId === shift.id;
                if (paymentIsLinked || (!p.shiftId && p.userId === shift.cashier.id && pDate >= shiftStartTime && pDate <= shiftEndTime)) {
                    receivedCash += p.amount;
                    transactionCount++;
                }
            });
        } else if (order.paid > 0 && (orderIsLinked || isLegacyMatch)) {
            receivedCash += order.paid;
            transactionCount++;
        }
    });

    expenses.forEach(e => {
        const eDate = new Date(e.date);
        const expenseIsLinked = e.shiftId === shift.id;
        if (expenseIsLinked || (!e.shiftId && e.userId === shift.cashier.id && eDate >= shiftStartTime && eDate <= shiftEndTime)) {
            if (e.category === 'مرتجعات بيع' || e.category === 'مرتجع بيع') {
                saleReturnsTotal += e.amount;
            } else {
                expenseTotal += e.amount;
            }
            transactionCount++;
        }
    });

    return { 
        salesGross, 
        rentalsGross, 
        receivedCash, 
        discounts, 
        expenseTotal, 
        saleReturnsTotal,
        transactionCount,
        totalRevenue: salesGross + rentalsGross,
        cashInDrawer: (shift.openingBalance || 0) + receivedCash - (expenseTotal + saleReturnsTotal)
    };
};

function ShiftStatusBadge({ endTime }: { endTime?: string | Date }) {
    return endTime ? (
        <Badge variant="secondary">مغلقة</Badge>
    ) : (
        <Badge className="bg-green-500 text-white animate-pulse">مفتوحة</Badge>
    );
}

function DeleteShiftDialog({ 
    shift, 
    isEmpty, 
    open, 
    onOpenChange 
}: { 
    shift: Shift, 
    isEmpty: boolean, 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) {
    const [isLoading, setIsLoading] = useState(false);
    const db = useDatabase();
    const { toast } = useToast();

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            await remove(ref(db, `shifts/${shift.id}`));
            toast({ title: "تم حذف الوردية بنجاح" });
            onOpenChange(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "خطأ في الحذف", description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-destructive" />
                        {isEmpty ? 'تأكيد حذف الوردية' : 'تنبيه: حذف وردية غير فارغة'}
                    </AlertDialogTitle>
                    <div className="text-muted-foreground text-sm space-y-2 leading-relaxed">
                        {isEmpty ? (
                            <p>هل أنت متأكد من حذف الوردية رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}؟ هذا الإجراء نهائي.</p>
                        ) : (
                            <div className="space-y-2">
                                <div className="text-destructive font-bold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>تحذير هام:</span>
                                </div>
                                <p>هذه الوردية تحتوي على <span className="font-bold underline">سجلات مالية وحركات مسجلة</span>. حذفها سيؤدي لعدم توازن التقارير المالية التاريخية.</p>
                                <p className="text-xs bg-muted p-2 rounded">إذا قمت بالحذف، ستختفي بيانات هذه الوردية من سجلات الموظفين ولكن الطلبات المرتبطة بها ستظل موجودة في النظام بدون مرجع للوردية.</p>
                            </div>
                        )}
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => { e.preventDefault(); handleDelete(); }} 
                        className="bg-destructive hover:bg-destructive/90" 
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Trash2 className="ml-2 h-4 w-4"/>}
                        {isEmpty ? 'تأكيد الحذف النهائي' : 'تأكيد الحذف على مسؤوليتي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


function OpenShiftsView({ shifts, orders, expenses, isLoading, permissions }: { shifts: Shift[], orders: Order[], expenses: Expense[], isLoading: boolean, permissions: any }) {
    const router = useRouter();

    if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(1)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-10 w-full" /></CardHeader>
            <CardContent className="grid gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
        ))}
      </div>
    );
  }
    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shifts.map((shift) => {
            const stats = getShiftCalculatedTotals(shift, orders, expenses);

            return (
                <Card 
                    key={shift.id} 
                    className="flex flex-col border-primary/50 h-full hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/shifts/${shift.id}`)}
                >
                    <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            وردية {shift.cashier?.name}
                        </CardTitle>
                        <div className="flex flex-col text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono text-primary font-bold">
                                <Hash className="h-3 w-3"/> رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}
                            </span>
                            <span>بدأت: {formatDate(shift.startTime)}</span>
                        </div>
                        </div>
                        <ShiftStatusBadge endTime={shift.endTime} />
                    </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm flex-grow">
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/30 border">
                        <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-muted-foreground"/> عدد الحركات:</span>
                        <span className="font-bold font-mono text-lg">{stats.transactionCount}</span>
                    </div>

                    <div>
                        <h4 className="font-medium mb-2">ملخص الحركات</h4>
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex justify-between">
                                <span>إجمالي المبيعات</span>
                                <span className="font-mono text-green-600 font-semibold">{formatCurrency(stats.salesGross)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>إجمالي الإيجارات</span>
                                <span className="font-mono text-blue-600 font-semibold">{formatCurrency(stats.rentalsGross)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600">
                                <span>الخصومات المطبقة</span>
                                <span className="font-mono font-semibold">{formatCurrency(stats.discounts)}</span>
                            </div>
                            <div className="flex justify-between text-destructive">
                                <span className="flex items-center gap-1"><Undo className="h-3 w-3"/> مرتجعات البيع</span>
                                <span className="font-mono font-semibold">{formatCurrency(stats.saleReturnsTotal)}</span>
                            </div>
                            <div className="flex justify-between text-destructive">
                                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3"/> المصروفات</span>
                                <span className="font-mono font-semibold">{formatCurrency(stats.expenseTotal)}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between font-bold">
                                <span>إجمالي الإيرادات (عقود)</span>
                                <span className="font-mono text-lg">{formatCurrency(stats.totalRevenue)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 rounded-md bg-primary/10 border border-primary/20 text-primary p-3 mt-auto">
                            <span className="font-semibold text-base flex items-center gap-2">
                                <Wallet className="h-5 w-5" />
                                صافي النقدية بالدرج
                            </span>
                            <span className="font-bold text-2xl font-mono">{formatCurrency(stats.cashInDrawer)}</span>
                            <span className="text-xs text-primary/80">
                                (رصيد افتتاح + مقبوضات - مصروفات ومرتجعات)
                            </span>
                    </div>
                    </CardContent>
                    <CardFooter className="flex flex-col items-start gap-4">
                        {!shift.endTime && permissions.canShiftsEnd && (
                            <div className="w-full" onClick={(e) => e.stopPropagation()}>
                                <EndShiftDialog shift={shift} trigger={
                                    <Button className="w-full gap-2">
                                        <LogOut className="h-4 w-4" />
                                        استلام وإنهاء الوردية
                                    </Button>
                                } />
                            </div>
                        )}
                    </CardFooter>
                </Card>
            )
        })}
        {shifts.length === 0 && (
             <Card className="md:col-span-3">
                <CardContent className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <p>لا توجد ورديات مفتوحة حاليًا.</p>
                </CardContent>
            </Card>
        )}
      </div>
    );
}

function ClosedShiftsView({ shifts, orders, expenses, isLoading, router, permissions }: { shifts: Shift[], orders: Order[], expenses: Expense[], isLoading: boolean, router: any, permissions: any }) {
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="grid gap-4 md:hidden">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                <div className="hidden md:block"><Skeleton className="h-64 w-full" /></div>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {selectedShift && (
                <DeleteShiftDialog 
                    shift={selectedShift} 
                    open={isDeleteDialogOpen} 
                    onOpenChange={setIsDeleteDialogOpen}
                    isEmpty={getShiftCalculatedTotals(selectedShift, orders, expenses).transactionCount === 0}
                />
            )}
            <div className="grid gap-4 md:hidden">
                {shifts.map((shift) => {
                    const stats = getShiftCalculatedTotals(shift, orders, expenses);
                    const difference = (shift.closingBalance || 0) - stats.cashInDrawer;

                    return (
                        <Card key={shift.id} className={cn("hover:bg-muted/50 transition-colors", difference < 0 && "border-destructive bg-destructive/5")}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col" onClick={() => router.push(`/shifts/${shift.id}`)}>
                                        <CardTitle className="text-base">{shift.cashier?.name}</CardTitle>
                                        <span className="text-[10px] font-mono text-primary font-bold">رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono">{stats.transactionCount} حركة</Badge>
                                        {permissions.canShiftsDelete && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedShift(shift); setIsDeleteDialogOpen(true); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex flex-col mt-1">
                                    <span>بدأت: {formatDate(shift.startTime)}</span>
                                    <span>انتهت: {formatDate(shift.endTime)}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-2 text-sm" onClick={() => router.push(`/shifts/${shift.id}`)}>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">إجمالي الإيرادات</span>
                                    <span className="font-mono font-semibold">{formatCurrency(stats.totalRevenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">النقدية المستلمة</span>
                                    <span className="font-mono font-bold text-primary">{formatCurrency(shift.closingBalance || 0)}</span>
                                </div>
                                {difference !== 0 && (
                                    <div className={`flex justify-between font-bold mt-2 pt-2 border-t ${difference < 0 ? 'border-destructive/50 text-destructive' : 'text-green-600'}`}>
                                        <span>{difference < 0 ? 'العجز' : 'الزيادة'}</span>
                                        <span className="font-mono">{formatCurrency(difference)}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">رقم الوردية</TableHead>
                            <TableHead className="text-right">الموظف</TableHead>
                            <TableHead className="text-right">وقت الفتح</TableHead>
                            <TableHead className="text-right">وقت الإغلاق</TableHead>
                            <TableHead className="text-center">عدد الحركات</TableHead>
                            <TableHead className="text-center">إجمالي الإيرادات</TableHead>
                            <TableHead className="text-center">النقدية المستلمة</TableHead>
                            <TableHead className="text-center">الفرق</TableHead>
                            <TableHead className="text-center">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.map((shift) => {
                            const stats = getShiftCalculatedTotals(shift, orders, expenses);
                            const difference = (shift.closingBalance || 0) - stats.cashInDrawer;

                            return (
                                <TableRow key={shift.id} className={cn("hover:bg-muted/50 transition-colors", difference < 0 && "bg-destructive/10")}>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{shift.shiftCode || shift.id.slice(-6).toUpperCase()}</TableCell>
                                    <TableCell className="font-medium text-right">{shift.cashier?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right text-[10px] font-mono">{formatDate(shift.startTime)}</TableCell>
                                    <TableCell className="text-right text-[10px] font-mono">{shift.endTime ? formatDate(shift.endTime) : '-'}</TableCell>
                                    <TableCell className="text-center font-mono font-bold">{stats.transactionCount}</TableCell>
                                    <TableCell className="text-center font-mono font-semibold">{formatCurrency(stats.totalRevenue)}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(shift.closingBalance || 0)}</TableCell>
                                    <TableCell className={cn("text-center font-mono font-bold", difference < 0 ? "text-destructive" : "text-green-600")}>
                                        {formatCurrency(difference)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                <Link href={`/shifts/${shift.id}`}>
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            {permissions.canShiftsDelete && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => { setSelectedShift(shift); setIsDeleteDialogOpen(true); }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            {!isLoading && shifts.length === 0 && (
                <Card>
                    <CardContent className="h-24 flex items-center justify-center text-muted-foreground">
                        لا توجد ورديات مغلقة مسجلة بعد.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ShiftsPageContent() {
    const { data: allShifts, isLoading: isLoadingShifts, error } = useRtdbList<Shift>('shifts');
    const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries');
    const { data: expenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses');
    const { appUser } = useUser();
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
    const router = useRouter();

    const { openShifts, closedShifts } = useMemo(() => {
        const open: Shift[] = [];
        const closed: Shift[] = [];
        [...allShifts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .forEach(shift => {
                if (shift.endTime) {
                    closed.push(shift);
                } else {
                    open.push(shift);
                }
            });
        return { openShifts: open, closedShifts: closed };
    }, [allShifts]);
    
    const pageIsLoading = isLoadingShifts || isLoadingPermissions || isLoadingOrders || isLoadingExpenses;

    if (error) {
      return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }

  return (
    <AuthLayout>
      <AuthGuard>
        <div className="flex flex-col gap-8">
          {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
          <PageHeader title="الورديات" showBackButton>
            {permissions.canShiftsStart && (
                <Button size="sm" className="gap-1" onClick={() => setShowStartShiftDialog(true)}>
                <PlusCircle className="h-4 w-4" />
                بدء وردية جديدة
                </Button>
            )}
          </PageHeader>
          
          <div className="flex flex-col gap-8">
              <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-green-500"/>
                        <CardTitle>الورديات المفتوحة حاليًا</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <OpenShiftsView 
                      shifts={openShifts} 
                      orders={orders} 
                      expenses={expenses}
                      isLoading={pageIsLoading} 
                      permissions={permissions} 
                    />
                </CardContent>
            </Card>

             {permissions.canShiftsViewClosed && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Archive className="h-5 w-5 text-muted-foreground"/>
                            <CardTitle>سجل الورديات المغلقة</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ClosedShiftsView 
                        shifts={closedShifts} 
                        orders={orders} 
                        expenses={expenses}
                        isLoading={pageIsLoading} 
                        router={router} 
                        permissions={permissions}
                        />
                    </CardContent>
                </Card>
             )}
          </div>

        </div>
      </AuthGuard>
    </AuthLayout>
  );
}

export default function ShiftsPage() {
    return (
        <ShiftsPageContent />
    )
}
