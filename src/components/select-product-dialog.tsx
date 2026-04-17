
"use client";

import React, { useState, useMemo } from 'react';
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
import { ChevronsUpDown, Hash } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

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
  const [searchQuery, setSearchQuery] = useState("");
  // جعل البحث الدقيق بالكود هو الافتراضي
  const [isCodeSearch, setIsCodeSearch] = useState(true);

  const handleSelect = (productId: string) => {
    onProductSelected(productId);
    setOpen(false);
    setSearchQuery("");
  };
  
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    
    return products.filter(p => {
        const code = (p.productCode || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        
        if (isCodeSearch) {
            // Logic for Exact Code Suffix match (to distinguish 122 from 1122)
            if (!code.endsWith(q)) return false;
            
            // Check the digit immediately before the matched suffix
            const indexBefore = code.length - q.length - 1;
            if (indexBefore >= 0) {
                const charBefore = code[indexBefore];
                // If the preceding character is a non-zero digit, it's a different number sequence
                if (/[1-9]/.test(charBefore)) return false;
            }
            return true;
        } else {
            // Standard partial match on name or code
            return name.includes(q) || code.includes(q);
        }
    });
  }, [products, searchQuery, isCodeSearch]);

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
          <DialogTitle className="flex items-center justify-between">
            <span>اختيار منتج</span>
            <div className="flex items-center gap-2 ml-6 bg-muted/50 p-1 px-3 rounded-full border border-primary/20">
                <Checkbox 
                    id="code-search-mode-select" 
                    checked={isCodeSearch} 
                    onCheckedChange={(checked) => setIsCodeSearch(!!checked)} 
                />
                <Label htmlFor="code-search-mode-select" className="text-[10px] font-bold cursor-pointer flex items-center gap-1 text-primary">
                    <Hash className="h-3 w-3" />
                    بحث دقيق بالكود
                </Label>
            </div>
          </DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={isCodeSearch ? "أدخل رقم الصنف بدقة (مثل 122)..." : "ابحث بالاسم أو الكود..."} 
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[400px]">
            {filteredProducts.length === 0 && <CommandEmpty>لم يتم العثور على منتج.</CommandEmpty>}
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
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
