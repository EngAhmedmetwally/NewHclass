"use client";

import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import type { Product } from '@/lib/definitions';
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
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSettings } from '@/hooks/use-settings';

type PrintLabelDialogProps = {
    product: Product;
    trigger: React.ReactNode;
}

const LabelToPrint = React.forwardRef<HTMLDivElement, { product: Product, settings: any }>(({ product, settings }, ref) => {
    const price = `${(Number(product.price) || 0).toLocaleString()} ج.م`;
    const {
        label_showPrice: showPrice,
        label_showSize: showSize,
        label_showBarcodeLines: showBarcodeLines,
    } = settings;

    return (
        <div
            ref={ref}
            style={{
                width: `${settings.label_width_mm}mm`,
                height: `${settings.label_height_mm}mm`,
                boxSizing: 'border-box',
                display: 'block',
                overflow: 'hidden',
                position: 'relative',
                direction: 'rtl',
                backgroundColor: 'white',
                color: 'black',
                margin: 0,
                padding: 0
            }}
        >
             {/* Product Name */}
             <p style={{
                position: 'absolute',
                left: `${settings.label_productName_x_mm}mm`,
                top: `${settings.label_productName_y_mm}mm`,
                transform: 'translateX(-50%)',
                fontSize: `${settings.label_productNameFontSize_pt}pt`,
                lineHeight: 1.1,
                margin: 0,
                padding: 0,
                whiteSpace: 'nowrap',
                fontWeight: 'bold',
                textAlign: 'center',
                width: '100%'
            }}>{product.name}</p>

            {/* Price */}
            {showPrice && (
                <p style={{
                    position: 'absolute',
                    left: `${settings.label_price_x_mm}mm`,
                    top: `${settings.label_price_y_mm}mm`,
                    transform: 'translateX(-50%)',
                    fontSize: `${settings.label_detailsFontSize_pt}pt`,
                    margin: 0,
                    padding: 0,
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: '100%'
                }}>{price}</p>
            )}
            
            {/* Size */}
            {showSize && product.size && (
                    <p style={{
                    position: 'absolute',
                    left: `${settings.label_size_x_mm}mm`,
                    top: `${settings.label_size_y_mm}mm`,
                    transform: 'translateX(-50%)',
                    fontSize: `${settings.label_detailsFontSize_pt}pt`,
                    margin: 0,
                    padding: 0,
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    width: '100%'
                }}>المقاس: {product.size}</p>
            )}

            {/* Barcode Lines */}
            <div style={{
                position: 'absolute',
                left: `${settings.label_barcode_x_mm}mm`,
                top: `${settings.label_barcode_y_mm}mm`,
                transform: 'translateX(-50%)',
                width: '90%',
                display: showBarcodeLines ? 'block' : 'none',
                textAlign: 'center'
            }}>
                <svg className="barcode-svg" style={{ margin: '0 auto', display: 'block' }}></svg>
            </div>
            
            {/* Barcode Value Label */}
            <p style={{
                position: 'absolute',
                left: `${settings.label_barcodeValue_x_mm}mm`,
                top: `${settings.label_barcodeValue_y_mm}mm`,
                transform: 'translateX(-50%)',
                fontSize: `${settings.label_barcodeValueFontSize_pt}pt`,
                margin: 0,
                padding: 0,
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                textAlign: 'center',
                width: '100%'
            }}>{product.productCode}</p>
        </div>
    );
});
LabelToPrint.displayName = 'LabelToPrint';


export function PrintLabelDialog({ product, trigger }: PrintLabelDialogProps) {
    const [labelCount, setLabelCount] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const { settings, isLoading: isLoadingSettings } = useSettings();
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && componentRef.current) {
            const svgElement = componentRef.current.querySelector('.barcode-svg') as SVGElement;
            if (svgElement && product.productCode && settings.label_barcodeHeight_mm) {
                 try {
                    JsBarcode(svgElement, product.productCode, {
                        format: 'CODE128',
                        displayValue: false,
                        width: 2,
                        height: settings.label_barcodeHeight_mm * (96 / 25.4), // mm to px approx for screen
                        margin: 0,
                    });
                } catch (e) {
                    console.error('Barcode generation failed in dialog:', e);
                }
            }
        }
    }, [open, product, settings]);

    const handlePrint = () => {
        if (!componentRef.current) return;

        const originalLabelNode = componentRef.current;
        const printWindow = window.open('', '', 'height=600,width=800');
        
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Labels</title>');
            printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">');
            printWindow.document.write(`
                <style>
                    @page { 
                        size: ${settings.label_width_mm}mm ${settings.label_height_mm}mm; 
                        margin: 0 !important; 
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: ${settings.label_width_mm}mm;
                        height: ${settings.label_height_mm}mm;
                    }
                    body { 
                        font-family: "Tajawal", sans-serif;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .label-wrapper {
                        width: ${settings.label_width_mm}mm;
                        height: ${settings.label_height_mm}mm;
                        position: relative;
                        page-break-after: always;
                        overflow: hidden;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-sizing: border-box;
                    }
                    * { 
                        box-sizing: border-box; 
                        -webkit-print-color-adjust: exact;
                    }
                    p { margin: 0; padding: 0; }
                </style>
            `);
            printWindow.document.write('</head><body>');

            // Generate content for each label requested
            for (let i = 0; i < labelCount; i++) {
                const labelClone = originalLabelNode.cloneNode(true) as HTMLElement;
                // Remove all classes and set the print wrapper class
                labelClone.className = "label-wrapper";
                
                // Re-initialize the barcode in the clone for high quality
                const svg = labelClone.querySelector('.barcode-svg') as SVGElement;
                if (svg && settings.label_barcodeHeight_mm) {
                    JsBarcode(svg, product.productCode, {
                        format: 'CODE128',
                        displayValue: false,
                        width: 2,
                        height: settings.label_barcodeHeight_mm * (300 / 25.4), // 300 DPI high quality
                        margin: 0,
                    });
                }
                
                printWindow.document.write(labelClone.outerHTML);
            }

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || isLoadingSettings) {
        return <>{trigger}</>;
    }
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>طباعة ملصق المنتج</DialogTitle>
                    <DialogDescription>
                        معاينة الملصق وتحديد عدد النسخ للطباعة. سيتم استخدام إعدادات التصميم المحفوظة بدون أي هوامش.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center gap-6 py-4">
                    <div className="bg-white border p-0 shadow-inner overflow-hidden" style={{ width: 'fit-content' }}>
                        <LabelToPrint ref={componentRef} product={product} settings={settings} />
                    </div>
                    <div className="w-full max-w-xs flex flex-col gap-2">
                        <Label htmlFor="label-count" className="text-center">عدد الملصقات للطباعة</Label>
                        <Input 
                            id="label-count"
                            type="number"
                            value={labelCount}
                            onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                            min="1"
                            className="text-center text-lg font-bold"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>إلغاء</Button>
                    <Button type="button" className="w-full" onClick={handlePrint}>بدء الطباعة</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
