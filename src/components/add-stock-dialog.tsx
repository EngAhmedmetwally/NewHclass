
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeftRight } from "lucide-react";
import type { Product, StockMovement } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, runTransaction, push } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "./ui/textarea";

type AddStockDialogProps = {
  product: Product;
};

export function AddStockDialog({ product }: AddStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [adjustment, setAdjustment] = useState(0);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const db = useDatabase();
  const { toast } = useToast();
  const { appUser } = useUser();

  const handleSave = async () => {
    if (adjustment === 0) {
      toast({
        variant: "destructive",
        title: "قيمة غير صالحة",
        description: "الرجاء إدخال قيمة تعديل (موجبة للإضافة أو سالبة للخصم).",
      });
      return;
    }
     if (!appUser) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لم يتم العثور على المستخدم الحالي.",
      });
      return;
    }

    setIsLoading(true);
    const productRef = ref(db, `products/${product.id}`);

    try {
      await runTransaction(productRef, (currentData) => {
        if (currentData) {
          const movementRef = push(ref(db, `products/${product.id}/stockMovements`));
          
          const quantityBefore = currentData.quantityInStock || 0;
          const quantityAfter = quantityBefore + adjustment;

          const newMovement: StockMovement = {
              id: movementRef.key!,
              date: new Date().toISOString(),
              type: 'edit', 
              quantity: adjustment,
              quantityBefore: quantityBefore,
              quantityAfter: quantityAfter,
              notes: notes || `تعديل يدوي للرصيد`,
              userId: appUser.id,
              userName: appUser.fullName,
          };
          
          currentData.quantityInStock = quantityAfter;
          
          if (!currentData.stockMovements) {
            currentData.stockMovements = {};
          }
          currentData.stockMovements[newMovement.id] = newMovement;
        }
        return currentData;
      });

      toast({
        title: "تم تحديث المخزون",
        description: `تم تعديل مخزون المنتج بنجاح. الرصيد الجديد: ${product.quantityInStock + adjustment}`,
      });
      setAdjustment(0);
      setNotes("");
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message || "فشل تحديث مخزون المنتج.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <ArrowLeftRight className="h-4 w-4" />
          تعديل الكمية
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل رصيد المخزون</DialogTitle>
          <DialogDescription className="text-right">
            قم بتعديل الكمية المتوفرة للمنتج: <span className="font-bold">{product.name}</span>.
            استخدم أرقاماً موجبة للإضافة وسالبة للخصم.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-stock" className="text-right">
              الرصيد الحالي
            </Label>
            <Input
              id="current-stock"
              value={product.quantityInStock}
              readOnly
              className="col-span-3 bg-muted text-center font-bold"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="adjustment" className="text-right">
              كمية التعديل
            </Label>
            <Input
              id="adjustment"
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
              className="col-span-3 text-center"
              placeholder="+/- الكمية"
            />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-xs text-muted-foreground">
              الرصيد الجديد المتوقع
            </Label>
            <div className="col-span-3 text-center font-mono font-bold text-primary text-lg">
                {product.quantityInStock + adjustment}
            </div>
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">
              سبب التعديل
            </Label>
            <Textarea 
              id="notes" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3" 
              placeholder="مثال: جرد مخزني، صنف تالف، خطأ في الإدخال السابق..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-start gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">إلغاء</Button>
          <Button onClick={handleSave} disabled={isLoading || adjustment === 0} className="w-full sm:w-auto">
            {isLoading ? "جاري الحفظ..." : "حفظ التعديل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
