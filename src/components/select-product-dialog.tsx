
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
import { ChevronsUpDown, Hash, AlertCircle } from 'lucide-react';
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

    // Check if query is numeric for smart switching
    const isQueryNumeric = /^\d+$/.test(q);
    
    return products.filter(p => {
        const code = (p.productCode || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        
        // If code search is on AND user is typing numbers, use exact suffix logic
        if (isCodeSearch && isQueryNumeric) {
            if (!code.endsWith(q)) return false;
            
            const indexBefore = code.length - q.length - 1;
            if (indexBefore >= 0) {
                const charBefore = code[indexBefore];
                if (/[1-9]/.test(charBefore)) return false;
            }
            return true;
        } else {
            // Standard partial match on name or code (Fallback)
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
            placeholder={isCodeSearch ? "أدخل رقم الصنف أو اسم المنتج..." : "ابحث بالاسم أو الكود..."} 
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[400px]">
            {products.length === 0 && !disabled && (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <p className="text-sm">لا توجد أصناف متاحة لهذا الفرع.</p>
                </div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
                <CommandEmpty>لم يتم العثور على أي نتيجة تطابق بحثك.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product.id)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col text-right w-full">
                    <span className="font-bold">{product.name} - مقاس {product.size}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">الباركود: {product.productCode} | السعر: {product.price} ج.م</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
