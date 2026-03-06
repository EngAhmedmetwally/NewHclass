
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Product } from '@/lib/definitions';
import { ChevronsUpDown } from 'lucide-react';

type SelectProductDialogProps = {
  products: Product[];
  onProductSelected: (productId: string) => void;
  selectedProductId?: string;
  disabled?: boolean;
};

export function SelectProductDialog({
  products,
  onProductSelected,
  selectedProductId,
  disabled,
}: SelectProductDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (productId: string) => {
    onProductSelected(productId);
    setOpen(false);
  };
  
  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between" disabled={disabled}>
           {selectedProduct
            ? `${selectedProduct.name} - ${selectedProduct.size} (${selectedProduct.productCode})`
            : "اختر منتج..."}
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>اختيار منتج</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="ابحث بالاسم أو الكود..." />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>لم يتم العثور على منتج.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.size} ${product.productCode}`}
                  onSelect={() => handleSelect(product.id)}
                >
                  {product.name} - {product.size} ({product.productCode})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
