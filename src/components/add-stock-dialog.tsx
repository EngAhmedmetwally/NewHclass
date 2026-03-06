
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
import { PlusCircle } from "lucide-react";
import type { Product, StockMovement } from "@/lib/definitions";
import { useDatabase, useUser } from "@/firebase";
import { ref, runTransaction, push, set } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "./ui/textarea";

type AddStockDialogProps = {
  product: Product;
};

export function AddStockDialog({ product }: AddStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const db = useDatabase();
  const { toast } = useToast();
  const { appUser } = useUser();

  const handleSave = async () => {
    if (quantity <= 0) {
      toast({
        variant: "destructive",
        title: "كمية غير صالحة",
        description: "الرجاء إدخال كمية أكبر من صفر.",
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
          const quantityAfter = quantityBefore + quantity;

          const newMovement: StockMovement = {
              id: movementRef.key!,
              date: new Date().toISOString(),
              type: 'addition',
              quantity: quantity,
              quantityBefore: quantityBefore,
              quantityAfter: quantityAfter,
              notes: notes || `إضافة يدوية للرصيد`,
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
        description: `تمت إضافة ${quantity} قطعة إلى مخزون المنتج "${product.name}".`,
      });
      setQuantity(1);
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
        <Button size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          إضافة كمية
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة مخزون للمنتج</DialogTitle>
          <DialogDescription>
            قم بإضافة كمية جديدة إلى المخزون الحالي للمنتج:{" "}
            <span className="font-bold">{product.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-stock" className="text-right">
              المخزون الحالي
            </Label>
            <Input
              id="current-stock"
              value={product.quantityInStock - product.quantityRented}
              readOnly
              className="col-span-3 bg-muted"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              الكمية المضافة
            </Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="col-span-3"
              min="1"
            />
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">
              ملاحظات
            </Label>
            <Textarea 
              id="notes" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3" 
              placeholder="سبب الإضافة (اختياري)..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "جاري الحفظ..." : "حفظ الكمية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
