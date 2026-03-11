
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type DatePickerDialogProps = {
  value?: Date;
  onValueChange: (date?: Date) => void;
  trigger?: React.ReactNode;
  fromDate?: Date;
  disabled?: boolean;
  className?: string;
};

/**
 * مكون مطور لاختيار التاريخ يعتمد على الإدخال الأصلي للمتصفح (Native HTML5 Date)
 * لضمان أفضل تجربة مستخدم على الموبايل والسرعة في الاختيار.
 */
export function DatePickerDialog({ 
  value, 
  onValueChange, 
  fromDate, 
  disabled,
  className
}: DatePickerDialogProps) {
  
  // تحويل كائن التاريخ إلى صيغة نصية YYYY-MM-DD التي يفهمها حقل الإدخال
  const formattedValue = React.useMemo(() => {
    if (!value || isNaN(value.getTime())) return "";
    return format(value, "yyyy-MM-dd");
  }, [value]);

  // تحويل التاريخ الأدنى المسموح به إلى الصيغة المطلوبة
  const minDate = React.useMemo(() => {
    if (!fromDate || isNaN(fromDate.getTime())) return undefined;
    return format(fromDate, "yyyy-MM-dd");
  }, [fromDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onValueChange(undefined);
      return;
    }
    
    // إنشاء كائن تاريخ جديد مع الحفاظ على التوقيت المحلي
    const [year, month, day] = val.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    onValueChange(date);
  };

  return (
    <div className={cn("relative w-full group", className)}>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
        <CalendarIcon className="h-4 w-4" />
      </div>
      <Input
        type="date"
        value={formattedValue}
        min={minDate}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "w-full pr-10 text-right appearance-none block bg-background border-input cursor-pointer",
          "focus:ring-2 focus:ring-primary/20 transition-all",
          // إخفاء أيقونة التقويم الافتراضية للمتصفح لتوحيد الشكل
          "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  )
}
