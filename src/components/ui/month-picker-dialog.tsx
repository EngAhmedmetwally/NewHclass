
"use client"

import * as React from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type MonthPickerDialogProps = {
  value?: Date;
  onValueChange: (date?: Date) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
};

export function MonthPickerDialog({ value, onValueChange, trigger, disabled }: MonthPickerDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [displayYear, setDisplayYear] = React.useState(value ? value.getFullYear() : new Date().getFullYear());

  React.useEffect(() => {
    if (value) {
      setDisplayYear(value.getFullYear());
    }
  }, [value]);

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(displayYear, monthIndex, 1);
    onValueChange(newDate);
    setOpen(false);
  }

  const defaultTrigger = (
     <Button
        variant={"outline"}
        className={cn(
          "w-full justify-start text-left font-normal",
          !value && "text-muted-foreground"
        )}
        disabled={disabled}
      >
        <CalendarIcon className="ml-2 h-4 w-4" />
        {value ? format(value, "MMMM yyyy", { locale: ar }) : <span>اختر شهرًا</span>}
      </Button>
  )

  const months = Array.from({ length: 12 }, (_, i) => format(new Date(displayYear, i, 1), "MMMM", { locale: ar }));

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="p-3">
          <div className="flex items-center justify-between pb-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDisplayYear(y => y - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="font-medium">{displayYear}</div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDisplayYear(y => y + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {months.map((monthName, index) => (
              <Button
                key={monthName}
                variant={value?.getFullYear() === displayYear && value?.getMonth() === index ? "default" : "outline"}
                onClick={() => handleMonthSelect(index)}
              >
                {monthName}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
