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
import { Plus } from "lucide-react";
import { useDatabase } from "@/firebase";
import { ref, push, set } from "firebase/database";
import { useToast } from "@/hooks/use-toast";

export function AddSizeDialog() {
  const [open, setOpen] = useState(false);
  const [sizeName, setSizeName] = useState("");
  const db = useDatabase();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!sizeName.trim()) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يمكن أن يكون اسم المقاس فارغًا.",
      });
      return;
    }

    try {
      const newSizeRef = push(ref(db, 'sizes'));
      await set(newSizeRef, {
        name: sizeName,
        createdAt: new Date().toISOString()
      });

      toast({
        title: "تم الحفظ بنجاح",
        description: `تمت إضافة المقاس "${sizeName}".`,
      });
      setSizeName("");
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving size:", error);
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: "لم يتم حفظ المقاس. يرجى المحاولة مرة أخرى.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة مقاس جديد</DialogTitle>
          <DialogDescription>
            أدخل المقاس الجديد ليتم إضافته للقائمة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              المقاس
            </Label>
            <Input id="name" className="col-span-3" placeholder="مثال: 42 أو XXL" value={sizeName} onChange={(e) => setSizeName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>حفظ المقاس</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
