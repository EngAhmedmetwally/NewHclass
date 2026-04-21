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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/lib/definitions";
import { useDatabase } from "@/firebase";
import { ref, update } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

type AddOrderNoteDialogProps = {
  order: Order;
  trigger: React.ReactNode;
};

export function AddOrderNoteDialog({ order, trigger }: AddOrderNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const db = useDatabase();
  const { toast } = useToast();

  const handleSaveNote = async () => {
    if (!note.trim() || !order.id) {
      toast({ variant: "destructive", title: "الملاحظة فارغة" });
      return;
    }

    try {
      // استخدام مسار التاريخ الموثوق المخزن في كائن الطلب
      const datePath = order.datePath || format(new Date(order.orderDate), 'yyyy-MM-dd');
      const orderRef = ref(db, `daily-entries/${datePath}/orders/${order.id}`);

      const newNote = `${order.notes || ''}\n[${new Date().toLocaleString('ar-EG')}] ${note}`;
      
      await update(orderRef, { notes: newNote });

      toast({
        title: "تم حفظ الملاحظة",
        description: "تمت إضافة ملاحظتك بنجاح إلى الطلب.",
      });
      setNote("");
      setOpen(false);
    } catch (error: any) {
      console.error("Note Save Error:", error);
      toast({
        variant: "destructive",
        title: "خطأ في الحفظ",
        description: error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة ملاحظة على الطلب {order.orderCode}</DialogTitle>
          <DialogDescription>
            أضف ملاحظة جديدة للطلب. ستظهر الملاحظات السابقة أدناه.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">ملاحظة جديدة</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              rows={4}
            />
          </div>
          {order.notes && (
            <div className="flex flex-col gap-2">
                <Label>الملاحظات السابقة</Label>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {order.notes}
                </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSaveNote}>
            حفظ الملاحظة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
