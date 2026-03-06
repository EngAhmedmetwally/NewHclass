

'use client';

import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Eye } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useState, useMemo } from 'react';
import type { SaleReturn } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { AddSaleReturnDialog } from '@/components/add-sale-return-dialog';
import { usePermissions } from '@/hooks/use-permissions';

const requiredPermissions = ['sale-returns:add'] as const;

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
   if (isNaN(date.getTime())) {
      return '-'
  }
  return format(date, "d MMMM yyyy");
}

function SaleReturnsPageContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | undefined>(undefined);
  const { data: saleReturns, isLoading, error } = useRtdbList<SaleReturn>('saleReturns');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  const handleOpenDialog = (saleReturn?: SaleReturn) => {
    setSelectedReturn(saleReturn);
    setIsDialogOpen(true);
  };

  const sortedReturns = useMemo(() => {
    if (isLoading) return [];
    return [...saleReturns].sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime());
  }, [saleReturns, isLoading]);
  
  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }
  
  const pageIsLoading = isLoading || isLoadingPermissions;

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
        <Card>
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
                    <TableHead className="text-center">عدد الأصناف</TableHead>
                    <TableHead className="text-center">قيمة المرتجع</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageIsLoading && [...Array(3)].map((_,i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 mx-auto"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 mx-auto"/></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto"/></TableCell>
                    </TableRow>
                  ))}
                  {!pageIsLoading && sortedReturns.map(sr => (
                    <TableRow key={sr.id}>
                      <TableCell className="font-mono text-right">{sr.returnCode}</TableCell>
                      <TableCell className="font-mono text-right">{sr.orderCode}</TableCell>
                      <TableCell className="text-center">{formatDate(sr.returnDate)}</TableCell>
                      <TableCell className="text-center">{sr.items.length}</TableCell>
                      <TableCell className="font-mono text-center font-bold text-destructive">-{sr.refundAmount.toLocaleString()} ج.م</TableCell>
                       <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(sr)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                   {!pageIsLoading && sortedReturns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        لا توجد مرتجعات بيع مسجلة بعد.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
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
