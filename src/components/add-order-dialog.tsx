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
import { PlusCircle, UserPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddCustomerDialog } from "./add-customer-dialog";
import { useRtdbList } from "@/hooks/use-rtdb";
import type { Customer, User } from "@/lib/definitions";
import React from "react";

export function AddOrderDialog() {
    const { data: users, isLoading: usersLoading } = useRtdbList<User>('users');
    const { data: customers, isLoading: customersLoading } = useRtdbList<Customer>('customers');
    const isLoading = usersLoading || customersLoading;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          أضف طلب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة طلب جديد</DialogTitle>
          <DialogDescription>
            املأ تفاصيل الطلب الجديد هنا.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customerName" className="text-right">
              العميل
            </Label>
             <div className="col-span-3 flex gap-2">
                <Select disabled={isLoading}>
                <SelectTrigger>
                    <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                    {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
                <AddCustomerDialog trigger={
                    <Button variant="outline" size="icon">
                        <UserPlus className="h-4 w-4" />
                    </Button>
                } />
             </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              نوع الطلب
            </Label>
            <Select>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rental">إيجار</SelectItem>
                <SelectItem value="sale">بيع</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="seller" className="text-right">
              البائع
            </Label>
            <Select disabled={isLoading}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="اختر البائع" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role === 'seller' || u.role === 'admin').map(user => (
                    <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">حفظ الطلب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
