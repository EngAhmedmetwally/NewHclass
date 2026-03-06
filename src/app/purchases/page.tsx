

'use client';

import { MoreHorizontal, PlusCircle, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { useRtdbList } from '@/hooks/use-rtdb';
import type { PurchaseOrder } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { useState, useMemo } from 'react';
import { AddPurchaseDialog } from '@/components/add-purchase-dialog';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/use-permissions';

const requiredPermissions = ['purchases:add', 'purchases:edit', 'purchases:delete'] as const;

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
   if (isNaN(date.getTime())) {
      return '-'
  }
  return format(date, "d MMMM yyyy");
}

function PurchasesPageContent() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOrder | undefined>(undefined);
    const { data: purchases, isLoading, error } = useRtdbList<PurchaseOrder>('purchaseOrders');
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

    const handleOpenDialog = (purchase?: PurchaseOrder) => {
        setSelectedPurchase(purchase);
        setIsDialogOpen(true);
    };

    const sortedPurchases = useMemo(() => {
        return [...purchases].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    }, [purchases]);

    if (error) {
        return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }
    
    const pageIsLoading = isLoading || isLoadingPermissions;

    const renderMobileCards = () => (
        <div className="grid gap-4 md:hidden">
            {sortedPurchases.map(p => (
                <Card key={p.id}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="font-mono">{p.purchaseOrderCode}</CardTitle>
                            <div className="font-mono font-bold text-primary">{p.totalCost.toLocaleString()} ج.م</div>
                        </div>
                        <CardDescription>{formatDate(p.purchaseDate)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">المورد:</span>
                            <span className="font-medium">{p.supplierName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">عدد الأصناف:</span>
                            <span className="font-mono">{p.items.length}</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => handleOpenDialog(p)}>
                            <Eye className="h-4 w-4" />
                            عرض الفاتورة
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    const renderDesktopTable = () => (
         <Card className="hidden md:block">
            <CardHeader>
                <CardTitle>فواتير الشراء</CardTitle>
                <CardDescription>قائمة بجميع فواتير الشراء من الموردين.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">كود الفاتورة</TableHead>
                            <TableHead className="text-right">المورد</TableHead>
                            <TableHead className="text-center">التاريخ</TableHead>
                            <TableHead className="text-center">عدد الأصناف</TableHead>
                            <TableHead className="text-center">التكلفة الإجمالية</TableHead>
                            <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPurchases.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono text-right">{p.purchaseOrderCode}</TableCell>
                                <TableCell className="text-right">{p.supplierName}</TableCell>
                                <TableCell className="text-center">{formatDate(p.purchaseDate)}</TableCell>
                                <TableCell className="text-center font-mono">{p.items.length}</TableCell>
                                <TableCell className="text-center font-mono font-bold text-primary">{p.totalCost.toLocaleString()} ج.م</TableCell>
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)}>
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
        <>
            <div className="grid gap-4 md:hidden">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
                        <CardContent><Skeleton className="h-10 w-full" /></CardContent>
                        <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
            <Card className="hidden md:block">
                 <CardHeader>
                    <CardTitle><Skeleton className="h-7 w-48" /></CardTitle>
                    <Skeleton className="h-5 w-72" />
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                {[...Array(6)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
    );


  return (
    <>
    <AddPurchaseDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} purchaseOrder={selectedPurchase} />
    <div className="flex flex-col gap-8">
      <PageHeader title="المشتريات" showBackButton>
        {permissions.canPurchasesAdd && (
            <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-4 w-4" />
                إضافة فاتورة شراء
            </Button>
        )}
      </PageHeader>
       {pageIsLoading ? renderLoadingState() : (
            sortedPurchases.length === 0 ? (
                 <Card>
                    <CardHeader>
                        <CardTitle>فواتير الشراء</CardTitle>
                        <CardDescription>قائمة بجميع فواتير الشراء من الموردين.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-24 text-center text-muted-foreground flex items-center justify-center">
                            لم يتم تسجيل أي فواتير شراء بعد.
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


export default function PurchasesPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <PurchasesPageContent />
            </AuthGuard>
        </AppLayout>
    )
}

    

    