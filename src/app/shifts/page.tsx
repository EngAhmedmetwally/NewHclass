
'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { PlusCircle, Clock, MoreVertical, FileText, Wallet, LogOut, Eye, Archive, TrendingDown, BadgePercent, ReceiptText, Hash, Trash2, AlertTriangle, Loader2, Undo, Landmark, ArrowUpRight, Phone, Smartphone, Banknote, ShoppingCart, Repeat, DollarSign, CreditCard } from 'lucide-react';
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
import { PostShiftDialog } from '@/components/post-shift-dialog';

const requiredPermissions = ['shifts:start', 'shifts:end', 'shifts:delete', 'shifts:view-closed', 'shifts:post'] as const;

const formatCurrency = (amount: number) => {
    return `${Math.round(amount).toLocaleString()} ج.م`;
}

const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

const getShiftCalculatedTotals = (shift: Shift, orders: Order[], expenses: Expense[]) => {
    let salesGross = 0;
    let rentalsGross = 0;
    let receivedCash = 0;
    let receivedVodafone = 0;
    let receivedInstaPay = 0;
    let receivedVisa = 0;
    let discounts = 0;
    let expenseTotal = 0;
    let saleReturnsTotal = 0;
    let transactionCount = 0;

    const shiftStartTime = new Date(shift.startTime);
    const shiftEndTime = shift.endTime ? new Date(shift.endTime) : new Date(8640000000000000);

    orders.forEach(order => {
        const creationDate = new Date(order.createdAt || order.orderDate);
        const orderIsLinked = order.shiftId === shift.id;
        const isLegacyMatch = !order.shiftId && 
                             order.processedByUserId === shift.cashier.id && 
                             creationDate >= shiftStartTime && 
                             creationDate <= shiftEndTime;
        
        if (orderIsLinked || isLegacyMatch) {
            const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
            if (order.status !== 'Cancelled') {
                if (order.transactionType === 'Sale') salesGross += subtotal;
                else rentalsGross += subtotal;
            }
            transactionCount++;
        }

        if (order.status !== 'Cancelled' || order.paid > 0) {
          if (order.discountAmount && order.discountAmount > 0) {
              const dDateStr = order.discountAppliedDate || order.createdAt || order.orderDate;
              const dDate = new Date(dDateStr);
              if (orderIsLinked || (!order.shiftId && order.processedByUserId === shift.cashier.id && dDate >= shiftStartTime && dDate <= shiftEndTime)) {
                  discounts += order.discountAmount;
                  transactionCount++;
              }
          }

          if (order.payments) {
              Object.values(order.payments).forEach((p: any) => {
                  const pDate = new Date(p.date);
                  const paymentIsLinked = p.shiftId === shift.id;
                  if (paymentIsLinked || (!p.shiftId && p.userId === shift.cashier.id && pDate >= shiftStartTime && pDate <= shiftEndTime)) {
                      if (p.method === 'Vodafone Cash') receivedVodafone += p.amount;
                      else if (p.method === 'InstaPay') receivedInstaPay += p.amount;
                      else if (p.method === 'Visa') receivedVisa += p.amount;
                      else receivedCash += p.amount;
                      transactionCount++;
                  }
              });
          } else if (order.paid > 0 && (orderIsLinked || isLegacyMatch)) {
              receivedCash += order.paid;
              transactionCount++;
          }
        }
    });

    expenses.forEach(e => {
        const eDate = new Date(e.date);
        const expenseIsLinked = e.shiftId === shift.id;
        if (expenseIsLinked || (!e.shiftId && e.userId === shift.cashier.id && eDate >= shiftStartTime && eDate <= shiftEndTime)) {
            if (e.category === 'مرتجعات بيع' || e.category === 'مرتجع بيع' || e.category === 'إلغاء طلبات') {
                saleReturnsTotal += e.amount;
            } else {
                expenseTotal += e.amount;
            }
            transactionCount++;
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
        transactionCount,
        totalRevenue: salesGross + rentalsGross,
        cashInDrawer: (shift.openingBalance || 0) + receivedCash - (expenseTotal + saleReturnsTotal)
    };
};

function ShiftStatusBadge({ shift }: { shift: Shift }) {
    if (!shift.endTime) return <Badge className="bg-green-500 text-white animate-pulse">مفتوحة</Badge>;
    if (shift.isPosted) return <Badge className="bg-green-100 text-green-800 border-green-200">تم الترحيل</Badge>;
    return <Badge variant="secondary">مغلقة</Badge>;
}

function DeleteShiftDialog({ shift, isEmpty, open, onOpenChange }: any) {
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
                        تنبيه: حذف وردية
                    </AlertDialogTitle>
                    <div className="text-muted-foreground text-sm space-y-2 leading-relaxed">
                        <p>هل أنت متأكد من حذف الوردية رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}؟</p>
                        {!isEmpty && <p className="text-destructive font-bold">تحذير: هذه الوردية تحتوي على حركات مسجلة وحذفها سيؤثر على ميزان التقارير.</p>}
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} className="bg-destructive" disabled={isLoading}>
                        {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Trash2 className="ml-2 h-4 w-4"/>}
                        تأكيد الحذف
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


function OpenShiftsView({ shifts, orders, expenses, isLoading, permissions }: { shifts: Shift[], orders: Order[], expenses: Expense[], isLoading: boolean, permissions: any }) {
    const router = useRouter();
    if (isLoading) return <div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-64 w-full" /></div>;
    
    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shifts.map((shift) => {
            const stats = getShiftCalculatedTotals(shift, orders, expenses);
            return (
                <Card key={shift.id} className="flex flex-col border-primary/50 h-full hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/shifts/${shift.id}`)}>
                    <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                        <CardTitle className="font-headline text-xl flex items-center gap-2"><Clock className="h-5 w-5" /> وردية {shift.cashier?.name}</CardTitle>
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
                            <div className="flex justify-between items-center text-amber-600">
                                <span className="flex items-center gap-1"><BadgePercent className="h-3 w-3" /> الخصومات المطبقة</span>
                                <span className="font-mono">{formatCurrency(stats.discounts)}</span>
                            </div>
                            <div className="flex justify-between items-center text-destructive">
                                <span className="flex items-center gap-1"><Undo className="h-3 w-3" /> مرتجعات وإلغاءات</span>
                                <span className="font-mono">-{formatCurrency(stats.saleReturnsTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-destructive">
                                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> المصروفات</span>
                                <span className="font-mono">-{formatCurrency(stats.expenseTotal)}</span>
                            </div>
                            <Separator className="my-1" />
                            <div className="flex justify-between items-center font-bold text-sm">
                                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> إجمالي الإيرادات (عقود)</span>
                                <span className="font-mono text-primary">{formatCurrency(stats.totalRevenue)}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-1.5 p-3 rounded-md border bg-blue-50/30">
                            <p className="text-[10px] font-bold text-blue-700 mb-1">توزيع النقدية المحصلة:</p>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> كاش (بالدرج)</span>
                                <span className="font-mono font-bold">{formatCurrency(stats.receivedCash)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="flex items-center gap-1 text-purple-600"><Phone className="h-3 w-3" /> فودافون كاش</span>
                                <span className="font-mono font-bold">{formatCurrency(stats.receivedVodafone)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="flex items-center gap-1 text-teal-600 font-bold"><Smartphone className="h-3 w-3" /> إنستا باي</span>
                                <span className="font-mono font-bold text-teal-600">{formatCurrency(stats.receivedInstaPay)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="flex items-center gap-1 text-blue-600 font-bold"><CreditCard className="h-3 w-3" /> فيزا</span>
                                <span className="font-mono font-bold text-blue-600">{formatCurrency(stats.receivedVisa)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 rounded-md bg-primary/10 border border-primary/20 text-primary p-3">
                            <span className="font-semibold text-xs flex items-center gap-2"><Wallet className="h-4 w-4" /> صافي النقدية المتوقع بالدرج</span>
                            <span className="font-bold text-xl font-mono">{formatCurrency(stats.cashInDrawer)}</span>
                            <span className="text-[9px] opacity-70">(رصيد افتتاح + مقبوضات كاش - مصروفات ومرتجعات)</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        {!shift.endTime && permissions.canShiftsEnd && (
                            <div className="w-full" onClick={(e) => e.stopPropagation()}>
                                <EndShiftDialog 
                                    shift={shift} 
                                    orders={orders} 
                                    expenses={expenses}
                                    trigger={<Button className="w-full gap-2"><LogOut className="h-4 w-4" /> إنهاء الوردية</Button>} 
                                />
                            </div>
                        )}
                    </CardFooter>
                </Card>
            )
        })}
        </div>
    );
}

function ClosedShiftsView({ shifts, orders, expenses, isLoading, router, permissions }: any) {
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-48 w-full" /></div>;
    
    return (
        <div className="space-y-4">
            {selectedShift && <DeleteShiftDialog shift={selectedShift} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} isEmpty={getShiftCalculatedTotals(selectedShift, orders, expenses).transactionCount === 0} />}
            
            <div className="grid gap-4 md:hidden">
                {shifts.map((shift: Shift) => {
                    const stats = getShiftCalculatedTotals(shift, orders, expenses);
                    return (
                        <Card key={shift.id} className={cn("hover:bg-muted/50", shift.isPosted ? "border-green-200 bg-green-50/20" : "bg-muted/10")}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col" onClick={() => router.push(`/shifts/${shift.id}`)}>
                                        <CardTitle className="text-base">{shift.cashier?.name}</CardTitle>
                                        <span className="text-[10px] font-mono text-primary font-bold">رقم {shift.shiftCode || shift.id.slice(-6).toUpperCase()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShiftStatusBadge shift={shift} />
                                        {permissions.canShiftsDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedShift(shift); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-2 text-xs" onClick={() => router.push(`/shifts/${shift.id}`)}>
                                <div className="flex justify-between"><span>النقدية الفعلية بالدرج:</span><span className="font-mono font-bold">{formatCurrency(shift.closingBalance || 0)}</span></div>
                                <div className="flex justify-between"><span>الإيراد الإجمالي:</span><span className="font-mono">{formatCurrency(stats.totalRevenue)}</span></div>
                                <div className="flex justify-between text-muted-foreground"><span>وسائل دفع أخرى:</span><span className="font-mono">{formatCurrency(stats.receivedVodafone + stats.receivedInstaPay + stats.receivedVisa)}</span></div>
                                {shift.isPosted && <div className="flex justify-between text-green-600"><span>رُحلت إلى:</span><span>{shift.postedToTreasuryName}</span></div>}
                            </CardContent>
                            <CardFooter>
                                {!shift.isPosted && permissions.canShiftsPost && (
                                    <PostShiftDialog shift={shift} trigger={<Button size="sm" variant="outline" className="w-full gap-1.5"><Landmark className="h-3 w-3"/> ترحيل للخزينة</Button>} />
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            <Card className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">الرقم</TableHead>
                            <TableHead className="text-right">الموظف</TableHead>
                            <TableHead className="text-center">إجمالي العقود</TableHead>
                            <TableHead className="text-center">الخصومات</TableHead>
                            <TableHead className="text-center">مصاريف ومرتجع</TableHead>
                            <TableHead className="text-center">كاش فعلي</TableHead>
                            <TableHead className="text-center">حالة الترحيل</TableHead>
                            <TableHead className="text-center">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.map((shift: Shift) => {
                            const stats = getShiftCalculatedTotals(shift, orders, expenses);
                            return (
                                <TableRow key={shift.id} className={cn(shift.isPosted && "bg-green-50/30")}>
                                    <TableCell className="font-mono font-bold text-primary">{shift.shiftCode || shift.id.slice(-6).toUpperCase()}</TableCell>
                                    <TableCell className="font-medium">{shift.cashier?.name}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(stats.totalRevenue)}</TableCell>
                                    <TableCell className="text-center font-mono text-amber-600">{formatCurrency(stats.discounts)}</TableCell>
                                    <TableCell className="text-center font-mono text-destructive">-{formatCurrency(stats.expenseTotal + stats.saleReturnsTotal)}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(shift.closingBalance || 0)}</TableCell>
                                    <TableCell className="text-center"><ShiftStatusBadge shift={shift}/></TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {!shift.isPosted && permissions.canShiftsPost && (
                                                <PostShiftDialog shift={shift} trigger={<Button variant="outline" size="sm" className="h-8 gap-1.5"><ArrowUpRight className="h-3.5 w-3.5"/> ترحيل</Button>} />
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link href={`/shifts/${shift.id}`}><Eye className="h-4 w-4" /></Link></Button>
                                            {permissions.canShiftsDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedShift(shift); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}

function ShiftsPageContent() {
    const { data: allShifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts');
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
                if (shift.endTime) closed.push(shift);
                else open.push(shift);
            });
        return { openShifts: open, closedShifts: closed };
    }, [allShifts]);
    
    const pageIsLoading = isLoadingShifts || isLoadingPermissions || isLoadingOrders || isLoadingExpenses;

  return (
    <AuthLayout>
      <AuthGuard>
        <div className="flex flex-col gap-8">
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
                <CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-green-500"/><CardTitle>الورديات المفتوحة</CardTitle></div></CardHeader>
                <CardContent><OpenShiftsView shifts={openShifts} orders={orders} expenses={expenses} isLoading={pageIsLoading} permissions={permissions} /></CardContent>
            </Card>
             {permissions.canShiftsViewClosed && (
                <Card>
                    <CardHeader><div className="flex items-center gap-2"><Archive className="h-5 w-5 text-muted-foreground"/><CardTitle>سجل الورديات المغلقة والترحيل</CardTitle></div><CardDescription>الورديات التي تم إنهاء عملها وتنتظر التوريد للخزينة الرئيسية.</CardDescription></CardHeader>
                    <CardContent><ClosedShiftsView shifts={closedShifts} orders={orders} expenses={expenses} isLoading={pageIsLoading} router={router} permissions={permissions}/></CardContent>
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
