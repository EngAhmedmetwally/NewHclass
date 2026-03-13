"use client"

import * as React from "react"
import { Eye, Package } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OrderItem } from "@/lib/definitions"

export function OrderItemsPreviewDialog({ items }: { items: OrderItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
          <Eye className="h-4 w-4" />
          <span className="sr-only">عرض الأصناف</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            أصناف الطلب
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">الصنف</TableHead>
                <TableHead className="text-center">الكود</TableHead>
                <TableHead className="text-center">السعر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-right font-medium text-xs sm:text-sm">{item.productName}</TableCell>
                  <TableCell className="text-center font-mono text-[10px] sm:text-xs text-muted-foreground">{item.productCode}</TableCell>
                  <TableCell className="text-center font-mono text-xs sm:text-sm font-semibold">{item.priceAtTimeOfOrder.toLocaleString()} ج.م</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
