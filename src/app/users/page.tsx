'use client';

import { MoreHorizontal, User as UserIcon, Shield, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { AddUserDialog } from '@/components/add-user-dialog';
import { Input } from '@/components/ui/input';
import type { User, Branch } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthLayout } from '@/components/app-layout';
import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useUser } from '@/firebase';
import { DeleteUserDialog } from '@/components/delete-user-dialog';

const requiredPermissions = ['users:add', 'users:edit', 'users:delete'] as const;

function UsersPageContent() {
   const [isMounted, setIsMounted] = useState(false);
   const { data: users, isLoading: isLoadingUsers, error: usersError } = useRtdbList<User>('users');
   const { data: branches, isLoading: isLoadingBranches, error: branchesError } = useRtdbList<Branch>('branches');
   const { appUser } = useUser();
   const { permissions: initialPermissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);
   
   const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
   const [isAddUserOpen, setIsAddUserOpen] = useState(false);
   const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
   const [userToDelete, setUserToDelete] = useState<User | undefined>(undefined);

   useEffect(() => {
     setIsMounted(true);
   }, []);

   /**
    * SUPER AGGRESSIVE CLEANUP: 
    * This fixes the "frozen screen" issue where Radix UI leaves 'pointer-events: none' on the body.
    */
   useEffect(() => {
     if (!isAddUserOpen && !isDeleteUserOpen) {
       const cleanup = () => {
         // Re-enable interactions on the body
         document.body.style.pointerEvents = 'auto';
         document.body.style.overflow = '';
         
         // Remove Radix-specific classes if any
         document.body.classList.remove('pointer-events-none');
         
         // Find any stuck overlays and hide them
         document.querySelectorAll('[data-radix-portal]').forEach(el => {
            const overlay = el.querySelector('[data-radix-overlay]');
            if (overlay) (overlay as HTMLElement).style.pointerEvents = 'none';
         });
       };
       
       // Run multiple times to catch the end of transitions
       const timer1 = setTimeout(cleanup, 100);
       const timer2 = setTimeout(cleanup, 500);
       return () => {
         clearTimeout(timer1);
         clearTimeout(timer2);
       };
     }
   }, [isAddUserOpen, isDeleteUserOpen]);

   const isLoading = isLoadingUsers || isLoadingBranches || isLoadingPermissions;
   const error = usersError || branchesError;

   const permissions = useMemo(() => {
    if (appUser?.username === 'admin') {
      return { canUsersAdd: true, canUsersEdit: true, canUsersDelete: true };
    }
    return initialPermissions;
   }, [appUser, initialPermissions]);


   const handleOpenDialog = (user?: User) => {
       setSelectedUser(user);
       // Small delay to allow the DropdownMenu to finish its closing animation/logic
       // This is the CRITICAL fix for the Pointer Events issue
       setTimeout(() => setIsAddUserOpen(true), 50);
   };
   
   const handleOpenDeleteDialog = (user: User) => {
       setUserToDelete(user);
       setTimeout(() => setIsDeleteUserOpen(true), 50);
   };

   const getStatusBadge = (isActive: boolean) => {
    return isActive ? 
        <Badge className="bg-green-500 text-white">نشط</Badge>
      : <Badge variant="destructive">معطل</Badge>;
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId || branchId === 'all') return 'كل الفروع';
    return branches.find((b) => b.id === branchId)?.name || 'غير معروف';
  };

  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }

  const renderMobileCards = () => (
    <div className="grid gap-4 md:hidden">
      {isLoading && [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-24 w-full"/></CardHeader></Card>)}
      {!isLoading && users.map((user: User) => (
        <Card key={user.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{user.fullName}</CardTitle>
              <CardDescription>@{user.username}</CardDescription>
            </div>
             {user.username !== 'admin' && (permissions.canUsersEdit || permissions.canUsersDelete) && (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                    {permissions.canUsersEdit && (
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(user); }}>
                        تعديل
                      </DropdownMenuItem>
                    )}
                    {permissions.canUsersDelete && (
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDeleteDialog(user); }} className="text-destructive">
                        حذف
                      </DropdownMenuItem>
                    )}
                    </DropdownMenuContent>
                </DropdownMenu>
             )}
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
             <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Shield className="h-4 w-4"/> الدور</span>
                <span className="capitalize font-medium">{user.role}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Store className="h-4 w-4"/> الفرع</span>
                <span className="font-medium">{getBranchName(user.branchId)}</span>
            </div>
             <div className="flex justify-between">
                <span className="text-muted-foreground">الحالة</span>
                {getStatusBadge(user.isActive)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderDesktopTable = () => (
    <Card className="hidden md:block">
      <CardHeader>
        <CardTitle>قائمة المستخدمين</CardTitle>
        <CardDescription>
          إدارة البائعين والكاشيرات والمديرين.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px] text-right">الاسم الكامل</TableHead>
              <TableHead className="min-w-[150px] text-center">اسم المستخدم</TableHead>
              <TableHead className="text-center">الحالة</TableHead>
              <TableHead className="text-center">الدور</TableHead>
              <TableHead className="text-center">الفرع</TableHead>
              <TableHead className="text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading && [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 mx-auto rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                </TableRow>
            ))}
            {!isLoading && users.map((user: User) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-right">{user.fullName}</TableCell>
                <TableCell className="text-center font-mono">{user.username}</TableCell>
                <TableCell className="text-center">{getStatusBadge(user.isActive)}</TableCell>
                <TableCell className="text-center capitalize">{user.role}</TableCell>
                <TableCell className="text-center">{getBranchName(user.branchId)}</TableCell>
                <TableCell className="text-center">
                  {(permissions.canUsersEdit || permissions.canUsersDelete) && user.username !== 'admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                        {permissions.canUsersEdit && (
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(user); }}>
                            تعديل
                          </DropdownMenuItem>
                        )}
                        {permissions.canUsersDelete && (
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDeleteDialog(user); }} className="text-destructive">
                            حذف
                          </DropdownMenuItem>
                        )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  لا يوجد مستخدمون.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <AuthLayout>
      <AddUserDialog 
        user={selectedUser} 
        open={isAddUserOpen}
        onOpenChange={(val) => {
          setIsAddUserOpen(val);
          if (!val) setSelectedUser(undefined);
        }}
      />
      <DeleteUserDialog
        user={userToDelete}
        open={isDeleteUserOpen}
        onOpenChange={setIsDeleteUserOpen}
      />
      <div className="flex flex-col gap-8">
        <PageHeader title="المستخدمون" showBackButton>
           <div className="flex items-center gap-2">
              <Input
                  type="search"
                  placeholder="ابحث بالاسم..."
                  className="md:w-[300px]"
              />
              {permissions.canUsersAdd && (
                  <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                    إضافة مستخدم
                  </Button>
              )}
          </div>
        </PageHeader>
        
        {isMounted ? (
            <>
                {renderMobileCards()}
                {renderDesktopTable()}
            </>
        ) : <Skeleton className="h-96 w-full" />}

      </div>
    </AuthLayout>
  );
}

export default function UsersPage() {
    return (
        <UsersPageContent />
    )
}
