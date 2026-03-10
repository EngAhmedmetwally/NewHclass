
'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { PlusCircle, Clock, MoreVertical, FileText, Wallet, LogOut, Eye, Archive, TrendingDown, BadgePercent } from 'lucide-react';
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
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { EndShiftDialog } from '@/components/end-shift-dialog';
import type { Shift, Order } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { StartShiftDialog } from '@/components/start-shift-dialog';
import { useUser } from '@/firebase';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const requiredPermissions = ['shifts:start', 'shifts:end'] as const;

const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ج.م`;
}

const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function ShiftStatusBadge({ endTime }: { endTime?: string | Date }) {
    return endTime ? (
        <Badge variant="secondary">مغلقة</Badge>
    ) : (
        <Badge className="bg-green-500 text-white animate-pulse">مفتوحة</Badge>
    );
}


function OpenShiftsView({ shifts, isLoading, permissions }: { shifts: Shift[], isLoading: boolean, permissions: any }) {
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
            const totalReceived = (shift.cash || 0) + (shift.vodafoneCash || 0) + (shift.instaPay || 0);
            const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0) - (shift.discounts || 0);
            return (
                <Card 
                    key={shift.id} 
                    className="flex flex-col border-primary/50 h-full hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/shifts/${shift.id}`)}
                >
                    <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            وردية {shift.cashier?.name}
                        </CardTitle>
                        <CardDescription>
                            {formatDate(shift.startTime)}
                        </CardDescription>
                        </div>
                        <ShiftStatusBadge endTime={shift.endTime} />
                    </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm flex-grow">
                    <div>
                        <h4 className="font-medium mb-2">ملخص الحركات</h4>
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex justify-between">
                                <span>إجمالي المبيعات</span>
                                <span className="font-mono text-green-600 font-semibold">{formatCurrency(shift.salesTotal || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>إجمالي الإيجارات</span>
                                <span className="font-mono text-blue-600 font-semibold">{formatCurrency(shift.rentalsTotal || 0)}</span>
                            </div>
                            <div className="flex justify-between text-destructive">
                                <span>الخصومات المطبقة</span>
                                <span className="font-mono font-semibold">{formatCurrency(shift.discounts || 0)}</span>
                            </div>
                            <div className="flex justify-between text-destructive">
                                <span>المصروفات</span>
                                <span className="font-mono font-semibold">{formatCurrency(shift.refunds || 0)}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between font-bold">
                                <span>إجمالي الإيرادات</span>
                                <span className="font-mono text-lg">{formatCurrency((shift.salesTotal || 0) + (shift.rentalsTotal || 0))}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-medium mb-2">ملخص الدرج</h4>
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex justify-between">
                                <span>كاش</span>
                                <span className="font-mono font-semibold">{formatCurrency(shift.cash || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>فودافون كاش</span>
                                <span className="font-mono font-semibold">{formatCurrency(shift.vodafoneCash || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>إنستا باي</span>
                                <span className="font-mono font-semibold">{formatCurrency(shift.instaPay || 0)}</span>
                            </div>
                            <Separator/>
                            <div className="flex justify-between font-bold">
                                <span>إجمالي الدرج</span>
                                <span className="font-mono text-lg">{formatCurrency(totalReceived)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 rounded-md bg-primary/10 border border-primary/20 text-primary p-3 mt-auto">
                            <span className="font-semibold text-base flex items-center gap-2">
                                <Wallet className="h-5 w-5" />
                                صافي النقدية بالدرج
                            </span>
                            <span className="font-bold text-2xl font-mono">{formatCurrency(cashInDrawer)}</span>
                            <span className="text-xs text-primary/80">
                                (رصيد افتتاحي + كاش - مصروفات - خصومات)
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

function ClosedShiftsView({ shifts, isLoading, router }: { shifts: Shift[], isLoading: boolean, router: ReturnType<typeof useRouter> }) {
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
            <div className="grid gap-4 md:hidden">
                {shifts.map((shift) => {
                    const totalRevenue = (shift.salesTotal || 0) + (shift.rentalsTotal || 0);
                    const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0) - (shift.discounts || 0);
                    const difference = (shift.closingBalance || 0) - cashInDrawer;
                    return (
                        <Link href={`/shifts/${shift.id}`} key={shift.id} className="block">
                            <Card className={cn("hover:bg-muted/50 transition-colors", difference < 0 && "border-destructive bg-destructive/5")}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{shift.cashier?.name}</CardTitle>
                                    </div>
                                    <CardDescription>{formatDate(shift.startTime)}</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">إجمالي الإيرادات</span>
                                        <span className="font-mono font-semibold">{formatCurrency(totalRevenue)}</span>
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
                        </Link>
                    );
                })}
            </div>

            <Card className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">الموظف</TableHead>
                            <TableHead className="text-right">وقت البدء</TableHead>
                            <TableHead className="text-right">وقت الانتهاء</TableHead>
                            <TableHead className="text-center">رصيد افتتاحي</TableHead>
                            <TableHead className="text-center">إجمالي الإيرادات</TableHead>
                            <TableHead className="text-center">النقدية المستلمة</TableHead>
                            <TableHead className="text-center">الفرق (عجز/زيادة)</TableHead>
                            <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.map((shift) => {
                            const totalRevenue = (shift.salesTotal || 0) + (shift.rentalsTotal || 0);
                            const cashInDrawer = (shift.openingBalance || 0) + (shift.cash || 0) - (shift.refunds || 0) - (shift.discounts || 0);
                            const difference = (shift.closingBalance || 0) - cashInDrawer;
                            return (
                                <TableRow key={shift.id} onClick={() => router.push(`/shifts/${shift.id}`)} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", difference < 0 && "bg-destructive/10")}>
                                    <TableCell className="font-medium text-right">{shift.cashier?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right text-xs">{formatDate(shift.startTime)}</TableCell>
                                    <TableCell className="text-right text-xs">{shift.endTime ? formatDate(shift.endTime) : '-'}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(shift.openingBalance || 0)}</TableCell>
                                    <TableCell className="text-center font-mono font-semibold">{formatCurrency(totalRevenue)}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(shift.closingBalance || 0)}</TableCell>
                                    <TableCell className={cn("text-center font-mono font-bold", difference < 0 ? "text-destructive" : "text-green-600")}>
                                        {formatCurrency(difference)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
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
    
    const pageIsLoading = isLoadingShifts || isLoadingPermissions;

    if (error) {
      return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }

  return (
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
                <OpenShiftsView shifts={openShifts} isLoading={pageIsLoading} permissions={permissions} />
            </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-muted-foreground"/>
                    <CardTitle>سجل الورديات المغلقة</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <ClosedShiftsView shifts={closedShifts} isLoading={pageIsLoading} router={router} />
            </CardContent>
        </Card>
      </div>

    </div>
  );
}

export default function ShiftsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <ShiftsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
