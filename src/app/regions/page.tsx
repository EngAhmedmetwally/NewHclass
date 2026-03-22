'use client';

import { MoreHorizontal, PlusCircle, MapPin, Trash2, Pencil } from 'lucide-react';
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
import { useState } from 'react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Region } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthLayout } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { useDatabase } from '@/firebase';
import { ref, remove } from 'firebase/database';
import { AddRegionDialog } from '@/components/add-region-dialog';
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

const requiredPermissions = ['regions:add', 'regions:edit', 'regions:delete'] as const;

function RegionsPageContent() {
    const db = useDatabase();
    const { toast } = useToast();
    const { data: regions, isLoading, error } = useRtdbList<Region>('regions');
    const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
    
    const [selectedRegion, setSelectedRegion] = useState<Region | undefined>(undefined);
    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const openEditDialog = (region: Region) => {
        setSelectedRegion(region);
        setIsAddEditDialogOpen(true);
    }
    
    const openDeleteDialog = (region: Region) => {
        setSelectedRegion(region);
        setIsDeleteDialogOpen(true);
    }
    
    const handleDelete = async () => {
        if (!selectedRegion || !db) return;
        try {
            await remove(ref(db, `regions/${selectedRegion.id}`));
            toast({ title: "تم حذف المنطقة بنجاح" });
            setIsDeleteDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "خطأ في الحذف", description: e.message });
        }
    };

    if (error) return <div className="text-red-500">حدث خطأ: {error.message}</div>
    
    const pageIsLoading = isLoading || isLoadingPermissions;

    return (
        <>
            <AddRegionDialog 
                open={isAddEditDialogOpen} 
                onOpenChange={setIsAddEditDialogOpen} 
                region={selectedRegion} 
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl" className="text-right">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف منطقة "{selectedRegion?.name}"؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex flex-col gap-8">
                <PageHeader title="إدارة المناطق" showBackButton>
                    {permissions.canRegionsAdd && (
                        <Button size="sm" className="gap-1" onClick={() => { setSelectedRegion(undefined); setIsAddEditDialogOpen(true); }}>
                            <PlusCircle className="h-4 w-4" />
                            إضافة منطقة
                        </Button>
                    )}
                </PageHeader>
                
                {pageIsLoading ? (
                    <Card><CardContent className="p-6"><Skeleton className="h-48 w-full"/></CardContent></Card>
                ) : regions.length === 0 ? (
                    <Card>
                        <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <MapPin className="h-10 w-10 opacity-20" />
                            <p>لا توجد مناطق مسجلة بعد.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">اسم المنطقة</TableHead>
                                        <TableHead className="text-center w-[150px]">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {regions.map((region) => (
                                        <TableRow key={region.id}>
                                            <TableCell className="font-medium text-right">{region.name}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-2">
                                                    {permissions.canRegionsEdit && (
                                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(region)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {permissions.canRegionsDelete && (
                                                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(region)} className="text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

export default function RegionsPage() {
    return (
        <AuthLayout>
            <RegionsPageContent />
        </AuthLayout>
    )
}
