'use client';

import { MoreHorizontal, PlusCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useMemo } from 'react';
import type { Supplier } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { useRtdbList } from '@/hooks/use-rtdb';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { AddSupplierDialog } from '@/components/add-supplier-dialog';
import { usePermissions } from '@/hooks/use-permissions';

const requiredPermissions = ['suppliers:add', 'suppliers:edit', 'suppliers:delete'] as const;

function SuppliersPageContent() {
    const { data: suppliers, isLoading, error } = useRtdbList<Supplier>('suppliers');
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>(undefined);

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

    const handleOpenDialog = (supplier?: Supplier) => {
        setSelectedSupplier(supplier);
        setTimeout(() => setIsDialogOpen(true), 50);
    };
    
    const pageIsLoading = isLoading || isLoadingPermissions;

    if (error) {
        return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }
    
    const renderMobileCards = () => (
        <div className="grid gap-4 md:hidden">
            {suppliers.map((supplier) => (
            <Card key={supplier.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-headline text-lg">{supplier.name}</CardTitle>
                {(permissions.canSuppliersEdit || permissions.canSuppliersDelete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            {permissions.canSuppliersEdit && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(supplier); }}>تعديل</DropdownMenuItem>}
                            {permissions.canSuppliersDelete && <DropdownMenuItem className="text-destructive">حذف</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">{supplier.address}</p>
                    <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-mono">{supplier.phone}</span></div>
                </CardContent>
            </Card>
            ))}
        </div>
    );
    
    const renderDesktopTable = () => (
         <Card className="hidden md:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[30%] text-right">الاسم</TableHead><TableHead className="w-[40%] text-right">العنوان</TableHead><TableHead className="w-[20%] text-center">الهاتف</TableHead><TableHead className="w-[10%] text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {suppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                            <TableCell className="font-medium text-right">{supplier.name}</TableCell>
                            <TableCell className="text-right">{supplier.address}</TableCell>
                            <TableCell dir="ltr" className="text-center font-mono">{supplier.phone}</TableCell>
                        <TableCell className="text-center">
                            {(permissions.canSuppliersEdit || permissions.canSuppliersDelete) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        {permissions.canSuppliersEdit && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(supplier); }}>تعديل</DropdownMenuItem>}
                                        {permissions.canSuppliersDelete && <DropdownMenuItem>حذف</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );

  return (
    <>
    <AddSupplierDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} supplier={selectedSupplier} />
    <div className="flex flex-col gap-8">
      <PageHeader title="الموردون" showBackButton>
        <div className="flex items-center gap-2">
            <Input
                type="search"
                placeholder="ابحث بالاسم أو الهاتف..."
                className="md:w-[300px]"
            />
            {permissions.canSuppliersAdd && (
                <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                    <PlusCircle className="h-4 w-4" />
                    أضف مورد
                </Button>
            )}
        </div>
      </PageHeader>
      
        {pageIsLoading ? (
            <>
                <div className="grid gap-4 md:hidden">
                    {[...Array(8)].map((_, i) => (
                        <Card key={`skeleton-${i}`}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="flex flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
                    ))}
                </div>
                <Card className="hidden md:block">
                     <Table>
                        <TableHeader><TableRow><TableHead className="w-[30%] text-right">الاسم</TableHead><TableHead className="w-[40%] text-right">العنوان</TableHead><TableHead className="w-[20%] text-center">الهاتف</TableHead><TableHead className="w-[10%] text-center">الإجراءات</TableHead></TableRow></TableHeader>
                        <TableBody>
                         {[...Array(5)].map((_, i) => (
                             <TableRow key={`skeleton-${i}`}><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell><TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell></TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </Card>
            </>
        ) : suppliers.length === 0 ? (
            <Card>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>لا يوجد موردون بعد.</p>
                {permissions.canSuppliersAdd && (
                    <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                        <PlusCircle className="h-4 w-4" />
                        أضف مورد
                    </Button>
                )}
                </CardContent>
            </Card>
        ) : (
            <>
                {renderMobileCards()}
                {renderDesktopTable()}
            </>
        )}

    </div>
    </>
  );
}

export default function SuppliersPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <SuppliersPageContent />
            </AuthGuard>
        </AppLayout>
    )
}