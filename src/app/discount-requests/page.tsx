
'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BadgePercent, Clock, User, Check, X, Eye, FileText } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import type { DiscountRequest } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { useUser } from '@/firebase';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ManageDiscountRequestDialog } from '@/components/manage-discount-request-dialog';
import { OrderDetailsDialog } from '@/components/order-details-dialog';

const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMMM yyyy, h:mm a', { locale: ar });
};

const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: ar });
}

function DiscountRequestsPageContent() {
  const { data: allRequests, isLoading, error } = useRtdbList<DiscountRequest>('discountRequests');
  const { appUser } = useUser();
  const [selectedRequest, setSelectedRequest] = useState<DiscountRequest | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { pending, processed } = useMemo(() => {
    if (isLoading || !appUser) return { pending: [], processed: [] };

    const userIsAdmin = appUser.permissions.includes('all');
    let requests = allRequests;
    
    // Filter by branch if user is not an admin with 'all' branch access
    if (!userIsAdmin && appUser.branchId !== 'all') {
        requests = allRequests.filter(r => r.branchId === appUser.branchId);
    }
    
    requests.sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

    const pending = requests.filter(r => r.status === 'pending');
    const processed = requests.filter(r => r.status !== 'pending');
    
    return { pending, processed };

  }, [allRequests, appUser, isLoading]);

  const handleOpenDialog = (request: DiscountRequest) => {
    setSelectedRequest(request);
    setIsDialogOpen(true);
  };
  
  if (error) {
    return <div className="text-red-500">حدث خطأ: {error.message}</div>;
  }

  const RequestCard = ({ request }: { request: DiscountRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono">{request.orderCode}</CardTitle>
          <div className="flex items-center gap-1">
             <OrderDetailsDialog orderId={request.orderId}>
                <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                </Button>
            </OrderDetailsDialog>
            <span className="text-sm text-muted-foreground">{formatTimeAgo(request.requestDate)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3"/> {request.requestedByUserName}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
            <span className="text-muted-foreground">إجمالي الطلب</span>
            <span className="font-mono font-semibold">{(request.orderTotal || 0).toLocaleString()} ج.م</span>
        </div>
         <div className="flex justify-between">
            <span className="text-muted-foreground">المبلغ المتبقي</span>
            <span className="font-mono font-semibold text-destructive">{(request.orderRemainingAmount || 0).toLocaleString()} ج.م</span>
        </div>
      </CardContent>
      <CardContent>
          {request.status === 'pending' ? (
              <Button className="w-full" onClick={() => handleOpenDialog(request)}>معالجة الطلب</Button>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-sm border-t pt-4 mt-4">
                {request.status === 'approved' ? (
                    <span className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4"/> تمت الموافقة</span>
                ) : (
                    <span className="flex items-center gap-2 text-destructive"><X className="h-4 w-4"/> تم الرفض</span>
                )}
                 {request.status === 'approved' && (
                    <div className="text-center">
                        <p className="text-muted-foreground">قيمة الخصم</p>
                        <p className="font-mono font-bold text-lg text-green-600">{(request.discountAmount || 0).toLocaleString()} ج.م</p>
                    </div>
                 )}
                <span className="text-muted-foreground text-xs">بواسطة {request.approvedByUserName}</span>
            </div>
          )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <ManageDiscountRequestDialog
        request={selectedRequest}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
      <div className="flex flex-col gap-8">
        <PageHeader title="طلبات الخصم" showBackButton />
        
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <CardTitle>الطلبات المعلقة</CardTitle>
                </div>
                <CardDescription>طلبات الخصم التي تنتظر الموافقة أو الرفض.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-24 w-full" /> : pending.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pending.map(req => <RequestCard key={req.id} request={req} />)}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-10">لا توجد طلبات خصم معلقة حاليًا.</div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>الطلبات التي تمت معالجتها</CardTitle>
                </div>
                <CardDescription>سجل بطلبات الخصم التي تمت الموافقة عليها أو رفضها.</CardDescription>
            </CardHeader>
             <CardContent>
                {isLoading ? <Skeleton className="h-24 w-full" /> : processed.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {processed.map(req => <RequestCard key={req.id} request={req} />)}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-10">لا توجد طلبات تمت معالجتها بعد.</div>
                )}
            </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DiscountRequestsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <DiscountRequestsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
