
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Hash } from "lucide-react"
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
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"


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
  const [searchQuery, setSearchQuery] = React.useState("");
  // جعل البحث الدقيق بالكود هو الافتراضي
  const [isCodeSearch, setIsCodeSearch] = React.useState(true);

  const selectedProduct = products.find(
    (product) => product.id.toLowerCase() === value?.toLowerCase()
  );

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    
    return products.filter(p => {
        const code = (p.productCode || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        
        if (isCodeSearch) {
            if (!code.endsWith(q)) return false;
            const indexBefore = code.length - q.length - 1;
            if (indexBefore >= 0) {
                const charBefore = code[indexBefore];
                if (/[1-9]/.test(charBefore)) return false;
            }
            return true;
        } else {
            return name.includes(q) || code.includes(q);
        }
    });
  }, [products, searchQuery, isCodeSearch]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setOpen(false);
    setSearchQuery("");
  };

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
            <div className="flex items-center justify-between">
                <DialogTitle>اختر منتج</DialogTitle>
                <div className="flex items-center gap-2 bg-muted/50 p-1 px-3 rounded-full border border-primary/20">
                    <Checkbox 
                        id="code-search-mode-combo" 
                        checked={isCodeSearch} 
                        onCheckedChange={(checked) => setIsCodeSearch(!!checked)} 
                    />
                    <Label htmlFor="code-search-mode-combo" className="text-[10px] font-bold cursor-pointer flex items-center gap-1 text-primary">
                        <Hash className="h-3 w-3" />
                        بحث دقيق بالكود
                    </Label>
                </div>
            </div>
          </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={isCodeSearch ? "أدخل رقم الصنف بدقة (مثل 122)..." : "ابحث بالاسم أو الكود..."} 
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {filteredProducts.length === 0 && <CommandEmpty>{emptyMessage || "لم يتم العثور على منتج."}</CommandEmpty>}
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product.id)}
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
