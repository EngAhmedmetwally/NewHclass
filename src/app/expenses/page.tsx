
'use client';

import {
  MoreHorizontal,
  PlusCircle,
  FileText,
  DollarSign,
  User,
  Store,
  Calendar,
  Filter,
  Search,
  Tags,
  LayoutGrid,
  Wallet,
  Clock,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { AddExpenseDialog, DEFAULT_EXPENSE_CATEGORIES } from '@/components/add-expense-dialog';
import { DeleteExpenseDialog } from '@/components/delete-expense-dialog';
import { ManageExpenseCategoriesDialog } from '@/components/manage-expense-categories-dialog';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Expense, Treasury, Shift } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import { useMemo, useState } from 'react';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const requiredPermissions = ['expenses:add', 'expenses:edit', 'expenses:delete'] as const;

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  return format(new Date(dateString), 'd MMMM yyyy, h:mm a');
}

function ExpensesPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { data: allExpenses, isLoading: isLoadingExpenses, error } = useRtdbList<Expense>('expenses');
  const { data: treasuries, isLoading: isLoadingTreasuries } = useRtdbList<Treasury>('treasuries');
  const { data: shifts, isLoading: isLoadingShifts } = useRtdbList<Shift>('shifts');
  const { data: customCategories } = useRtdbList<{name: string}>('expenseCategories');
  const { appUser } = useUser();
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  const allAvailableCategories = useMemo(() => {
      const customOnes = customCategories.map(c => c.name);
      return Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customOnes]));
  }, [customCategories]);

  const filteredExpenses = useMemo(() => {
    if (!appUser || isLoadingExpenses) return [];
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    let filtered = allExpenses;

    // CRITICAL: Filter out "Sale Returns"
    filtered = filtered.filter(e => e.category !== 'مرتجعات بيع' && e.category !== 'مرتجع بيع');

    // Branch authorization check
    const isInclusiveUser = appUser.permissions.includes('all') || appUser.branchId === 'all';
    if (!isInclusiveUser && appUser.branchId) {
      filtered = filtered.filter(e => e.branchId === appUser.branchId);
    }

    // Date Filtering
    filtered = filtered.filter(e => {
      const expDate = new Date(e.date);
      return (!start || expDate >= start) && (!end || expDate <= end);
    });

    // Description Search
    if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(e => 
            e.description?.toLowerCase().includes(q) || 
            e.userName?.toLowerCase().includes(q) ||
            e.notes?.toLowerCase().includes(q)
        );
    }

    // Category Filter
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(e => e.category === categoryFilter);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allExpenses, appUser, isLoadingExpenses, fromDate, toDate, searchTerm, categoryFilter]);

  const totalAmount = useMemo(() => {
      return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);
  
  const pageIsLoading = isLoadingExpenses || isLoadingPermissions || isLoadingTreasuries || isLoadingShifts;

  const getSourceDisplay = (expense: Expense) => {
      if (expense.treasuryId) {
          const tName = treasuries.find(t => t.id === expense.treasuryId)?.name || 'خزينة';
          return (
              <div className="flex items-center gap-1.5 justify-center text-primary font-medium">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="text-xs">{tName}</span>
              </div>
          );
      }
      
      const shift = shifts.find(s => s.id === expense.shiftId);
      const shiftCode = shift?.shiftCode || (expense.shiftId ? expense.shiftId.slice(-4).toUpperCase() : '');

      return (
          <div className="flex flex-col items-center gap-0.5 justify-center text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">الوردية</span>
              </div>
              {shiftCode && (
                  <span className="text-[10px] font-mono font-bold text-primary flex items-center gap-0.5">
                      <Hash className="h-2.5 w-2.5" /> {shiftCode}
                  </span>
              )}
          </div>
      );
  };

  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }
  
  const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
          {filteredExpenses.map((expense) => (
              <Card key={expense.id}>
                  <CardHeader>
                      <div className="flex items-start justify-between">
                          <div className="text-right">
                            <CardTitle className="text-base">{expense.description}</CardTitle>
                            <CardDescription className="text-xs">{formatDate(expense.date)}</CardDescription>
                          </div>
                           <p className="font-mono font-bold text-lg text-destructive">-{expense.amount.toLocaleString()}</p>
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><FileText className="h-4 w-4"/> الفئة</span>
                          <Badge variant="outline">{expense.category}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1"><Wallet className="h-4 w-4"/> المصدر</span>
                          <span>{getSourceDisplay(expense)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Store className="h-4 w-4"/> الفرع</span>
                          <span>{expense.branchName}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><User className="h-4 w-4"/> المسجل</span>
                          <span>{expense.userName}</span>
                      </div>
                  </CardContent>
                  {(permissions.canExpensesEdit || permissions.canExpensesDelete) && (
                    <CardContent className="pt-0 flex gap-2">
                        {permissions.canExpensesEdit && (
                            <AddExpenseDialog expense={expense} trigger={
                                <Button variant="outline" size="sm" className="flex-1">تعديل</Button>
                            } />
                        )}
                        {permissions.canExpensesDelete && (
                            <DeleteExpenseDialog expense={expense} trigger={
                                <Button variant="ghost" size="sm" className="flex-1 text-destructive">حذف</Button>
                            } />
                        )}
                    </CardContent>
                  )}
              </Card>
          ))}
      </div>
  );
  
  const renderDesktopTable = () => (
       <Card className="hidden md:block">
        <CardHeader className="text-right">
          <CardTitle>سجل المصروفات التفصيلي</CardTitle>
          <CardDescription>
            قائمة بجميع المصروفات والنفقات المسجلة بناءً على الفلاتر المختارة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ والوقت</TableHead>
                <TableHead className="text-right">الوصف</TableHead>
                <TableHead className="text-center">الفئة</TableHead>
                <TableHead className="text-center">المصدر</TableHead>
                <TableHead className="text-center">الفرع</TableHead>
                <TableHead className="text-center">المسجل بواسطة</TableHead>
                <TableHead className="text-center">المبلغ</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-right font-mono text-xs">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell className="font-medium text-right">{expense.description}</TableCell>
                   <TableCell className="text-center">
                    <Badge variant="outline">{expense.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {getSourceDisplay(expense)}
                  </TableCell>
                   <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                        <span>{expense.branchName}</span>
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center gap-2 justify-center">
                        <span>{expense.userName}</span>
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-destructive">
                    -{expense.amount.toLocaleString()} ج.م
                  </TableCell>
                  <TableCell className="text-center">
                    {(permissions.canExpensesEdit || permissions.canExpensesDelete) && (
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
                        <DropdownMenuContent align="end" className="text-right">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            {permissions.canExpensesEdit && (
                                <AddExpenseDialog expense={expense} trigger={
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>تعديل</DropdownMenuItem>
                                } />
                            )}
                            {permissions.canExpensesDelete && (
                                <DeleteExpenseDialog expense={expense} trigger={
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">حذف</DropdownMenuItem>
                                } />
                            )}
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
            {[...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-20 w-full" /></CardHeader></Card>)}
        </div>
        <Card className="hidden md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right">التاريخ والوقت</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-center">الفئة</TableHead>
                        <TableHead className="text-center">المصدر</TableHead>
                        <TableHead className="text-center">الفرع</TableHead>
                        <TableHead className="text-center">المسجل بواسطة</TableHead>
                        <TableHead className="text-center">المبلغ</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell className="flex justify-center"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
      </>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="المصروفات" showBackButton>
        <div className="flex items-center gap-2">
            <ManageExpenseCategoriesDialog />
            {permissions.canExpensesAdd && <AddExpenseDialog />}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-3">
            <CardHeader className="pb-3 text-right">
                <div className="flex items-center gap-2 justify-end">
                    <CardTitle className="text-lg">تصفية المصروفات</CardTitle>
                    <Filter className="h-5 w-5" />
                </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
                <div className="flex flex-col gap-2">
                    <Label>بحث بالبيان</Label>
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="اكتب للبحث..." 
                            className="pr-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>الفئة</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger><SelectValue placeholder="كل الفئات" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الفئات</SelectItem>
                            {allAvailableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>من تاريخ</Label>
                    <DatePickerDialog
                        value={fromDate}
                        onValueChange={setFromDate}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>إلى تاريخ</Label>
                    <DatePickerDialog
                        value={toDate}
                        onValueChange={setToDate}
                        fromDate={fromDate}
                    />
                </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 justify-end">
                    <CardTitle className="text-sm font-medium">إجمالي المصروفات (للفلتر)</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
              </CardHeader>
              <CardContent className="flex items-center justify-center pt-2">
                  <p className="text-3xl font-black font-mono text-primary">
                      {totalAmount.toLocaleString()}
                      <span className="text-xs mr-1 font-normal text-muted-foreground">ج.م</span>
                  </p>
              </CardContent>
          </Card>
      </div>
      
      {pageIsLoading ? renderLoadingState() : (
        filteredExpenses.length === 0 ? (
            <Card>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>لا توجد مصروفات تطابق معايير البحث.</p>
                {permissions.canExpensesAdd && <AddExpenseDialog />}
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

export default function ExpensesPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <ExpensesPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
