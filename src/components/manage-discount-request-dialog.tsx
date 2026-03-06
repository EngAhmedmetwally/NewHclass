
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DiscountRequest, Order, Shift } from '@/lib/definitions';
import { useDatabase, useUser } from '@/firebase';
import { ref, get, update, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRtdbList } from '@/hooks/use-rtdb';

type ManageDiscountRequestDialogProps = {
  request?: DiscountRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ManageDiscountRequestDialog({ request, open, onOpenChange }: ManageDiscountRequestDialogProps) {
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  const { permissions } = usePermissions(['discount-requests:process'] as const);
  const { data: shifts } = useRtdbList<Shift>('shifts');

  const [approvedAmount, setApprovedAmount] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (request) {
      setApprovedAmount(0);
      setRejectionReason('');
    }
  }, [request]);

  const handleApprove = async () => {
    if (!request || !appUser || approvedAmount <= 0 || approvedAmount > request.orderTotal) {
      toast({ variant: 'destructive', title: 'مبلغ غير صالح', description: 'الرجاء إدخال قيمة خصم صالحة.' });
      return;
    }
    
    const openShift = shifts.find(s => s.cashier.id === appUser.id && !s.endTime);
    if (!openShift) {
        toast({
            variant: 'destructive',
            title: 'لا توجد وردية مفتوحة',
            description: 'يجب أن يكون لديك وردية مفتوحة للموافقة على الخصومات.',
        });
        return;
    }

    const requestRef = ref(db, `discountRequests/${request.id}`);
    const orderRef = ref(db, `daily-entries/${request.orderDate}/orders/${request.orderId}`);

    try {
      const orderSnapshot = await get(orderRef);
      if (!orderSnapshot.exists()) {
        throw new Error('لم يتم العثور على الطلب الأصلي.');
      }
      const currentOrder: Order = orderSnapshot.val();
      
      const approvalDate = new Date().toISOString();

      // 1. Update request
      await update(requestRef, {
        status: 'approved',
        discountAmount: approvedAmount,
        approvedByUserId: appUser.id,
        approvedByUserName: appUser.fullName,
        approvalDate: approvalDate,
      });

      // 2. Update order
      const subtotal = currentOrder.items.reduce((acc, item) => acc + (item.priceAtTimeOfOrder * item.quantity), 0);
      const newTotal = subtotal - approvedAmount;
      const newRemaining = newTotal - currentOrder.paid;

      await update(orderRef, {
        discountAmount: approvedAmount,
        discountAppliedDate: approvalDate,
        total: newTotal,
        remainingAmount: newRemaining,
        discountRequestStatus: 'approved',
        notes: (currentOrder.notes || '') + `\n[خصم] تمت الموافقة على خصم بقيمة ${approvedAmount.toLocaleString()} بواسطة ${appUser.fullName}.`
      });

      // 3. Update shift with discount amount
      const shiftRef = ref(db, `shifts/${openShift.id}`);
      await runTransaction(shiftRef, (currentShift: Shift) => {
        if (currentShift) {
          currentShift.discounts = (currentShift.discounts || 0) + approvedAmount;
        }
        return currentShift;
      });

      toast({ title: 'تمت الموافقة على الخصم بنجاح' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    }
  };

  const handleReject = async () => {
    if (!request || !appUser) return;
    
    const requestRef = ref(db, `discountRequests/${request.id}`);
    const orderRef = ref(db, `daily-entries/${request.orderDate}/orders/${request.orderId}`);

    try {
       await update(requestRef, {
        status: 'rejected',
        rejectionReason: rejectionReason,
        approvedByUserId: appUser.id,
        approvedByUserName: appUser.fullName,
        approvalDate: new Date().toISOString(),
      });
      
      await update(orderRef, { discountRequestStatus: 'rejected' });
      
      toast({ title: 'تم رفض طلب الخصم' });
      onOpenChange(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    }
  };

  if (!permissions.canDiscountRequestsProcess) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>معالجة طلب الخصم - {request?.orderCode}</DialogTitle>
          <DialogDescription>
            مراجعة الطلب والموافقة عليه مع تحديد قيمة الخصم أو رفضه.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle>تفاصيل الطلب</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">مقدم الطلب:</span>
                        <span>{request?.requestedByUserName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">إجمالي الطلب:</span>
                        <span className="font-mono font-semibold">{(request?.orderTotal || 0).toLocaleString()} ج.م</span>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="approve">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="approve">موافقة</TabsTrigger>
                    <TabsTrigger value="reject">رفض</TabsTrigger>
                </TabsList>
                <TabsContent value="approve" className="mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="discount-amount">قيمة الخصم (ج.م)</Label>
                            <Input
                                id="discount-amount"
                                type="number"
                                value={approvedAmount}
                                onChange={(e) => setApprovedAmount(Number(e.target.value))}
                                placeholder="أدخل قيمة الخصم"
                            />
                        </div>
                         <Button onClick={handleApprove} className="w-full">تأكيد الموافقة وتطبيق الخصم</Button>
                    </div>
                </TabsContent>
                <TabsContent value="reject" className="mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason">سبب الرفض (اختياري)</Label>
                            <Textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="اكتب سبب رفض طلب الخصم..."
                            />
                        </div>
                        <Button onClick={handleReject} variant="destructive" className="w-full">تأكيد الرفض</Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
