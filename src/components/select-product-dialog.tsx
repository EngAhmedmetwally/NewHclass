
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
import { ChevronsUpDown, Hash, AlertCircle, ShoppingBag, Repeat } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

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

    const isQueryNumeric = /^\d+$/.test(q);
    
    return products.filter(p => {
        const code = (p.productCode || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        const group = (p.group || "").toLowerCase();
        
        // --- Smart Suffix Matching for Codes ---
        if (isCodeSearch && isQueryNumeric) {
            // Match suffix or exact code
            if (code.endsWith(q)) {
                // To avoid matching "1" with "1231", we check the char before
                const indexBefore = code.length - q.length - 1;
                if (indexBefore >= 0) {
                    const charBefore = code[indexBefore];
                    // If it's a digit 1-9, it's a different code (e.g. searching '49' should not find '1049')
                    if (/[1-9]/.test(charBefore)) return false;
                }
                return true;
            }
            return false;
        } else {
            // --- General Search (Name, Group, or Partial Code) ---
            return (
                name.includes(q) || 
                code.includes(q) || 
                group.includes(q)
            );
        }
    });
  }, [products, searchQuery, isCodeSearch]);

  const getCategoryBadge = (category: string) => {
      switch(category) {
          case 'both': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">بيع/إيجار</Badge>;
          case 'rental': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">إيجار</Badge>;
          case 'sale': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">بيع</Badge>;
          default: return null;
      }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between min-h-10 h-auto py-2" disabled={disabled}>
           {selectedProduct
            ? `${selectedProduct.name} - ${selectedProduct.size} (${selectedProduct.productCode})`
            : "اختر منتج..."}
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-right">اختيار منتج</DialogTitle>
            <div className="flex items-center gap-2 bg-muted/50 p-1 px-3 rounded-full border border-primary/20">
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
          </div>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={isCodeSearch ? "أدخل رقم الصنف أو اسم المنتج..." : "ابحث بالاسم أو الكود أو الفئة..."} 
            onValueChange={setSearchQuery}
            className='text-right'
          />
          <CommandList className="max-h-[450px]">
            {products.length === 0 && !disabled && (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <p className="text-sm">لا توجد أصناف متاحة لهذا الفرع.</p>
                </div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
                <CommandEmpty className='py-12 text-center text-muted-foreground'>لم يتم العثور على أي نتيجة تطابق بحثك.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product.id)}
                  className="cursor-pointer py-3 border-b last:border-0"
                >
                  <div className="flex justify-between items-center w-full gap-4">
                    <div className="flex flex-col text-right flex-1">
                        <div className='flex items-center gap-2 mb-1'>
                            <span className="font-bold text-sm">{product.name} - مقاس {product.size}</span>
                            {getCategoryBadge(product.category)}
                        </div>
                        <div className='flex items-center gap-3 text-[10px] text-muted-foreground font-mono'>
                            <span className='flex items-center gap-1'><Hash className='h-2.5 w-2.5'/> {product.productCode}</span>
                            <span className='flex items-center gap-1'><ShoppingBag className='h-2.5 w-2.5'/> {product.price} ج.م</span>
                            {product.group && <span className='opacity-70'>{product.group}</span>}
                        </div>
                    </div>
                    {selectedProductId === product.id && <div className='w-2 h-2 rounded-full bg-primary' />}
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
