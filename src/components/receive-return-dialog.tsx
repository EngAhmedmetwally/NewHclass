"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, AlertTriangle, User } from "lucide-react";
import type { Order, Product, StockMovement } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, update, push, runTransaction } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type ReceiveReturnDialogProps = {
  order: Order;
  trigger: React.ReactNode;
};

export function ReceiveReturnDialog({ order, trigger }: ReceiveReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<"good" | "damaged">("good");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!db || !order.orderDate || !appUser) return;

    setIsLoading(true);
    try {
      const datePath = format(new Date(order.orderDate), 'yyyy-MM-dd');
      const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);

      // 1. Update each product stock and movements
      for (const item of order.items) {
        const productRef = ref(db, `products/${item.productId}`);
        await runTransaction(productRef, (currentProduct: Product) => {
          if (currentProduct) {
            const quantityBefore = currentProduct.quantityInStock || 0;
            currentProduct.quantityInStock = quantityBefore + item.quantity;
            currentProduct.quantityRented = Math.max(0, (currentProduct.quantityRented || 0) - item.quantity);

            // Add stock movement for rental return
            const movementRef = push(ref(db, `products/${item.productId}/stockMovements`));
            const newMovement: StockMovement = {
              id: movementRef.key!,
              date: new Date().toISOString(),
              type: 'rental_in',
              quantity: item.quantity,
              quantityBefore: quantityBefore,
              quantityAfter: currentProduct.quantityInStock,
              notes: `إرجاع من طلب ${order.orderCode} (الحالة: ${condition === 'good' ? 'جيد' : 'تالف'})`,
              orderCode: order.orderCode,
              userId: appUser.id,
              userName: appUser.fullName,
            };
            if (!currentProduct.stockMovements) {
              currentProduct.stockMovements = {};
            }
            currentProduct.stockMovements[newMovement.id] = newMovement;
          }
          return currentProduct;
        });
      }

      // 2. Format inspection log entry
      const timestamp = format(new Date(), 'dd/MM/yyyy hh:mm a');
      const conditionText = condition === "good" ? "جيد" : "تالف";
      const logEntry = `\n[فحص واستلام] [${timestamp}] بواسطة ${appUser.fullName}:\n- حالة المنتج: ${conditionText}\n- ملاحظات الفحص: ${notes || "لا يوجد"}`;

      // 3. Update order status and append notes
      await update(orderRef, {
        status: 'Returned',
        returnedAt: new Date().toISOString(),
        returnCondition: condition,
        returnNotes: notes,
        notes: (order.notes || "") + logEntry,
      });

      toast({
        title: "تم تأكيد الاستلام والفحص",
        description: `تم تحديث حالة الطلب ${order.orderCode} بنجاح وتسجيل تقرير الفحص.`,
      });
      
      setOpen(false);
      setNotes("");
      setCondition("good");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التحديث",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            فحص واستلام المرتجع - {order.orderCode}
          </DialogTitle>
          <DialogDescription>
            الرجاء فحص المنتج بعناية وتحديد حالته قبل تأكيد الاستلام.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Receiver Info */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-dashed">
            <User className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">الموظف القائم بالفحص</p>
              <p className="font-semibold">{appUser?.fullName}</p>
            </div>
          </div>

          {/* Condition Selection */}
          <div className="space-y-3">
            <Label className="text-base font-bold">حالة المنتج</Label>
            <RadioGroup 
              value={condition} 
              onValueChange={(v) => setCondition(v as any)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="good" id="cond-good" className="peer sr-only" />
                <Label
                  htmlFor="cond-good"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                  <CheckCircle2 className="mb-2 h-6 w-6 text-green-500" />
                  <span className="font-bold">جيد</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="damaged" id="cond-damaged" className="peer sr-only" />
                <Label
                  htmlFor="cond-damaged"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-destructive [&:has([data-state=checked])]:border-destructive cursor-pointer transition-all"
                >
                  <AlertTriangle className="mb-2 h-6 w-6 text-destructive" />
                  <span className="font-bold">تالف / يحتاج صيانة</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notes / Reasons */}
          <div className="space-y-2">
            <Label htmlFor="receive-notes">
              {condition === "damaged" ? "أسباب التلف / التفاصيل" : "ملاحظات إضافية (اختياري)"}
            </Label>
            <Textarea
              id="receive-notes"
              placeholder={condition === "damaged" ? "اذكر تفاصيل التلف هنا..." : "أضف أي ملاحظات عن حالة المنتج عند الاستلام..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            إلغاء
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || (condition === "damaged" && !notes.trim())}
            className={cn(condition === "damaged" ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700")}
          >
            {isLoading ? "جاري الحفظ..." : "تأكيد الاستلام النهائي"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}