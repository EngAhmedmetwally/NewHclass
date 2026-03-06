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

export function AddProductGroupDialog() {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const db = useDatabase();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يمكن أن يكون اسم المجموعة فارغًا.",
      });
      return;
    }

    try {
      const newGroupRef = push(ref(db, 'productGroups'));
      await set(newGroupRef, {
        name: groupName,
        createdAt: new Date().toISOString()
      });

      toast({
        title: "تم الحفظ بنجاح",
        description: `تمت إضافة المجموعة "${groupName}".`,
      });
      setGroupName("");
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving product group:", error);
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message || "لم يتم حفظ المجموعة. يرجى المحاولة مرة أخرى.",
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
          <DialogTitle>إضافة مجموعة جديدة</DialogTitle>
          <DialogDescription>
            أدخل اسم المجموعة الجديدة ليتم إضافتها للقائمة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              اسم المجموعة
            </Label>
            <Input id="name" className="col-span-3" placeholder="مثال: فساتين سهرة" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>حفظ المجموعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
