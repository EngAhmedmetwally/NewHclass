
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
import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { Expense } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import { useMemo, useState } from 'react';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';

const requiredPermissions = ['expenses:add', 'expenses:edit', 'expenses:delete'] as const;

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  return format(new Date(dateString), 'd MMMM yyyy, h:mm a');
}

function ExpensesPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  
  const { data: allExpenses, isLoading: isLoadingExpenses, error } = useRtdbList<Expense>('expenses');
  const { appUser } = useUser();
  const { permissions, isLoading: isLoadingPermissions } = usePermissions(requiredPermissions);

  const expenses = useMemo(() => {
    if (!appUser || isLoadingExpenses) return [];
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    let filtered = allExpenses;

    const isSuperAdmin = appUser.permissions.includes('all');
    if (!isSuperAdmin) {
      filtered = filtered.filter(e => e.branchId === appUser.branchId);
    }

    return filtered.filter(e => {
      const expDate = new Date(e.date);
      return (!start || expDate >= start) && (!end || expDate <= end);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allExpenses, appUser, isLoadingExpenses, fromDate, toDate]);
  
  const pageIsLoading = isLoadingExpenses || isLoadingPermissions;

  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>
  }
  
  const renderMobileCards = () => (
      <div className="grid gap-4 md:hidden">
          {expenses.map((expense) => (
              <Card key={expense.id}>
                  <CardHeader>
                      <div className="flex items-start justify-between">
                          <div>
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
                        {permissions.canExpensesEdit && <Button variant="outline" size="sm" className="flex-1">تعديل</Button>}
                        {permissions.canExpensesDelete && <Button variant="ghost" size="sm" className="flex-1 text-destructive">حذف</Button>}
                    </CardContent>
                  )}
              </Card>
          ))}
      </div>
  );
  
  const renderDesktopTable = () => (
       <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>سجل المصروفات</CardTitle>
          <CardDescription>
            قائمة بجميع المصروفات والنفقات المسجلة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ والوقت</TableHead>
                <TableHead className="text-right">الوصف</TableHead>
                <TableHead className="text-center">الفئة</TableHead>
                <TableHead className="text-center">الفرع</TableHead>
                <TableHead className="text-center">المسجل بواسطة</TableHead>
                <TableHead className="text-center">المبلغ</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-right font-mono text-xs">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell className="font-medium text-right">{expense.description}</TableCell>
                   <TableCell className="text-center">
                    <Badge variant="outline">{expense.category}</Badge>
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
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            {permissions.canExpensesEdit && <DropdownMenuItem>تعديل</DropdownMenuItem>}
                            {permissions.canExpensesDelete && <DropdownMenuItem className="text-destructive">حذف</DropdownMenuItem>}
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
        {permissions.canExpensesAdd && <AddExpenseDialog />}
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle className="text-lg">تصفية المصروفات</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="flex flex-col gap-2 justify-end">
                <Button variant="outline" onClick={() => { setFromDate(startOfDay(new Date())); setToDate(endOfDay(new Date())); }}>
                    عرض مصروفات اليوم
                </Button>
            </div>
        </CardContent>
      </Card>
      
      {pageIsLoading ? renderLoadingState() : (
        expenses.length === 0 ? (
            <Card>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>لا توجد مصروفات مسجلة في هذه الفترة.</p>
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
