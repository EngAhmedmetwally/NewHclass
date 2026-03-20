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
  ArrowRight
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

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString()} ج.م`;

const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd MMM yyyy - hh:mm a', { locale: ar });
};

function TreasuriesPageContent() {
  const { data: treasuries, isLoading: isLoadingTreasuries } = useRtdbList<Treasury>('treasuries');
  const { data: branches } = useRtdbList<Branch>('branches');
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(['treasuries:add', 'treasuries:manage'] as const);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTreasury, setSelectedTreasury] = useState<Treasury | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [actionType, setActionType] = useState<'deposit' | 'withdrawal' | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);

  const isLoading = isLoadingTreasuries || isLoadingPermissions;

  const filteredTreasuries = useMemo(() => {
    return treasuries.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.branchName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [treasuries, searchTerm]);

  const totalBalance = useMemo(() => treasuries.reduce((sum, t) => sum + (t.balance || 0), 0), [treasuries]);

  const handleOpenAction = (treasury: Treasury, type: 'deposit' | 'withdrawal') => {
      setSelectedTreasury(treasury);
      setActionType(type);
      setIsActionOpen(true);
  };

  const handleViewTransactions = (treasury: Treasury) => {
      setSelectedTreasury(treasury);
  };

  const currentTransactions = useMemo(() => {
      if (!selectedTreasury?.transactions) return [];
      return Object.values(selectedTreasury.transactions).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedTreasury]);

  return (
    <div className="flex flex-col gap-8">
      <ManageTreasuryDialog open={isManageOpen} onOpenChange={setIsManageOpen} />
      <TreasuryActionDialog 
        open={isActionOpen} 
        onOpenChange={setIsActionOpen} 
        treasury={selectedTreasury} 
        type={actionType || 'deposit'} 
      />

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
              <h3 className="font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-primary"/> قائمة الخزائن</h3>
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
                            "cursor-pointer transition-all hover:shadow-md border-r-4", 
                            selectedTreasury?.id === t.id ? "border-r-primary bg-primary/5" : "border-r-muted"
                        )}
                        onClick={() => handleViewTransactions(t)}
                      >
                          <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                  <CardTitle className="text-lg">{t.name}</CardTitle>
                                  <Badge variant="outline">{t.branchName}</Badge>
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
                  <h3 className="font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary"/> سجل حركات {selectedTreasury ? `خزينة ${selectedTreasury.name}` : 'الخزائن'}</h3>
                  {selectedTreasury && <Button variant="ghost" size="sm" onClick={() => setSelectedTreasury(null)}>عرض الكل</Button>}
              </div>
              <Card>
                  <CardContent className="p-0 overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="text-right">التاريخ والوقت</TableHead>
                                  <TableHead className="text-right">البيان</TableHead>
                                  <TableHead className="text-center">النوع</TableHead>
                                  <TableHead className="text-center">المبلغ</TableHead>
                                  <TableHead className="text-center">بواسطة</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {isLoading ? (
                                  [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                              ) : !selectedTreasury ? (
                                  <TableRow>
                                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground flex items-center justify-center flex-col gap-2">
                                          <ArrowRight className="h-8 w-8 opacity-20 rotate-180" />
                                          اضغط على خزينة من القائمة الجانبية لعرض سجل حركاتها بالتفصيل.
                                      </TableCell>
                                  </TableRow>
                              ) : currentTransactions.length === 0 ? (
                                  <TableRow>
                                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">لا توجد حركات مسجلة لهذه الخزينة بعد.</TableCell>
                                  </TableRow>
                              ) : (
                                  currentTransactions.map(tx => (
                                      <TableRow key={tx.id}>
                                          <TableCell className="text-right text-[10px] font-mono">{formatDate(tx.date)}</TableCell>
                                          <TableCell className="text-right text-sm">
                                              <p className="font-medium">{tx.description}</p>
                                              {tx.notes && <p className="text-[10px] text-muted-foreground">{tx.notes}</p>}
                                          </TableCell>
                                          <TableCell className="text-center">
                                              {tx.type === 'deposit' && <Badge className="bg-green-100 text-green-800 border-green-200">إيداع</Badge>}
                                              {tx.type === 'withdrawal' && <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">سحب</Badge>}
                                              {tx.type === 'expense' && <Badge variant="outline" className="text-destructive border-destructive/30">مصروف</Badge>}
                                          </TableCell>
                                          <TableCell className={cn("text-center font-bold font-mono", tx.type === 'deposit' ? 'text-green-600' : 'text-destructive')}>
                                              {tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}
                                          </TableCell>
                                          <TableCell className="text-center text-xs">{tx.userName}</TableCell>
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