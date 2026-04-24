
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import type { Order, Branch } from '@/lib/definitions';
import { useRtdbList } from '@/hooks/use-rtdb';
import { useSettings } from '@/hooks/use-settings';

const DottedSeparator = () => (
    <div style={{
        borderBottom: '1.5px dashed #000',
        margin: '8px 0',
        transform: 'scaleY(0.5)', 
    }}></div>
);

const ReceiptContent = React.forwardRef<HTMLDivElement, { order: Order, settings: any, orderBranch: Branch | null | undefined }>(({ order, settings, orderBranch }, ref) => {
    // Calculate gross subtotal (original catalog prices sum)
    const subtotalOriginal = order.items.reduce((acc, item) => acc + (item.originalPrice || item.priceAtTimeOfOrder) * item.quantity, 0);

    const paymentMethods = useMemo(() => {
        if (order.payments && Object.keys(order.payments).length > 0) {
            const methods = Object.values(order.payments).map((p: any) => p.method);
            return Array.from(new Set(methods)).join(' + ');
        }
        return order.paid > 0 ? 'نقداً' : '-';
    }, [order]);

    const printTime = useMemo(() => {
        return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }, []);

    return (
        <div ref={ref} className="bg-white text-black p-3 font-mono text-right" style={{ width: '72mm', boxSizing: 'border-box' }}>
            {settings.receipt_showHeader && (
                <div className="text-center mb-2">
                    {settings.receipt_showLogo && <HiClassLogo className="text-5xl mx-auto text-black" />}
                    {settings.receipt_showShopName && <h2 className="font-bold font-headline -mt-2" style={{ fontSize: `${settings.receipt_shopNameFontSize_pt}pt` }}>{settings.receipt_headerText}</h2>}
                    {settings.receipt_showAddress && orderBranch && <p style={{ fontSize: `${settings.receipt_detailsFontSize_pt}pt`, marginTop: '2px' }}>{orderBranch.address || orderBranch.name}</p>}
                    <div className="flex items-center justify-center gap-x-4 gap-y-1 mt-1" style={{ fontSize: `${settings.receipt_detailsFontSize_pt}pt` }}>
                        {settings.receipt_showPhone && orderBranch?.phoneNumber && <p className="font-mono">{orderBranch.phoneNumber}</p>}
                        {settings.receipt_showWhatsapp && orderBranch?.whatsappNumber && (
                           <div className="flex items-center gap-1">
                                <p className="font-mono">{orderBranch.whatsappNumber}</p>
                           </div>
                        )}
                    </div>
                </div>
            )}
            <DottedSeparator />
            <div className="space-y-1" style={{ fontSize: `${settings.receipt_detailsFontSize_pt}pt` }}>
                <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span>{new Date(order.orderDate).toLocaleDateString('ar-EG')}</span>
                </div>
                {settings.receipt_showPrintTime && (
                    <div className="flex justify-between">
                        <span>وقت الطباعة:</span>
                        <span>{printTime}</span>
                    </div>
                )}
                {settings.receipt_showOrderNumber && (
                    <div className="flex justify-between">
                        <span>رقم الطلب:</span>
                        <span>{order.orderCode}</span>
                    </div>
                )}
                {settings.receipt_showCustomerInfo && (
                    <>
                        <div className="flex justify-between">
                            <span>العميل:</span>
                            <span className="font-bold">{order.customerName}</span>
                        </div>
                        {order.customerPhone && (
                            <div className="flex justify-between">
                                <span>الهاتف:</span>
                                <span dir="ltr" className="font-bold">{order.customerPhone}</span>
                            </div>
                        )}
                    </>
                 )}
                {settings.receipt_showSeller && (
                    <div className="flex justify-between">
                        <span>البائع:</span>
                        <span>{order.sellerName}</span>
                    </div>
                 )}
                 <div className="flex justify-between">
                    <span>طريقة الدفع:</span>
                    <span className="font-bold">{paymentMethods}</span>
                </div>
                 {order.deliveryDate && (
                    <div className="flex justify-between">
                        <span>تاريخ التسليم:</span>
                        <span>{new Date(order.deliveryDate).toLocaleDateString('ar-EG')}</span>
                    </div>
                )}
                {order.returnDate && (
                    <div className="flex justify-between">
                        <span>تاريخ الإرجاع:</span>
                        <span>{new Date(order.returnDate).toLocaleDateString('ar-EG')}</span>
                    </div>
                )}
            </div>
            
            <DottedSeparator />
            
            {/* Items */}
            <div className="space-y-2" style={{ fontSize: `${settings.receipt_itemsFontSize_pt}pt` }}>
                <div className="grid grid-cols-12 gap-1 font-semibold">
                    <span className="col-span-8">الصنف</span>
                    <span className="col-span-2 text-center">الكمية</span>
                    <span className="col-span-2 text-left">السعر</span>
                </div>
                 <DottedSeparator />
                 {order.items.map((item, i) => {
                     const [name, size] = item.productName.split(' - مقاس ');
                     return (
                        <div key={i} className="grid grid-cols-12 gap-1">
                            <div className="col-span-8 font-light flex flex-col">
                                <span>{name}</span>
                                <span className="text-gray-500 text-[10px] pr-2">
                                  {size ? `مقاس ${size} (${item.productCode})` : `(${item.productCode})`}
                                </span>
                            </div>
                            <span className="col-span-2 text-center font-light">{item.quantity}</span>
                            <span className="col-span-2 text-left font-light">{item.priceAtTimeOfOrder.toLocaleString()}</span>
                        </div>
                    )
                 })}
            </div>

             <DottedSeparator />

            {/* Totals */}
            <div className="space-y-1" style={{ fontSize: `${settings.receipt_totalsFontSize_pt}pt` }}>
                 <div className="flex justify-between font-semibold">
                    <span>الإجمالي قبل الخصم:</span>
                    <span>{subtotalOriginal.toLocaleString()}</span>
                </div>
                {order.discountAmount > 0 && (
                    <div className="flex justify-between font-semibold">
                        <span>قيمة الخصم:</span>
                        <span>-{(order.discountAmount || 0).toLocaleString()}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold my-1" style={{ fontSize: `${settings.receipt_totalsFontSize_pt! + 2}pt` }}>
                    <span>الصافي النهائي:</span>
                    <span>{(order.total || 0).toLocaleString()}</span>
                </div>
                 <div className="flex justify-between">
                    <span>المدفوع:</span>
                    <span>{(order.paid || 0).toLocaleString()}</span>
                </div>
                 <div className="flex justify-between font-bold">
                    <span>المتبقي:</span>
                    <span>{order.remainingAmount.toLocaleString()}</span>
                </div>
            </div>

             <DottedSeparator />

             <div className="text-center whitespace-pre-wrap mt-4" style={{ fontSize: `${settings.receipt_footerFontSize_pt}pt` }}>
                {settings.receipt_footerText?.replace(/\\n/g, '\n')}
             </div>

             <div style={{ borderTop: '1px solid #000', marginTop: '10px', paddingTop: '5px', textAlign: 'center', fontSize: '8px' }}>
                www.codlink.online
             </div>
        </div>
    );
});
ReceiptContent.displayName = 'ReceiptContent';

type PrintCashierReceiptDialogProps = {
    order: Order;
    trigger: React.ReactNode;
    shouldOpenOnMount?: boolean;
}

export function PrintCashierReceiptDialog({ order, trigger, shouldOpenOnMount = false }: PrintCashierReceiptDialogProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const { data: branches, isLoading: isLoadingBranches } = useRtdbList<Branch>('branches');
    const { settings, isLoading: isLoadingSettings } = useSettings();
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = componentRef.current?.outerHTML;
        if (!content) return;

        const printWindow = window.open('', '', 'height=800,width=400');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Receipt</title>');
            printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">');
            printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet">');
            
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
                    .font-mono { font-family: monospace; }
                    .text-black { color: #000000 !important; }
                    .text-gray-500 { color: #6B7280 !important; }
                    .text-5xl { font-size: 3rem; }
                    .font-bold { font-weight: 700; }
                    .font-semibold { font-weight: 600; }
                    .font-light { font-weight: 300; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .mx-auto { margin-left: auto; margin-right: auto; }
                    .mb-2 { margin-bottom: 0.5rem; }
                    .mt-1 { margin-top: 0.25rem; }
                    .-mt-2 { margin-top: -0.5rem; }
                    .mt-4 { margin-top: 1rem; }
                    .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
                    .p-3 { padding: 0.75rem; }
                    .pr-2 { padding-right: 0.5rem; }
                    .gap-x-4 { column-gap: 1rem; }
                    .gap-y-1 { row-gap: 0.25rem; }
                    .gap-1 { gap: 0.25rem; }
                    .flex { display: flex; }
                    .grid { display: grid; }
                    .grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
                    .col-span-2 { grid-column: span 2 / span 2; }
                    .col-span-8 { grid-column: span 8 / span 8; }
                    .items-center { align-items: center; }
                    .justify-center { justify-content: center; }
                    .justify-between { justify-content: space-between; }
                    .flex-col { flex-direction: column; }
                    .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                    .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
                    h2, p, span, div { margin: 0; padding: 0; }
                    .whitespace-pre-wrap { white-space: pre-wrap; }
                </style>
            `);

            printWindow.document.write('</head><body onafterprint="window.close()">');
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            
            setTimeout(() => {
                printWindow.print();
            }, 100);
        }
    };

    const orderBranch = useMemo(() => {
        if (isLoadingBranches) return null;
        return branches.find(b => b.id === order.branchId);
    }, [branches, order.branchId, isLoadingBranches]);

    useEffect(() => {
        setIsMounted(true);
        if (shouldOpenOnMount) {
            setOpen(true);
        }
    }, [shouldOpenOnMount]);

    useEffect(() => {
        if (open && shouldOpenOnMount) {
            const timer = setTimeout(() => {
                handlePrint();
            }, 100); 
            return () => clearTimeout(timer);
        }
    }, [open, shouldOpenOnMount]);
    
    if (!isMounted || isLoadingSettings || isLoadingBranches) {
        return <>{trigger}</>
    }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>معاينة طباعة الإيصال</DialogTitle>
          <DialogDescription>
            هذه هي الطريقة التي سيبدو بها الإيصال عند الطباعة.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-start gap-6 py-4 bg-muted rounded-md max-h-[65vh] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-primary/20">
            <ReceiptContent ref={componentRef} order={order} settings={settings} orderBranch={orderBranch} />
        </div>
        <DialogFooter>
          <Button type="button" onClick={handlePrint} className="w-full">طباعة الإيصال</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
