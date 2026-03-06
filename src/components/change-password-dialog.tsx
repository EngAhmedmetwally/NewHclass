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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDatabase, useUser } from "@/firebase";
import { ref, update } from 'firebase/database';
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/definitions";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle } from "lucide-react";

type ChangePasswordDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { appUser } = useUser();
  const db = useDatabase();
  const { toast } = useToast();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = async () => {
    setError(null);
    if (!appUser) {
        setError("User information not found.");
        return;
    }
    
    // 1. Validate current password
    if (appUser.password !== currentPassword) {
        setError("كلمة المرور الحالية غير صحيحة.");
        return;
    }
    
    // 2. Validate new password
    if (!newPassword || newPassword.length < 6) {
        setError("يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.");
        return;
    }

    // 3. Validate confirmation
    if (newPassword !== confirmPassword) {
        setError("كلمتا المرور الجديدتان غير متطابقتين.");
        return;
    }

    setIsLoading(true);
    try {
        const userRef = ref(db, `users/${appUser.id}`);
        await update(userRef, { 
            password: newPassword,
            updatedAt: new Date().toISOString(),
        });
        
        toast({ title: "تم تغيير كلمة المرور بنجاح" });
        onOpenChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch(e: any) {
        setError(e.message || "حدث خطأ أثناء تحديث كلمة المرور.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تغيير كلمة المرور</DialogTitle>
          <DialogDescription>
            قم بتحديث كلمة المرور الخاصة بك.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
            <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>خطأ</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={isLoading}>
            {isLoading ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
