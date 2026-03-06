"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui/command"
import type { Customer } from "@/lib/definitions"
import { AddCustomerDialog } from "./add-customer-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"


type CustomerComboboxProps = {
  customers: Customer[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

export function CustomerCombobox({ customers, value, onChange, disabled }: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedCustomer = customers.find(
    (customer) => customer.id === value
  );

  return (
    <div className="flex gap-2">
       <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
           <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedCustomer
              ? `${selectedCustomer.name} - ${selectedCustomer.primaryPhone}`
              : "اختر العميل..."}
            <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>اختر عميل</DialogTitle>
          </DialogHeader>
            <Command>
              <CommandInput placeholder="ابحث بالاسم أو رقم الهاتف..." />
              <CommandList>
                <CommandEmpty>لم يتم العثور على عميل.</CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={`${customer.name} ${customer.primaryPhone} ${customer.secondaryPhone || ''}`}
                      onSelect={() => {
                        onChange(customer.id)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          value === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {customer.name} - {customer.primaryPhone}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
        </DialogContent>
      </Dialog>

      <AddCustomerDialog
        trigger={
            <Button variant="outline" size="icon" type="button">
                <UserPlus className="h-4 w-4" />
            </Button>
        }
        onCustomerCreated={(customerId) => onChange(customerId)}
      />
    </div>
  )
}
