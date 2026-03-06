
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AddCustomerDialog } from './add-customer-dialog';
import type { Customer } from '@/lib/definitions';
import { ChevronsUpDown } from 'lucide-react';

type SelectCustomerDialogProps = {
  customers: Customer[];
  onCustomerSelected: (customerId: string | undefined) => void;
  selectedCustomerId?: string;
};

export function SelectCustomerDialog({
  customers,
  onCustomerSelected,
  selectedCustomerId,
}: SelectCustomerDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (customerId: string) => {
    onCustomerSelected(customerId);
    setOpen(false);
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.primaryPhone}` : "اختر العميل..."}
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>اختيار عميل</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="ابحث بالاسم أو رقم الهاتف..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>لم يتم العثور على عميل.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.name} ${customer.primaryPhone}`}
                  onSelect={() => handleSelect(customer.id)}
                >
                  {customer.name} - {customer.primaryPhone}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter className="pt-4 border-t">
          <AddCustomerDialog onCustomerCreated={handleSelect} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
