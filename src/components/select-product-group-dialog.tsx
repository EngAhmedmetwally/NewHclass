
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
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useRtdbList } from "@/hooks/use-rtdb";
import { AddProductGroupDialog } from './add-product-group-dialog';
import { Search } from 'lucide-react';

type SelectProductGroupDialogProps = {
  onSelectProductGroup: (group: string) => void;
};

export function SelectProductGroupDialog({ onSelectProductGroup }: SelectProductGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: rawGroups, isLoading } = useRtdbList<{ name: string }>('productGroups');

  const availableGroups = useMemo(() => rawGroups.map(s => s.name).sort(), [rawGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return availableGroups;
    return availableGroups.filter(group => group.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, availableGroups]);

  const handleSelect = (group: string) => {
    onSelectProductGroup(group);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">اختر مجموعة...</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>اختيار مجموعة المنتج</DialogTitle>
          <DialogDescription>
            ابحث عن المجموعة المطلوبة أو قم بإضافة مجموعة جديدة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن مجموعة..."
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
                  ) : filteredGroups.length > 0 ? (
                    filteredGroups.map(group => (
                      <CommandItem
                        key={group}
                        onSelect={() => handleSelect(group)}
                        className="cursor-pointer"
                      >
                        {group}
                      </CommandItem>
                    ))
                  ) : (
                    <CommandEmpty>لم يتم العثور على مجموعة.</CommandEmpty>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
        <DialogFooter>
           <AddProductGroupDialog />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
