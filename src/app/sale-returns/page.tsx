'use client';

import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Eye, Undo, Hash, Clock, User } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useState, useMemo, useEffect } from 'react';
import type { SaleReturn } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { AddSaleReturnDialog } from '@/components/add-sale-return-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';

const requiredPermissions = ['sale-returns:add'] as const;

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
   if (isNaN(date.getTime())) {
      return '-'
  }
  return date.toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
}

function SaleReturnsPageContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | undefined>(undefined);
  const { data: saleReturns, isLoading, error } = useRtdbList<SaleReturn>('saleReturns');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  /**
   * AGGRESSIVE CLEANUP: 
   * This fixes the "frozen screen" issue where Radix UI leaves 'pointer-events: none' on the body.
   */
  useEffect(() => {
    if (!isDialogOpen) {
      const cleanup = () => {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = '';
        document.body.classList.remove('pointer-events-none');
      };
      const timer1 = setTimeout(cleanup, 100);
      const timer2 = setTimeout(cleanup, 500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [isDialogOpen]);

  const handleOpenDialog = (saleReturn?: SaleReturn) => {
    setSelectedReturn(saleReturn);
    setTimeout(() => setIsDialogOpen(true), 50);
  };

  const sortedReturns = useMemo(() => {
    if (isLoading) return [];
    return [...saleReturns].sort((a, b) => new Date(b.createdAt || b.returnDate).getTime() - new Date(a.createdAt || a.returnDate).getTime());
  }, [saleReturns, isLoading]);
  
  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }
  
  const pageIsLoading = isLoading || isLoadingPermissions;

  const renderMobileCards = () => (
    <div className="grid gap-4 md:hidden">
        {sortedReturns.map(sr => (
            <Card key={sr.id} className="overflow-hidden border-destructive/20">
                <CardHeader className="pb-2 bg-destructive/5">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Undo className="h-4 w-4 text-destructive" />
                                <CardTitle className="font-mono text-lg">{sr.returnCode}</CardTitle>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                <Hash className="h-3 w-3" />
                                طلب أصلي: {sr.orderCode}
                            </div>
                        </div>
                        <Badge variant="destructive" className="font-mono font-bold">
                            -{sr.refundAmount.toLocaleString()} ج.م
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/> التاريخ:</span>
                        <span>{formatDate(sr.returnDate)}</span>
                    </div>
                    {sr.shiftCode && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3"/> الوردية:</span>
                            <Badge variant="outline" className="border-primary/30 text-primary h-5">{sr.shiftCode}</Badge>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/> المسؤول:</span>
                        <span>{sr.userName}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t text-xs">
                        <span className="text-muted-foreground">عدد الأصناف المرتجعة:</span>
                        <span className="font-bold">{sr.items.length}</span>
                    </div>
                </CardContent>
                <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleOpenDialog(sr)}>
                        <Eye className="h-4 w-4" />
                        عرض التفاصيل
                    </Button>
                </CardFooter>
            </Card>
        ))}
    </div>
  );

  const renderDesktopTable = () => (
    <Card className="hidden md:block">
        <CardHeader>
            <CardTitle>مرتجعات البيع</CardTitle>
            <CardDescription>قائمة بجميع المرتجعات من العملاء.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="text-right">كود المرتجع</TableHead>
                <TableHead className="text-right">كود الطلب الأصلي</TableHead>
                <TableHead className="text-center">التاريخ</TableHead>
                <TableHead className="text-center">الوردية</TableHead>
                <TableHead className="text-center">عدد الأصناف</TableHead>
                <TableHead className="text-center">قيمة المرتجع</TableHead>
                <TableHead className="text-center">المسؤول</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedReturns.map(sr => (
                <TableRow key={sr.id}>
                    <TableCell className="font-mono text-right">{sr.returnCode}</TableCell>
                    <TableCell className="font-mono text-right">{sr.orderCode}</TableCell>
                    <TableCell className="text-center text-xs">{formatDate(sr.returnDate)}</TableCell>
                    <TableCell className="text-center">
                        {sr.shiftCode ? <Badge variant="outline" className="text-primary border-primary/30 font-mono">{sr.shiftCode}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="text-center font-mono">{sr.items.length}</TableCell>
                    <TableCell className="font-mono text-center font-bold text-destructive">-{sr.refundAmount.toLocaleString()} ج.م</TableCell>
                    <TableCell className="text-center text-xs">{sr.userName}</TableCell>
                    <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(sr)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  const renderLoadingState = () => (
    <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="md:hidden"><CardContent className="p-6"><Skeleton className="h-24 w-full"/></CardContent></Card>
        ))}
        <Card className="hidden md:block">
            <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
    </div>
  );

  return (
    <>
      <AddSaleReturnDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        saleReturn={selectedReturn}
      />
      <div className="flex flex-col gap-8">
        <PageHeader title="مرتجعات البيع" showBackButton>
          {permissions.canSaleReturnsAdd && (
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                  <PlusCircle className="h-4 w-4" />
                  إنشاء مرتجع بيع
              </Button>
          )}
        </PageHeader>
        
        {pageIsLoading ? renderLoadingState() : (
            sortedReturns.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>مرتجعات البيع</CardTitle>
                        <CardDescription>قائمة بجميع المرتجعات من العملاء.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
                            <Undo className="h-10 w-10 opacity-20" />
                            <p>لا توجد مرتجعات بيع مسجلة بعد.</p>
                            {permissions.canSaleReturnsAdd && <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}>ابدأ أول عملية ارتجاع</Button>}
                        </div>
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
    </>
  );
}


export default function SaleReturnsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <SaleReturnsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}