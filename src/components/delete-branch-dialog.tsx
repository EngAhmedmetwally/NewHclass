
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { Branch } from "@/lib/definitions";

type DeleteBranchDialogProps = {
    branch?: Branch;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteBranchDialog({ branch, open, onOpenChange }: DeleteBranchDialogProps) {
  const db = useDatabase();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!branch) return;
    try {
      await remove(ref(db, `branches/${branch.id}`));
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف فرع "${branch.name}".`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيؤدي هذا الإجراء إلى حذف فرع "{branch?.name}" بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
