"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useRtdbList } from "@/hooks/use-rtdb";
import type { Branch, User } from "@/lib/definitions";

const expenseCategories = [
    { value: 'salaries', label: 'مرتبات' },
    { value: 'rent', label: 'إيجار' },
    { value: 'utilities', label: 'فواتير ومرافق' },
    { value: 'maintenance', label: 'صيانة' },
    { value: 'marketing', label: 'تسويق وإعلان' },
    { value: 'supplies', label: 'مستلزمات تشغيل' },
    { value: 'other', label: 'أخرى' },
]

export function AddExpenseDialog() {
  const { data: users, isLoading: isLoadingUsers } = useRtdbList<User>('users');
  const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
  const isLoading = isLoadingUsers || isLoadingBranches;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          إضافة مصروف
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تسجيل مصروف جديد</DialogTitle>
          <DialogDescription>
            املأ التفاصيل أدناه لتسجيل مصروف جديد في السجل.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              الوصف
            </Label>
            <Input id="description" className="col-span-3" placeholder="مثال: فاتورة كهرباء شهر يوليو" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              المبلغ
            </Label>
            <Input id="amount" type="number" className="col-span-3" placeholder="0.00" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              الفئة
            </Label>
             <Select>
                <SelectTrigger id="category" className="col-span-3">
                    <SelectValue placeholder="اختر فئة المصروف" />
                </SelectTrigger>
                <SelectContent>
                    {expenseCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                            {category.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="branch" className="text-right">
              الفرع
            </Label>
             <Select disabled={isLoading}>
                <SelectTrigger id="branch" className="col-span-3">
                    <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                    {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="user" className="text-right">
              المسجل بواسطة
            </Label>
             <Select disabled={isLoading}>
                <SelectTrigger id="user" className="col-span-3">
                    <SelectValue placeholder="اختر المستخدم" />
                </SelectTrigger>
                <SelectContent>
                    {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">
              ملاحظات
            </Label>
            <Textarea id="notes" className="col-span-3" placeholder="أي تفاصيل إضافية..." />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">حفظ المصروف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
