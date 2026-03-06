
'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import React, { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useSettings, type AppSettings } from '@/hooks/use-settings';

// Standard DPI for screen-to-print conversion
const DPI = 96;
const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

const mmToPx = (mm: number) => (mm / MM_PER_INCH) * DPI;
const ptToPx = (pt: number) => (pt / PT_PER_INCH) * DPI;


export default function LabelPrintPage() {
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const { settings, updateSettings, isLoading } = useSettings();
    
    const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});

    useEffect(() => {
        setIsMounted(true);
        if (!isLoading) {
            setLocalSettings(settings);
        }
    }, [isLoading, settings]);
    
    // Preview Data
    const [productName] = useState('فستان سهرة ذهبي');
    const [price] = useState('1500 ج.م');
    const [size] = useState('M');
    
    useEffect(() => {
        if (!isMounted || !localSettings.label_barcode_sample) return;
        try {
            JsBarcode('#barcode', localSettings.label_barcode_sample, {
                format: 'CODE128',
                displayValue: false,
                width: 2,
                height: mmToPx(localSettings.label_barcodeHeight_mm || 10),
                margin: 0,
            });
        } catch (e) {
            console.error('Barcode generation failed:', e);
        }
    }, [localSettings.label_barcode_sample, localSettings.label_barcodeHeight_mm, isMounted]);

    const handleInputChange = (key: keyof AppSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSwitchChange = (key: keyof AppSettings, checked: boolean) => {
        setLocalSettings(prev => ({ ...prev, [key]: checked }));
    };

    const handleSave = async () => {
        try {
            await updateSettings(localSettings);
            toast({
                title: "تم حفظ الإعدادات",
                description: "تم تحديث تصميم ملصق الطباعة بنجاح.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "خطأ في الحفظ",
                description: "لم يتم حفظ الإعدادات: " + error.message,
            });
        }
    };

    if (!isMounted || isLoading) {
        return null; // or a loading skeleton
    }

    const {
        label_showPrice: showPrice,
        label_showSize: showSize,
        label_barcode_sample: barcode,
        label_width_mm: labelWidth,
        label_height_mm: labelHeight,
        label_barcodeHeight_mm: barcodeHeight,
        label_textAlign: textAlign,
        label_productNameFontSize_pt: productNameFontSize,
        label_detailsFontSize_pt: detailsFontSize,
        label_barcodeValueFontSize_pt: barcodeValueFontSize,
    } = localSettings;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تصميم طباعة الملصقات" showBackButton>
         <Button onClick={handleSave}>حفظ التغييرات</Button>
      </PageHeader>
        <div className="grid md:grid-cols-3 gap-8">
            {/* Label Preview */}
            <div className="md:col-span-1 bg-muted rounded-lg shadow-lg p-8 flex items-center justify-center">
                 <div
                    className="bg-white text-black p-3 border-2 border-dashed border-neutral-400 flex flex-col justify-center"
                    style={{ 
                        width: `${mmToPx(labelWidth || 60)}px`, 
                        height: `${mmToPx(labelHeight || 40)}px`,
                        textAlign: textAlign,
                    }}
                >
                    <p className="font-bold" style={{ fontSize: `${ptToPx(productNameFontSize || 12)}px`, lineHeight: 1.2 }}>{productName}</p>
                    {showSize && <p style={{ fontSize: `${ptToPx(detailsFontSize || 9)}px` }}>المقاس: {size}</p>}
                    {showPrice && <p className="font-bold" style={{ fontSize: `${ptToPx(detailsFontSize || 9)}px`, marginTop: '4px' }}>{price}</p>}
                    <svg id="barcode" className="w-full" style={{ height: `${mmToPx(barcodeHeight || 10)}px`, marginTop: '8px' }}></svg>
                    <p className="font-mono tracking-widest" style={{ fontSize: `${ptToPx(barcodeValueFontSize || 8)}px`}}>{barcode}</p>
                 </div>
            </div>

            {/* Label Settings */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>إعدادات الملصق</CardTitle>
                    <CardDescription>تحكم في مظهر وأبعاد ومحتوى الملصق المطبوع.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-8">
                     <div>
                        <Label className="font-semibold text-base">الأبعاد والمحاذاة</Label>
                        <Separator className="my-2"/>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="labelWidth">عرض الملصق (مم)</Label>
                                <Input id="labelWidth" type="number" value={labelWidth} onChange={(e) => handleInputChange('label_width_mm', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="labelHeight">ارتفاع الملصق (مم)</Label>
                                <Input id="labelHeight" type="number" value={labelHeight} onChange={(e) => handleInputChange('label_height_mm', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="textAlign">محاذاة النص</Label>
                                <Select value={textAlign} onValueChange={(v) => handleInputChange('label_textAlign', v as any)}>
                                    <SelectTrigger id="textAlign">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="center">وسط</SelectItem>
                                        <SelectItem value="right">يمين</SelectItem>
                                        <SelectItem value="left">يسار</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                     <div>
                        <Label className="font-semibold text-base">محتوى الملصق</Label>
                        <Separator className="my-2"/>
                         <div className="grid gap-6 mt-4">
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch id="showPrice" checked={showPrice} onCheckedChange={(v) => handleSwitchChange('label_showPrice', v)} />
                                    <Label htmlFor="showPrice">عرض السعر</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch id="showSize" checked={showSize} onCheckedChange={(v) => handleSwitchChange('label_showSize', v)} />
                                    <Label htmlFor="showSize">عرض المقاس</Label>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="productNameFontSize">حجم خط اسم المنتج (نقطة)</Label>
                                    <Input id="productNameFontSize" type="number" value={productNameFontSize} onChange={(e) => handleInputChange('label_productNameFontSize_pt', parseInt(e.target.value) || 12)} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="detailsFontSize">حجم خط التفاصيل (نقطة)</Label>
                                    <Input id="detailsFontSize" type="number" value={detailsFontSize} onChange={(e) => handleInputChange('label_detailsFontSize_pt', parseInt(e.target.value) || 9)} />
                                </div>
                            </div>
                         </div>
                    </div>
                    <div>
                        <Label className="font-semibold text-base">الباركود</Label>
                        <Separator className="my-2"/>
                         <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="barcodeValue">قيمة الباركود (للمعاينة)</Label>
                                <Input id="barcodeValue" value={barcode} onChange={(e) => handleInputChange('label_barcode_sample', e.target.value)} />
                            </div>
                             <div className="flex flex-col gap-2">
                                <Label htmlFor="barcodeHeight">ارتفاع الباركود (مم)</Label>
                                <Input id="barcodeHeight" type="number" value={barcodeHeight} onChange={(e) => handleInputChange('label_barcodeHeight_mm', parseInt(e.target.value) || 10)} />
                            </div>
                             <div className="flex flex-col gap-2">
                                <Label htmlFor="barcodeValueFontSize">حجم خط قيمة الباركود (نقطة)</Label>
                                <Input id="barcodeValueFontSize" type="number" value={barcodeValueFontSize} onChange={(e) => handleInputChange('label_barcodeValueFontSize_pt', parseInt(e.target.value) || 8)} />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">ملاحظة: سيتم تحديث معاينة الباركود تلقائيًا عند تغيير القيمة.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
