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
import type { User } from "@/lib/definitions";

type DeleteUserDialogProps = {
    user?: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const db = useDatabase();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!user) return;
    try {
      await remove(ref(db, `users/${user.id}`));
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف المستخدم "${user.fullName}".`,
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
            سيؤدي هذا الإجراء إلى حذف المستخدم "{user?.fullName}" بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
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
