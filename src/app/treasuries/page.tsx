'use client';

import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  PlusCircle, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  Trash2, 
  Search,
  Landmark,
  ArrowRight,
  ListFilter,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { AuthLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Treasury, TreasuryTransaction, Branch } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { ManageTreasuryDialog } from '@/components/manage-treasury-dialog';
import { TreasuryActionDialog } from '@/components/treasury-action-dialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useDatabase } from '@/firebase';
import { ref, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
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

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString()} ج.م`;

const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd MMM yyyy - hh:mm a', { locale: ar });
};

function TreasuriesPageContent() {
  const db = useDatabase();
  const { toast } = useToast();
  const { data: treasuries, isLoading: isLoadingTreasuries } = useRtdbList<Treasury>('treasuries');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['treasuries:add', 'treasuries:manage', 'treasuries:delete'] as const);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [actionType, setActionType] = useState<'deposit' | 'withdrawal' | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  
  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [treasuryToDelete, setTreasuryToDelete] = useState<Treasury | null>(null);

  const isLoading = isLoadingTreasuries || isLoadingPermissions;

  const filteredTreasuries = useMemo(() => {
    return treasuries.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.branchName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [treasuries, searchTerm]);

  const activeTreasury = useMemo(() => 
    treasuries.find(t => t.id === selectedTreasuryId) || null
  , [treasuries, selectedTreasuryId]);

  const totalBalance = useMemo(() => treasuries.reduce((sum, t) => sum + (t.balance || 0), 0), [treasuries]);

  const handleOpenAction = (treasury: Treasury, type: 'deposit' | 'withdrawal') => {
      setSelectedTreasuryId(treasury.id);
      setActionType(type);
      setIsActionOpen(true);
  };

  const handleOpenDelete = (e: React.MouseEvent, treasury: Treasury) => {
      e.stopPropagation();
      setTreasuryToDelete(treasury);
      setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!treasuryToDelete || !db) return;
      setIsDeleting(true);
      try {
          await remove(ref(db, `treasuries/${treasuryToDelete.id}`));
          toast({ title: "تم حذف الخزينة بنجاح" });
          if (selectedTreasuryId === treasuryToDelete.id) {
              setSelectedTreasuryId(null);
          }
          setIsDeleteDialogOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: "خطأ في الحذف", description: e.message });
      } finally {
          setIsDeleting(false);
          setTreasuryToDelete(null);
      }
  };

  const currentTransactions = useMemo(() => {
      if (selectedTreasuryId && activeTreasury?.transactions) {
          return Object.values(activeTreasury.transactions)
            .map(tx => ({ ...tx, treasuryName: activeTreasury.name }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      
      // If no treasury selected, show combined log of all treasuries
      const allTx: (TreasuryTransaction & { treasuryName: string })[] = [];
      treasuries.forEach(t => {
          if (t.transactions) {
              Object.values(t.transactions).forEach(tx => {
                  allTx.push({ ...tx, treasuryName: t.name });
              });
          }
      });
      return allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedTreasuryId, activeTreasury, treasuries]);

  return (
    <div className="flex flex-col gap-8">
      <ManageTreasuryDialog open={isManageOpen} onOpenChange={setIsManageOpen} />
      <TreasuryActionDialog 
        open={isActionOpen} 
        onOpenChange={setIsActionOpen} 
        treasury={activeTreasury} 
        type={actionType || 'deposit'} 
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent dir="rtl" className="text-right">
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      تأكيد حذف الخزينة
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                      هل أنت متأكد من حذف الخزينة "{treasuryToDelete?.name}"؟ سيتم حذف كافة سجلات الحركات المرتبطة بها نهائياً. لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
                  <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }} className="bg-destructive" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Trash2 className="ml-2 h-4 w-4"/>}
                      تأكيد الحذف النهائي
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <PageHeader title="إدارة الخزائن" showBackButton>
        {permissions.canTreasuriesAdd && (
            <Button size="sm" className="gap-1" onClick={() => setIsManageOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                إضافة خزينة جديدة
            </Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      إجمالي الأرصدة بكافة الخزائن
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-bold font-mono text-primary">
                      {formatCurrency(totalBalance)}
                  </div>
              </CardContent>
          </Card>
          <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      بحث سريع في الخزائن
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <Input 
                    placeholder="ابحث باسم الخزينة أو الفرع..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </CardContent>
          </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Treasuries List */}
          <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-primary"/> قائمة الخزائن</h3>
                {selectedTreasuryId && <Button variant="ghost" size="sm" onClick={() => setSelectedTreasuryId(null)} className="h-8 text-xs gap-1"><ListFilter className="h-3 w-3"/> عرض الكل</Button>}
              </div>
              {isLoading ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
              ) : filteredTreasuries.length === 0 ? (
                  <Card className="border-dashed h-40 flex items-center justify-center text-muted-foreground">
                      لا توجد خزائن مطابقة للبحث.
                  </Card>
              ) : (
                  filteredTreasuries.map(t => (
                      <Card 
                        key={t.id} 
                        className={cn(
                            "cursor-pointer transition-all hover:shadow-md border-r-4 relative group", 
                            selectedTreasuryId === t.id ? "border-r-primary bg-primary/5" : "border-r-muted"
                        )}
                        onClick={() => setSelectedTreasuryId(t.id)}
                      >
                          {permissions.canTreasuriesDelete && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute left-2 top-2 h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleOpenDelete(e, t)}
                              >
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          )}
                          <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                  <CardTitle className="text-lg">{t.name}</CardTitle>
                                  <Badge variant="outline" className="text-[10px]">{t.branchName}</Badge>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <p className="text-2xl font-bold font-mono text-primary">{formatCurrency(t.balance || 0)}</p>
                          </CardContent>
                          {permissions.canTreasuriesManage && (
                              <CardFooter className="pt-0 gap-2">
                                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-green-600 border-green-200 hover:bg-green-50" onClick={(e) => { e.stopPropagation(); handleOpenAction(t, 'deposit'); }}>
                                      <ArrowUpCircle className="h-3 w-3" /> إيداع
                                  </Button>
                                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={(e) => { e.stopPropagation(); handleOpenAction(t, 'withdrawal'); }}>
                                      <ArrowDownCircle className="h-3 w-3" /> سحب
                                  </Button>
                              </CardFooter>
                          )}
                      </Card>
                  ))
              )}
          </div>

          {/* Transactions Log */}
          <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary"/> سجل حركات {selectedTreasuryId ? `خزينة ${activeTreasury?.name}` : 'كافة الخزائن'}</h3>
              </div>
              <Card>
                  <CardContent className="p-0 overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="text-right">التاريخ والوقت</TableHead>
                                  <TableHead className="text-right">البيان</TableHead>
                                  {!selectedTreasuryId && <TableHead className="text-center">الخزينة</TableHead>}
                                  <TableHead className="text-center">النوع</TableHead>
                                  <TableHead className="text-center">المبلغ</TableHead>
                                  <TableHead className="text-center">بواسطة</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {isLoading ? (
                                  [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                              ) : currentTransactions.length === 0 ? (
                                  <TableRow>
                                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">لا توجد حركات مسجلة بعد.</TableCell>
                                  </TableRow>
                              ) : (
                                  currentTransactions.map(tx => (
                                      <TableRow key={tx.id} className={cn(tx.description.includes('وردية') && "bg-primary/5")}>
                                          <TableCell className="text-right text-[10px] font-mono whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                                          <TableCell className="text-right text-sm">
                                              <p className="font-medium">{tx.description}</p>
                                              {tx.notes && <p className="text-[10px] text-muted-foreground">{tx.notes}</p>}
                                          </TableCell>
                                          {!selectedTreasuryId && <TableCell className="text-center text-xs font-bold">{tx.treasuryName}</TableCell>}
                                          <TableCell className="text-center">
                                              {tx.type === 'deposit' && <Badge className="bg-green-100 text-green-800 border-green-200">إيداع</Badge>}
                                              {tx.type === 'withdrawal' && <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">سحب</Badge>}
                                              {tx.type === 'expense' && <Badge variant="outline" className="text-destructive border-destructive/30">مصروف</Badge>}
                                          </TableCell>
                                          <TableCell className={cn("text-center font-bold font-mono", tx.amount > 0 ? 'text-green-600' : 'text-destructive')}>
                                              {tx.amount > 0 ? '+' : ''}{Math.round(tx.amount).toLocaleString()}
                                          </TableCell>
                                          <TableCell className="text-center text-xs whitespace-nowrap">{tx.userName}</TableCell>
                                      </TableRow>
                                  ))
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </div>
      </div>
    </div>
  );
}

export default function TreasuriesPage() {
    return (
        <AuthLayout>
            <AuthGuard>
                <TreasuriesPageContent />
            </AuthGuard>
        </AuthLayout>
    )
}