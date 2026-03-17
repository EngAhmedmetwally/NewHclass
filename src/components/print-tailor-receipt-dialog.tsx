
"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from './ui/button';
import { HiClassLogo } from './icons';
import { Separator } from './ui/separator';
import type { Order } from '@/lib/definitions';
import { useSettings } from '@/hooks/use-settings';

const DottedSeparator = () => (
    <div style={{
        borderBottom: '1.5px dashed #000',
        margin: '10px 0',
        transform: 'scaleY(0.5)',
    }}></div>
);

const TailorReceiptContent = React.forwardRef<HTMLDivElement, { order: Order, settings: any }>(({ order, settings }, ref) => {
    const itemsWithNotesOrMeasurements = order.items.filter(item => item.tailorNotes || item.measurements);

    return (
        <div ref={ref} className="w-[72mm] mx-auto bg-white text-black p-3 font-headline text-right" style={{ boxSizing: 'border-box' }}>
            <div className="text-center mb-2">
                {settings.tailor_showShopName && <h2 className="text-xl font-bold font-headline -mt-2">{settings.tailor_shopName}</h2>}
                {settings.tailor_showContact && <p className="text-sm mt-1">{settings.tailor_contactInfo}</p>}
            </div>

            <DottedSeparator />

            <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>رقم الطلب:</span> <span className="font-bold">{order.orderCode}</span></div>
                <div className="flex justify-between"><span>التاريخ:</span> <span>{new Date(order.orderDate).toLocaleDateString('ar-EG')}</span></div>
                <div className="flex justify-between"><span>اسم العميل:</span> <span className="font-bold">{order.customerName}</span></div>
                {order.deliveryDate && <div className="flex justify-between"><span>تاريخ التسليم:</span> <span className="font-bold">{new Date(order.deliveryDate).toLocaleDateString('ar-EG')}</span></div>}
            </div>
            
            <DottedSeparator />

            <h3 className="font-bold text-lg mb-3">تفاصيل التعديلات:</h3>
            {itemsWithNotesOrMeasurements.map((item, index) => (
                <div key={index} className="mb-4 text-sm">
                     <p className="font-bold text-base bg-muted/20 p-1">{item.productName}{item.measurements ? ` - ${item.measurements}` : ''}</p>
                    {item.tailorNotes && (
                        <div className="border border-black p-2 text-base font-medium leading-relaxed whitespace-pre-wrap mt-1">
                           {item.tailorNotes}
                        </div>
                    )}
                </div>
            ))}
            
            <DottedSeparator />
            <p className="text-center whitespace-pre-wrap text-xs font-medium mt-3">{settings.tailor_disclaimer}</p>

            <div style={{ borderTop: '1px solid #000', marginTop: '15px', paddingTop: '8px', textAlign: 'center', fontSize: '10px' }}>
                www.codlink.online
            </div>
        </div>
    );
});
TailorReceiptContent.displayName = 'TailorReceiptContent';


type PrintTailorReceiptDialogProps = {
    order: Order;
    trigger: React.ReactNode;
}

export function PrintTailorReceiptDialog({ order, trigger }: PrintTailorReceiptDialogProps) {
    const [isMounted, setIsMounted] = useState(false);
    const { settings, isLoading: isLoadingSettings } = useSettings();
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = componentRef.current?.outerHTML;
        if (!content) return;

        const printWindow = window.open('', '', 'height=800,width=400');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Tailor Receipt</title>');
            printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />');
            printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet" />');
            printWindow.document.write(`
                <style>
                    @page { size: 72mm auto; margin: 0; }
                    body { 
                        font-family: "Tajawal", sans-serif; 
                        direction: rtl;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    * { box-sizing: border-box; }
                    .font-headline { font-family: "Tajawal", sans-serif; font-weight: 700; }
                    .font-ruqaa { font-family: "Aref Ruqaa", serif; } 
                    .text-xs { font-size: 0.85rem; line-height: 1.3; }
                    .text-sm { font-size: 1.0rem; line-height: 1.3; }
                    .text-base { font-size: 1.15rem; line-height: 1.4; }
                    .text-lg { font-size: 1.3rem; }
                    .text-xl { font-size: 1.5rem; }
                    .text-2xl { font-size: 1.8rem; }
                    .font-bold { font-weight: 700; }
                    .font-semibold { font-weight: 600; }
                    .font-medium { font-weight: 500; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .mx-auto { margin-left: auto; margin-right: auto; }
                    .mb-2 { margin-bottom: 0.5rem; }
                    .mb-3 { margin-bottom: 0.75rem; }
                    .mb-4 { margin-bottom: 1rem; }
                    .-mt-2 { margin-top: -0.5rem; }
                    .mt-1 { margin-top: 0.25rem; }
                    .mt-3 { margin-top: 0.75rem; }
                    .p-1 { padding: 0.25rem; }
                    .p-2 { padding: 0.5rem; }
                    .p-3 { padding: 0.75rem; }
                    .flex { display: flex; }
                    .grid { display: grid; }
                    .items-start { align-items: flex-start; }
                    .justify-between { justify-content: space-between; }
                    .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem; }
                    .border { border-width: 1px; border-color: #000; border-style: solid; }
                    .border-black { border-color: #000; }
                    .leading-relaxed { line-height: 1.625; }
                    .whitespace-pre-wrap { white-space: pre-wrap; }
                    h2, h3, p, span, div { margin: 0; padding: 0; }
                </style>
            `);
            printWindow.document.write('</head><body>');
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 100);
        }
    };
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || isLoadingSettings) {
        return <>{trigger}</>
    }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>معاينة طباعة وصل الخياط</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-start gap-6 py-4 bg-muted rounded-md max-h-[65vh] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-primary/20">
            <TailorReceiptContent ref={componentRef} order={order} settings={settings} />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handlePrint} className="w-full">طباعة الوصل</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
