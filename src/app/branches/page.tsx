'use client';

import { MoreHorizontal, Phone, PlusCircle, ArrowRight } from 'lucide-react';
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
import { AddBranchDialog } from '@/components/add-branch-dialog';
import { useState, useEffect } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Branch } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteBranchDialog } from '@/components/delete-branch-dialog';
import { WhatsappIcon } from '@/components/icons';
import { AuthLayout } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const requiredPermissions = ['branches:add', 'branches:edit', 'branches:delete'] as const;

function BranchesPageContent() {
    const router = useRouter();
    const { data: branches, isLoading, error } = useRtdbList<Branch>('branches');
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    const { toast } = useToast();
    
    const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>(undefined);
    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Aggressive cleanup for dialogs
    useEffect(() => {
      if (!isAddEditDialogOpen && !isDeleteDialogOpen) {
        const cleanup = () => {
          document.body.style.pointerEvents = 'auto';
          document.body.style.overflow = '';
          document.body.classList.remove('pointer-events-none');
        };
        const timer1 = setTimeout(cleanup, 100);
        const timer2 = setTimeout(cleanup, 500);
        return () => { clearTimeout(timer1); clearTimeout(timer2); };
      }
    }, [isAddEditDialogOpen, isDeleteDialogOpen]);

    // Secret mechanism states
    const [showAddButton, setShowAddButton] = useState(false);
    const [clickCount, setClickCount] = useState(0);

    const handleTitleClick = () => {
        const newCount = clickCount + 1;
        setClickCount(newCount);

        if (newCount >= 15) {
            const password = prompt("الرجاء إدخال كلمة المرور:");
            if (password === "metoomar") {
                setShowAddButton(true);
                toast({ title: "تم تفعيل وضع إضافة فرع." });
            } else if (password !== null) { // Check for null to avoid toast on cancel
                toast({ variant: "destructive", title: "كلمة مرور خاطئة." });
            }
            setClickCount(0); // Reset count after attempt
        }
    };

    const openEditDialog = (branch: Branch) => {
        setSelectedBranch(branch);
        // Decoupling delay
        setTimeout(() => setIsAddEditDialogOpen(true), 50);
    }
    
    const openDeleteDialog = (branch: Branch) => {
        setSelectedBranch(branch);
        // Decoupling delay
        setTimeout(() => setIsDeleteDialogOpen(true), 50);
    }
    
    const openNewDialog = () => {
        setSelectedBranch(undefined);
        setIsAddEditDialogOpen(true);
    }

    if (error) {
        return <div className="text-red-500">حدث خطأ: {error.message}</div>
    }
    
    const pageIsLoading = isLoading || isLoadingPermissions;

    const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
        {branches.map((branch) => (
            <Card key={branch.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-headline">{branch.name}</CardTitle>
                    {(permissions.canBranchesEdit || permissions.canBranchesDelete) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                {permissions.canBranchesEdit && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditDialog(branch); }}>تعديل</DropdownMenuItem>}
                                {permissions.canBranchesDelete && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDeleteDialog(branch); }} className="text-destructive">حذف</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">{branch.address}</p>
                    <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-mono">{branch.phoneNumber}</span></div>
                    {branch.whatsappNumber && <div className="flex items-center gap-2" dir="ltr"><WhatsappIcon className="h-4 w-4 text-green-500" /><span className="font-mono">{branch.whatsappNumber}</span></div>}
                    {branch.notes && <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{branch.notes}</p>}
                </CardContent>
            </Card>
        ))}
      </div>
    );

    const renderDesktopTable = () => (
        <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">العنوان</TableHead><TableHead className="text-center">الهاتف</TableHead><TableHead className="text-center">واتساب</TableHead><TableHead className="text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {branches.map((branch) => (
                            <TableRow key={branch.id}>
                                <TableCell className="font-medium text-right">{branch.name}</TableCell>
                                <TableCell className="text-right">{branch.address}</TableCell>
                                <TableCell dir="ltr" className="text-center font-mono">{branch.phoneNumber}</TableCell>
                                <TableCell dir="ltr" className="text-center font-mono">{branch.whatsappNumber || '-'}</TableCell>
                                <TableCell className="text-center">
                                    {(permissions.canBranchesEdit || permissions.canBranchesDelete) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                {permissions.canBranchesEdit && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditDialog(branch); }}>تعديل</DropdownMenuItem>}
                                                {permissions.canBranchesDelete && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDeleteDialog(branch); }} className="text-destructive">حذف</DropdownMenuItem>}
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
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                        <CardContent className="flex flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent>
                    </Card>
                ))}
            </div>
            <Card className="hidden md:block">
                <Table>
                    <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">العنوان</TableHead><TableHead className="text-center">الهاتف</TableHead><TableHead className="text-center">واتساب</TableHead><TableHead className="text-center">الإجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i}><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell><TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell><TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell></TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </>
    );

    return (
        <>
            <AddBranchDialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen} branch={selectedBranch} />
            <DeleteBranchDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} branch={selectedBranch} />

            <div className="flex flex-col gap-8">
                {/* Re-created PageHeader manually to isolate click handlers */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                         <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => router.back()}
                        >
                            <ArrowRight className="h-4 w-4" />
                            <span className="sr-only">الرجوع</span>
                        </Button>
                        <h1 onClick={handleTitleClick} className="font-headline text-2xl font-bold tracking-tight md:text-3xl cursor-pointer select-none">
                            الفروع
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {(showAddButton && permissions.canBranchesAdd) && (
                            <Button size="sm" className="gap-1" onClick={openNewDialog}>
                                <PlusCircle className="h-4 w-4" />
                                أضف فرع
                            </Button>
                        )}
                    </div>
                </div>
                
                {pageIsLoading ? renderLoadingState() : (
                    branches.length === 0 ? (
                        <Card>
                            <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <p>لا توجد فروع بعد.</p>
                                {(showAddButton && permissions.canBranchesAdd) && (
                                    <Button size="sm" className="gap-1" onClick={openNewDialog}>
                                        <PlusCircle className="h-4 w-4" />
                                        أضف فرع
                                    </Button>
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
        </>
    );
}

export default function BranchesPage() {
    return (
        <AuthLayout>
            <BranchesPageContent />
        </AuthLayout>
    )
}