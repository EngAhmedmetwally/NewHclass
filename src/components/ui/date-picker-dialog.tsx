
"use client"

import * as React from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type DatePickerDialogProps = {
  value?: Date;
  onValueChange: (date?: Date) => void;
  trigger?: React.ReactNode;
  fromDate?: Date;
  disabled?: boolean;
};

export function DatePickerDialog({ value, onValueChange, trigger, fromDate, disabled }: DatePickerDialogProps) {
  const [open, setOpen] = React.useState(false);
  
  const handleSelect = (date?: Date) => {
    onValueChange(date);
    if (date) {
        setOpen(false); 
    }
  }

  const formattedDate = React.useMemo(() => {
    if (!value) return null;
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        return format(d, "d MMMM yyyy", { locale: ar });
    } catch (e) {
        return null;
    }
  }, [value]);

  const defaultTrigger = (
     <Button
        variant={"outline"}
        type="button"
        className={cn(
          "w-full justify-start text-right font-normal h-10 px-3 py-2",
          (!value || isNaN(new Date(value).getTime())) && "text-muted-foreground"
        )}
        disabled={disabled}
      >
        <CalendarIcon className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        <span className="truncate">{formattedDate || "اختر تاريخ..."}</span>
      </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[95vw] sm:w-auto p-0 border-none shadow-2xl z-[150]" 
        align="center"
        side="bottom"
        sideOffset={4}
      >
        <div className="bg-popover rounded-lg border shadow-lg pointer-events-auto overflow-hidden">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              fromDate={fromDate}
              initialFocus
              disabled={disabled}
              className="rounded-md border shadow"
            />
        </div>
      </PopoverContent>
    </Popover>
  )
}
