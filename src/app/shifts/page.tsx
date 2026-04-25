
'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { 
    PlusCircle, 
    Clock, 
    Archive, 
    DollarSign, 
    Wallet, 
    LogOut, 
    Trash2, 
    Loader2, 
    Landmark, 
    ArrowUpRight, 
    Phone, 
    Smartphone, 
    Banknote, 
    ShoppingCart, 
    Repeat, 
    BadgePercent, 
    Undo, 
    FileText, 
    Hash,
    CreditCard
} from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { EndShiftDialog } from '@/components/end-shift-dialog';
import type { Shift, Order, Expense } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser, useDatabase } from '@/firebase';
import { AuthLayout, AuthGuard } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { ref, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { PostShiftDialog } from '@/components/post-shift-dialog';

const requiredPermissions = ['shifts:start', 'shifts:end', 'shifts:delete', 'shifts:view-closed', 'shifts:post'] as const;

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString()} ج.م`;

const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

const calculateShiftStats = (shift: Shift, shiftOrders: Order[], shiftExpenses: Expense[]) => {
    let salesGross = 0;
    let rentalsGross = 0;
    let receivedCash = 0;
    let receivedVodafone = 0;
    let receivedInstaPay = 0;
    let receivedVisa = 0;
    let discounts = 0;
    let expenseTotal = 0;
    let saleReturnsTotal = 0;

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(8640000000000000);

    shiftOrders.forEach(order => {
        if (order.status === 'Cancelled') return;
        
        const creationDate = new Date(order.createdAt || order.orderDate);
        const orderIsLinked = order.shiftId === shift.id;
        const isLegacyMatch = !order.shiftId && 
                             order.processedByUserId === shift.cashier.id && 
                             creationDate >= shiftStartTime && 
                             creationDate <= shiftEndTime;

        if (orderIsLinked || isLegacyMatch) {
            const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
            if (order.transactionType === 'Sale') salesGross += subtotal;
            else rentalsGross += subtotal;
        }

        if (order.payments) {
            Object.values(order.payments).forEach((p: any) => {
                const pDate = new Date(p.date);
                const paymentIsLinked = p.shiftId === shift.id;
                if (paymentIsLinked || (!p.shiftId && p.userId === shift.cashier.id && pDate >= shiftStartTime && pDate <= shiftEndTime)) {
                    const amt = Number(p.amount) || 0;
                    if (p.method === 'Vodafone Cash') receivedVodafone += amt;
                    else if (p.method === 'InstaPay') receivedInstaPay += amt;
                    else if (p.method === 'Visa') receivedVisa += amt;
                    else receivedCash += amt;
                }
            });
        } else if (order.paid > 0 && (orderIsLinked || isLegacyMatch)) {
            receivedCash += order.paid;
        }

        if (order.discountAmount) {
            const dDateStr = order.discountAppliedDate || order.createdAt || order.orderDate;
            const dDate = new Date(dDateStr);
            if (orderIsLinked || (!order.shiftId && order.processedByUserId === shift.cashier.id && dDate >= shiftStartTime && dDate <= shiftEndTime)) {
                discounts += order.discountAmount;
            }
        }
    });

    shiftExpenses.forEach(e => {
        const eDate = new Date(e.date);
        const expenseIsLinked = e.shiftId === shift.id;
        if (expenseIsLinked || (!e.shiftId && e.userId === shift.cashier.id && eDate >= shiftStartTime && eDate <= shiftEndTime)) {
            if (e.category === 'مرتجعات بيع' || e.category === 'مرتجع بيع' || e.category === 'إلغاء طلبات') {
                saleReturnsTotal += e.amount;
            } else {
                expenseTotal += e.amount;
            }
        }
    });

    const totalReceived = receivedCash + receivedVodafone + receivedInstaPay + receivedVisa;

    return { 
        salesGross, 
        rentalsGross, 
        receivedCash, 
        receivedVodafone,
        receivedInstaPay,
        receivedVisa,
        totalReceived,
        discounts, 
        expenseTotal, 
        saleReturnsTotal,
        totalRevenue: salesGross + rentalsGross,
        cashInDrawer: (Number(shift.openingBalance) || 0) + receivedCash - (expenseTotal + saleReturnsTotal)
    };
};

function ShiftStatusBadge({ shift }: { shift: Shift }) {
    if (!shift.endTime) return <Badge className="bg-green-500 text-white animate-pulse">مفتوحة</Badge>;
    if (shift.isPosted) return <Badge className="bg-green-100 text-green-800 border-green-200">تم الترحيل</Badge>;
    return <Badge variant="secondary">مغلقة</Badge>;
}

function ShiftsPageContent() {
    const { appUser } = useUser();
    const router = useRouter();
    const db = useDatabase();
    const { toast } = useToast();
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

    const { data: allShifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts', { limit: 500 });
    const { data: orders, isLoading: isLoadingOrders } = useRtdbList<Order>('daily-entries', { limit: 1000 });
    const { data: expenses, isLoading: isLoadingExpenses } = useRtdbList<Expense>('expenses', { limit: 500 });

    const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

    const { openShifts, closedShifts } = useMemo(() => {
        const open: Shift[] = [];
        const closed: Shift[] = [];
        if (allShifts) {
            [...allShifts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .forEach(shift => {
                    if (shift.endTime) closed.push(shift);
                    else open.push(shift);
                });
        }
        return { openShifts: open, closedShifts: closed };
    }, [allShifts]);

    const handleDelete = async () => {
        if (!shiftToDelete || !db) return;
        try {
            await remove(ref(db, `shifts/${shiftToDelete.id}`));
            toast({ title: "تم حذف الوردية بنجاح" });
            setIsDeleteDialogOpen(false);
            setShiftToDelete(null);
        } catch (e: any) {
            toast({ variant: "destructive", title: "خطأ في الحذف", description: e.message });
        }
    };

    const pageIsLoading = isLoadingShifts || isLoadingPermissions || isLoadingOrders || isLoadingExpenses;

    const renderShiftCard = (shift: Shift) => {
        const stats = calculateShiftStats(shift, orders, expenses);
        return (
            <Card key={shift.id} className="flex flex-col border-primary/50 h-full hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/shifts/${shift.id}`)}>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1 text-right">
                            <CardTitle className="font-headline text-xl flex items-center gap-2">وردية {shift.cashier?.name}</CardTitle>
                            <div className="flex flex-col text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1 font-mono text-primary font-bold"><Hash className="h-3 w-3"/> رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}</span>
                                <span>بدأت: {formatDate(shift.startTime)}</span>
                            </div>
                        </div>
                        <ShiftStatusBadge shift={shift} />
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-xs flex-grow">
                    <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3 text-muted-foreground" /> إجمالي المبيعات</span>
                            <span className="font-mono">{formatCurrency(stats.salesGross)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1"><Repeat className="h-3 w-3 text-muted-foreground" /> إجمالي الإيجارات</span>
                            <span className="font-mono">{formatCurrency(stats.rentalsGross)}</span>
                        </div>
                        <div className="flex justify-between items-center text-amber-600 font-bold">
                            <span className="flex items-center gap-1"><BadgePercent className="h-3 w-3" /> الخصومات المطبقة</span>
                            <span className="font-mono">{formatCurrency(stats.discounts)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive font-medium">
                            <span className="flex items-center gap-1"><Undo className="h-3 w-3" /> مرتجعات وإلغاءات</span>
                            <span className="font-mono">-{formatCurrency(stats.saleReturnsTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive font-medium">
                            <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> المصروفات</span>
                            <span className="font-mono">-{formatCurrency(stats.expenseTotal)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between items-center font-bold text-sm">
                            <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> إجمالي الإيرادات (عقود)</span>
                            <span className="font-mono text-primary">{formatCurrency(stats.totalRevenue)}</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-md bg-muted/40 dark:bg-neutral-900/60 border border-primary/10 space-y-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-black mb-1 border-b pb-1 border-primary/5">توزيع النقدية المحصلة:</p>
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px] font-bold">
                                <span className="flex items-center gap-1.5"><Banknote className="h-3 w-3 text-muted-foreground" /> كاش (درج):</span> 
                                <span className="font-mono">{formatCurrency(stats.receivedCash)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> فودافون كاش:</span> 
                                <span className="font-mono">{formatCurrency(stats.receivedVodafone)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="flex items-center gap-1.5"><Smartphone className="h-3 w-3" /> إنستا باي:</span> 
                                <span className="font-mono">{formatCurrency(stats.receivedInstaPay)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-bold text-sky-600 dark:text-sky-400">
                                <span className="flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> فيزا:</span> 
                                <span className="font-mono">{formatCurrency(stats.receivedVisa)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 shadow-sm text-center">
                        <p className="text-[10px] text-green-700 dark:text-green-400 font-black mb-1">صافي النقدية المتوقع بالدرج</p>
                        <p className="font-black text-2xl text-green-700 dark:text-green-500 font-mono">{formatCurrency(stats.cashInDrawer)}</p>
                    </div>
                </CardContent>
                <CardFooter>
                    {!shift.endTime && permissions.canShiftsEnd && (
                        <div className="w-full" onClick={(e) => e.stopPropagation()}>
                            <EndShiftDialog 
                                shift={shift} 
                                orders={orders} 
                                expenses={expenses}
                                trigger={<Button className="w-full gap-2 font-bold h-11"><LogOut className="h-5 w-5" /> إنهاء الوردية</Button>} 
                            />
                        </div>
                    )}
                </CardFooter>
            </Card>
        );
    }

  return (
    <AuthLayout>
      <AuthGuard>
        <div className="flex flex-col gap-8">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader>
                    <AlertDialogTitle>حذف الوردية</AlertDialogTitle>
                    <AlertDialogDescription>هل أنت متأكد من حذف الوردية بالكامل؟ هذا الإجراء قد يؤثر على دقة التقارير المالية.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive">تأكيد الحذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {appUser && <StartShiftDialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog} user={appUser} />}
          <PageHeader title="إدارة الورديات والترحيل" showBackButton>
            {permissions.canShiftsStart && (
                <Button size="sm" className="gap-1" onClick={() => setShowStartShiftDialog(true)}>
                    <PlusCircle className="h-4 w-4" /> بدء وردية جديدة
                </Button>
            )}
          </PageHeader>
          
          <div className="flex flex-col gap-8">
              <Card>
                <CardHeader className="text-right"><div className="flex items-center gap-2 justify-end"><Clock className="h-5 w-5 text-green-500"/><CardTitle>الورديات المفتوحة</CardTitle></div></CardHeader>
                <CardContent>
                    {pageIsLoading ? <div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-64 w-full" /></div> : (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {openShifts.map(renderShiftCard)}
                        </div>
                    )}
                </CardContent>
            </Card>

             {permissions.canShiftsViewClosed && (
                <Card>
                    <CardHeader className="text-right"><div className="flex items-center gap-2 justify-end"><Archive className="h-5 w-5 text-muted-foreground"/><CardTitle>سجل الورديات المغلقة والترحيل</CardTitle></div></CardHeader>
                    <CardContent className="p-0 sm:p-6 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">الرقم</TableHead>
                                    <TableHead className="text-right">الموظف</TableHead>
                                    <TableHead className="text-center">إجمالي العقود</TableHead>
                                    <TableHead className="text-center">التحصيل (نظام)</TableHead>
                                    <TableHead className="text-center">كاش فعلي</TableHead>
                                    <TableHead className="text-center">حالة الترحيل</TableHead>
                                    <TableHead className="text-center">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {closedShifts.map((shift) => {
                                    const stats = calculateShiftStats(shift, orders, expenses);
                                    return (
                                        <TableRow key={shift.id} className={cn(shift.isPosted && "bg-green-50/30")}>
                                            <TableCell className="font-mono font-bold text-primary">{shift.shiftCode || shift.id.slice(-6).toUpperCase()}</TableCell>
                                            <TableCell className="font-medium">{shift.cashier?.name}</TableCell>
                                            <TableCell className="text-center font-mono">{formatCurrency(stats.totalRevenue)}</TableCell>
                                            <TableCell className="text-center font-mono text-blue-600 font-bold">{formatCurrency(stats.totalReceived)}</TableCell>
                                            <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(shift.closingBalance || 0)}</TableCell>
                                            <TableCell className="text-center"><ShiftStatusBadge shift={shift}/></TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {!shift.isPosted && permissions.canShiftsPost && (
                                                        <PostShiftDialog shift={shift} trigger={<Button variant="outline" size="sm" className="h-8 gap-1.5"><ArrowUpRight className="h-3.5 w-3.5"/> ترحيل</Button>} />
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link href={`/shifts/${shift.id}`}><Eye className="h-4 w-4" /></Link></Button>
                                                    {permissions.canShiftsDelete && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setShiftToDelete(shift); setIsDeleteDialogOpen(true); }}>
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
    return <ShiftsPageContent />
}
