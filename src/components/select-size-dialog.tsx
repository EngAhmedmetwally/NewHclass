
"use client";

import React, { useState, useMemo } from 'react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRtdbList } from "@/hooks/use-rtdb";
import { AddSizeDialog } from './add-size-dialog';
import { Search } from 'lucide-react';

type SelectSizeDialogProps = {
  onSelectSize: (size: string) => void;
};

export function SelectSizeDialog({ onSelectSize }: SelectSizeDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: rawSizes, isLoading } = useRtdbList<{ name: string }>('sizes');

  const availableSizes = useMemo(() => rawSizes.map(s => s.name).sort(), [rawSizes]);

  const filteredSizes = useMemo(() => {
    if (!searchTerm) return availableSizes;
    return availableSizes.filter(size => size.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, availableSizes]);

  const handleSelect = (size: string) => {
    onSelectSize(size);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">اختر مقاس...</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>اختيار مقاس</DialogTitle>
          <DialogDescription>
            ابحث عن المقاس المطلوب أو قم بإضافة مقاس جديد.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن مقاس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border">
            <Command>
              <CommandList>
                <CommandGroup>
                  {isLoading ? (
                    <CommandItem>جاري التحميل...</CommandItem>
                  ) : filteredSizes.length > 0 ? (
                    filteredSizes.map(size => (
                      <CommandItem
                        key={size}
                        onSelect={() => handleSelect(size)}
                        className="cursor-pointer"
                      >
                        {size}
                      </CommandItem>
                    ))
                  ) : (
                    <CommandEmpty>لم يتم العثور على مقاس. <AddSizeDialog /></CommandEmpty>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
        <DialogFooter>
           <AddSizeDialog />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
