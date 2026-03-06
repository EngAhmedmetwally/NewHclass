
'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import type { DiscountRequest } from '@/lib/definitions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BadgePercent, Filter, TrendingDown } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { Label } from '@/components/ui/label';
import { subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

function DiscountsReportPageContent() {
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const { data: discountRequests, isLoading } = useRtdbList<DiscountRequest>('discountRequests');

  const filteredData = useMemo(() => {
    if (isLoading) return { requests: [], totalDiscount: 0 };
    
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    const approvedRequests = discountRequests.filter(req => {
        if (req.status !== 'approved' || !req.approvalDate) return false;
        const approvalDate = parseISO(req.approvalDate);
        const dateMatch = (!start || approvalDate >= start) && (!end || approvalDate <= end);
        return dateMatch;
    }).sort((a, b) => parseISO(b.approvalDate!).getTime() - parseISO(a.approvalDate!).getTime());
    
    const totalDiscount = approvedRequests.reduce((sum, req) => sum + (req.discountAmount || 0), 0);

    return { requests: approvedRequests, totalDiscount };
  }, [discountRequests, isLoading, fromDate, toDate]);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), "d MMMM yyyy, h:mm a", { locale: ar });
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ج.م`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تقرير الخصومات المطبقة" showBackButton />
      
      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5"/>
                <CardTitle>فلترة البيانات</CardTitle>
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
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <CardTitle>إجمالي الخصومات</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-10 w-3/4" /> : (
                    <p className="text-3xl font-bold font-mono text-destructive">
                        {formatCurrency(filteredData.totalDiscount)}
                    </p>
                )}
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            <CardTitle>سجل الخصومات المعتمدة</CardTitle>
          </div>
           <CardDescription>
            قائمة بجميع الخصومات التي تمت الموافقة عليها وتطبيقها على الطلبات في الفترة المحددة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-center">تاريخ الموافقة</TableHead>
                <TableHead className="text-center">تمت الموافقة بواسطة</TableHead>
                <TableHead className="text-center">قيمة الخصم</TableHead>
                <TableHead className="text-center">إجمالي الطلب الأصلي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && filteredData.requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-mono text-right">{req.orderCode}</TableCell>
                  <TableCell className="text-center">{formatDate(req.approvalDate)}</TableCell>
                  <TableCell className="text-center">{req.approvedByUserName}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-green-600">{formatCurrency(req.discountAmount || 0)}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(req.orderTotal)}</TableCell>
                </TableRow>
              ))}
               {!isLoading && filteredData.requests.length === 0 && (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        لا توجد خصومات معتمدة في هذه الفترة.
                    </TableCell>
                </TableRow>
               )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
    </div>
  );
}


export default function DiscountsReport() {
    return (
        <AppLayout>
            <DiscountsReportPageContent />
        </AppLayout>
    )
}
