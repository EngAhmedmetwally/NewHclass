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
import { AddCustomerDialog } from '@/components/add-customer-dialog';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useMemo } from 'react';
import type { Customer } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { useRtdbList } from '@/hooks/use-rtdb';
import { AuthLayout } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';

const requiredPermissions = ['customers:add', 'customers:edit', 'customers:delete'] as const;

function CustomersPageContent() {
    const { data: customers, isLoading, error } = useRtdbList<Customer>('customers');
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

    /**
     * AGGRESSIVE CLEANUP: 
     * This fixes the "frozen screen" issue where Radix UI leaves 'pointer-events: none' on the body.
     */
    useEffect(() => {
      if (!isAddCustomerOpen) {
        const cleanup = () => {
          document.body.style.pointerEvents = 'auto';
          document.body.style.overflow = '';
          document.body.classList.remove('pointer-events-none');
        };
        const timer1 = setTimeout(cleanup, 100);
        const timer2 = setTimeout(cleanup, 500);
        return () => { clearTimeout(timer1); clearTimeout(timer2); };
      }
    }, [isAddCustomerOpen]);

    if (error) {
        return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }

    const pageIsLoading = isLoading || isLoadingPermissions;
    
    const renderMobileCards = () => (
        <div className="grid gap-4 md:hidden">
            {customers.map((customer) => (
            <Card key={customer.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-headline text-lg">{customer.name}</CardTitle>
                 {(permissions.canCustomersEdit || permissions.canCustomersDelete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            {permissions.canCustomersEdit && <DropdownMenuItem>تعديل</DropdownMenuItem>}
                            {permissions.canCustomersDelete && <DropdownMenuItem>حذف</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-mono">{customer.primaryPhone}</span></div>
                {customer.secondaryPhone && (<div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-mono">{customer.secondaryPhone}</span></div>)}
                </CardContent>
            </Card>
            ))}
        </div>
    );
    
    const renderDesktopTable = () => (
         <Card className="hidden md:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[40%] text-right">الاسم</TableHead><TableHead className="w-[25%] text-center">الهاتف الأساسي</TableHead><TableHead className="w-[25%] text-center">الهاتف الثانوي</TableHead><TableHead className="w-[10%] text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {customers.map((customer) => (
                        <TableRow key={customer.id}><TableCell className="font-medium text-right">{customer.name}</TableCell><TableCell dir="ltr" className="text-center font-mono">{customer.primaryPhone}</TableCell><TableCell dir="ltr" className="text-center font-mono">{customer.secondaryPhone || '-'}</TableCell>
                        <TableCell className="text-center">
                            {(permissions.canCustomersEdit || permissions.canCustomersDelete) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        {permissions.canCustomersEdit && <DropdownMenuItem>تعديل</DropdownMenuItem>}
                                        {permissions.canCustomersDelete && <DropdownMenuItem>حذف</DropdownMenuItem>}
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

    const renderLoadingState = () => (
        <>
            <div className="grid gap-4 md:hidden">
                {[...Array(8)].map((_, i) => (
                    <Card key={`skeleton-${i}`}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="flex flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
                ))}
            </div>
            <Card className="hidden md:block">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[40%] text-right">الاسم</TableHead><TableHead className="w-[25%] text-center">الهاتف الأساسي</TableHead><TableHead className="w-[25%] text-center">الهاتف الثانوي</TableHead><TableHead className="w-[10%] text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={`skeleton-${i}`}><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell><TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell></TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </>
    );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="العملاء" showBackButton>
        <div className="flex items-center gap-2">
            <Input
                type="search"
                placeholder="ابحث برقم الهاتف..."
                className="md:w-[300px]"
            />
            {permissions.canCustomersAdd && (
                <AddCustomerDialog 
                    open={isAddCustomerOpen}
                    onOpenChange={setIsAddCustomerOpen}
                />
            )}
        </div>
      </PageHeader>
      
      {pageIsLoading ? renderLoadingState() : (
        customers.length === 0 ? (
            <Card>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>لا يوجد عملاء بعد.</p>
                {permissions.canCustomersAdd && (
                    <AddCustomerDialog 
                        open={isAddCustomerOpen}
                        onOpenChange={setIsAddCustomerOpen}
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

export default function CustomersPage() {
    return (
        <AuthLayout>
            <CustomersPageContent />
        </AuthLayout>
    )
}