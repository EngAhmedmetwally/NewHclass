"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { Product } from "@/lib/definitions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"


type ProductComboboxProps = {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

export function ProductCombobox({ products, value, onChange, disabled, placeholder, emptyMessage }: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedProduct = products.find(
    (product) => product.id.toLowerCase() === value?.toLowerCase()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
         <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedProduct
            ? `${selectedProduct.name} - ${selectedProduct.size} (${selectedProduct.productCode})`
            : placeholder || "اختر منتج..."}
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0">
         <DialogHeader className="p-4 pb-0">
            <DialogTitle>اختر منتج</DialogTitle>
          </DialogHeader>
        <Command>
          <CommandInput placeholder="ابحث بالاسم أو الكود..." />
          <CommandList>
            <CommandEmpty>{emptyMessage || "لم يتم العثور على منتج."}</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.size} ${product.productCode}`}
                  onSelect={() => {
                    onChange(product.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {`${product.name} - ${product.size} (${product.productCode})`}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
