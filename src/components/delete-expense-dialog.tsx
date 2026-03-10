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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDatabase } from "@/firebase";
import { ref, remove, runTransaction } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";
import type { Expense, Shift } from "@/lib/definitions";
import { Loader2 } from "lucide-react";

type DeleteExpenseDialogProps = {
    expense: Expense;
    trigger: React.ReactNode;
}

export function DeleteExpenseDialog({ expense, trigger }: DeleteExpenseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const db = useDatabase();
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      // 1. Update the associated shift first
      if (expense.shiftId) {
          const shiftRef = ref(db, `shifts/${expense.shiftId}`);
          await runTransaction(shiftRef, (currentShift: Shift) => {
              if (currentShift) {
                  currentShift.refunds = Math.max(0, (currentShift.refunds || 0) - expense.amount);
              }
              return currentShift;
          });
      }

      // 2. Remove the expense record
      await remove(ref(db, `expenses/${expense.id}`));
      
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف المصروف ورد مبلغه (${expense.amount.toLocaleString()} ج.م) إلى الوردية.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="text-right" dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>هل أنت متأكد من حذف هذا المصروف؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم حذف المصروف بشكل نهائي وسيتم تعديل رصيد الوردية المرتبطة به تلقائياً. لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isLoading}>إلغاء</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
                e.preventDefault();
                handleDelete();
            }} 
            className="bg-destructive hover:bg-destructive/90"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            حذف نهائي
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}