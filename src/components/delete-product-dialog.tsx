"use client";

import { useState } from "react";
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
import { useDatabase } from "@/firebase";
import { ref, remove } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/lib/definitions";

type DeleteProductDialogProps = {
    product?: Product;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function DeleteProductDialog({ product, open, onOpenChange, onSuccess }: DeleteProductDialogProps) {
  const db = useDatabase();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);
    try {
      await remove(ref(db, `products/${product.id}`));
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف المنتج "${product.name}".`,
      });
      onOpenChange(false);
      if (onSuccess) {
          onSuccess();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message,
      });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيؤدي هذا الإجراء إلى حذف المنتج "{product?.name}" بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
                e.preventDefault();
                handleDelete();
            }} 
            className="bg-destructive hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? "جاري الحذف..." : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
