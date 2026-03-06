'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useSettings, type AppSettings } from '@/hooks/use-settings';
import { mmToPx, ptToPx } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Shield, Settings2, Move, Type, Hash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthLayout } from '@/components/app-layout';


export default function LabelPrintPage() {
    const { appUser, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const { settings, updateSettings, isLoading } = useSettings();
    
    const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>(settings);
    const barcodeRef = useRef<SVGSVGElement>(null);

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
        if (barcodeRef.current && localSettings.label_barcode_sample) {
            try {
                JsBarcode(barcodeRef.current, localSettings.label_barcode_sample, {
                    format: 'CODE128',
                    displayValue: false,
                    width: 2,
                    height: mmToPx(localSettings.label_barcodeHeight_mm || 10),
                    margin: 0,
                    background: '#ffffff',
                });
            } catch (e) {
                // Barcode generation can fail with invalid characters, ignore for live preview
            }
        }
    }, [localSettings, isMounted]);

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

    if (!isMounted || isLoading || isUserLoading) {
        return (
            <AuthLayout>
                 <div className="flex flex-col gap-8" dir="rtl">
                    <PageHeader title="تصميم طباعة الملصقات" showBackButton>
                        <Skeleton className="h-10 w-24" />
                    </PageHeader>
                    <div className="grid md:grid-cols-3 gap-8">
                        <Skeleton className="md:col-span-1 h-[400px]" />
                        <Skeleton className="md:col-span-2 h-[600px]" />
                    </div>
                </div>
            </AuthLayout>
        );
    }
    
    if (!appUser || appUser.username !== 'admin') {
      return (
        <AuthLayout>
            <div className="flex flex-col gap-8" dir="rtl">
                <PageHeader title="غير مصرح لك" showBackButton />
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-4">
                        <Shield className="h-12 w-12 text-destructive" />
                        <p className="font-semibold">هذه الصفحة متاحة للمدير (admin) فقط.</p>
                        <Button onClick={() => router.push('/home')} className="mt-4">العودة إلى الرئيسية</Button>
                    </CardContent>
                </Card>
            </div>
        </AuthLayout>
      );
    }


    const {
        label_showPrice: showPrice,
        label_showSize: showSize,
        label_showBarcodeLines: showBarcodeLines,
        label_barcode_sample: barcode,
        label_width_mm: labelWidth,
        label_height_mm: labelHeight,
    } = localSettings;

  return (
    <AuthLayout>
        <div className="flex flex-col gap-8" dir="rtl">
        <PageHeader title="تصميم طباعة الملصقات" showBackButton>
            <Button onClick={handleSave}>حفظ التغييرات</Button>
        </PageHeader>
            <div className="grid md:grid-cols-3 gap-8">
                {/* Label Preview */}
                <div className="md:col-span-1 bg-muted rounded-lg shadow-lg p-8 flex flex-col items-center justify-center gap-4">
                    <div className="text-xs text-muted-foreground mb-2">معاينة مباشرة (المقاسات بالـ مم)</div>
                    <div
                        className="bg-white text-black p-0 relative shadow-2xl overflow-hidden"
                        style={{ 
                            width: `${mmToPx(labelWidth || 35)}px`, 
                            height: `${mmToPx(labelHeight || 25)}px`,
                            margin: 0,
                            padding: 0
                        }}
                    >
                        {/* Product Name */}
                        <p className="font-bold text-center w-full" style={{
                            position: 'absolute',
                            left: `${mmToPx(localSettings.label_productName_x_mm || 0)}px`,
                            top: `${mmToPx(localSettings.label_productName_y_mm || 0)}px`,
                            transform: 'translateX(-50%)',
                            fontSize: `${ptToPx(localSettings.label_productNameFontSize_pt || 10)}px`,
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                            margin: 0,
                            padding: 0
                        }}>{productName}</p>

                        {/* Price */}
                        {showPrice && (
                            <p className="font-bold text-center w-full" style={{
                                position: 'absolute',
                                left: `${mmToPx(localSettings.label_price_x_mm || 0)}px`,
                                top: `${mmToPx(localSettings.label_price_y_mm || 0)}px`,
                                transform: 'translateX(-50%)',
                                fontSize: `${ptToPx(localSettings.label_detailsFontSize_pt || 8)}px`,
                                whiteSpace: 'nowrap',
                                margin: 0,
                                padding: 0
                            }}>{price}</p>
                        )}
                        
                        {/* Size */}
                        {showSize && (
                             <p className="text-center w-full" style={{
                                position: 'absolute',
                                left: `${mmToPx(localSettings.label_size_x_mm || 0)}px`,
                                top: `${mmToPx(localSettings.label_size_y_mm || 0)}px`,
                                transform: 'translateX(-50%)',
                                fontSize: `${ptToPx(localSettings.label_detailsFontSize_pt || 8)}px`,
                                whiteSpace: 'nowrap',
                                margin: 0,
                                padding: 0
                            }}>المقاس: {size}</p>
                        )}

                        {/* Barcode Lines */}
                         <div style={{
                            position: 'absolute',
                            left: `${mmToPx(localSettings.label_barcode_x_mm || 0)}px`,
                            top: `${mmToPx(localSettings.label_barcode_y_mm || 0)}px`,
                            transform: 'translateX(-50%)',
                            width: '90%',
                            display: showBarcodeLines ? 'block' : 'none'
                         }}>
                            <svg ref={barcodeRef} id="barcode" className="w-full"></svg>
                         </div>
                        
                        {/* Barcode Value */}
                        <p className="font-mono tracking-widest text-center w-full" style={{
                            position: 'absolute',
                            left: `${mmToPx(localSettings.label_barcodeValue_x_mm || 0)}px`,
                            top: `${mmToPx(localSettings.label_barcodeValue_y_mm || 0)}px`,
                            transform: 'translateX(-50%)',
                            fontSize: `${ptToPx(localSettings.label_barcodeValueFontSize_pt || 7)}px`,
                            whiteSpace: 'nowrap',
                            margin: 0,
                            padding: 0
                        }}>{barcode}</p>

                    </div>
                </div>

                {/* Label Settings */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> إعدادات الملصق</CardTitle>
                        <CardDescription>تحكم في مظهر وأبعاد ومحتوى الملصق المطبوع بدقة وبدون أي هوامش تلقائية.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-8">
                        {/* General Settings */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Label className="font-bold text-base">الأبعاد الأساسية</Label>
                                <Separator className="flex-1" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="labelWidth">عرض الملصق (مم)</Label>
                                    <Input id="labelWidth" type="number" value={labelWidth} onChange={(e) => handleInputChange('label_width_mm', parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="labelHeight">ارتفاع الملصق (مم)</Label>
                                    <Input id="labelHeight" type="number" value={labelHeight} onChange={(e) => handleInputChange('label_height_mm', parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                                <div className="flex items-center gap-2 border p-3 rounded-md">
                                    <Switch id="showPrice" checked={showPrice} onCheckedChange={(v) => handleSwitchChange('label_showPrice', v)} />
                                    <Label htmlFor="showPrice">عرض السعر</Label>
                                </div>
                                <div className="flex items-center gap-2 border p-3 rounded-md">
                                    <Switch id="showSize" checked={showSize} onCheckedChange={(v) => handleSwitchChange('label_showSize', v)} />
                                    <Label htmlFor="showSize">عرض المقاس</Label>
                                </div>
                                <div className="flex items-center gap-2 border p-3 rounded-md">
                                    <Switch id="showBarcodeLines" checked={showBarcodeLines} onCheckedChange={(v) => handleSwitchChange('label_showBarcodeLines', v)} />
                                    <Label htmlFor="showBarcodeLines">عرض خطوط الباركود</Label>
                                </div>
                            </div>
                        </div>

                        {/* Product Name Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Label className="font-bold text-base">تنسيق اسم المنتج</Label>
                                <Separator className="flex-1" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1"><Type className="h-3 w-3" /> حجم الخط (نقطة)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_productNameFontSize_pt} onChange={(e) => handleInputChange('label_productNameFontSize_pt', parseFloat(e.target.value))} />
                                </div>
                                 <div className="space-y-2">
                                    <Label className="flex items-center gap-1"><Move className="h-3 w-3" /> الموضع الأفقي X (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_productName_x_mm} onChange={(e) => handleInputChange('label_productName_x_mm', parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1"><Move className="h-3 w-3 rotate-90" /> الموضع الرأسي Y (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_productName_y_mm} onChange={(e) => handleInputChange('label_productName_y_mm', parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* Details Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Label className="font-bold text-base">تنسيق السعر والمقاس</Label>
                                <Separator className="flex-1" />
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg space-y-6">
                                <div className="max-w-[200px] space-y-2">
                                    <Label>حجم خط التفاصيل (نقطة)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_detailsFontSize_pt} onChange={(e) => handleInputChange('label_detailsFontSize_pt', parseFloat(e.target.value))} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {showPrice && (
                                        <div className="p-3 border rounded-md bg-white dark:bg-neutral-900">
                                            <Label className="text-primary font-bold block mb-3">إحداثيات السعر</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">أفقي X</Label>
                                                    <Input type="number" step="0.5" value={localSettings.label_price_x_mm} onChange={(e) => handleInputChange('label_price_x_mm', parseFloat(e.target.value))} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">رأسي Y</Label>
                                                    <Input type="number" step="0.5" value={localSettings.label_price_y_mm} onChange={(e) => handleInputChange('label_price_y_mm', parseFloat(e.target.value))} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {showSize && (
                                        <div className="p-3 border rounded-md bg-white dark:bg-neutral-900">
                                            <Label className="text-secondary font-bold block mb-3">إحداثيات المقاس</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">أفقي X</Label>
                                                    <Input type="number" step="0.5" value={localSettings.label_size_x_mm} onChange={(e) => handleInputChange('label_size_x_mm', parseFloat(e.target.value))} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">رأسي Y</Label>
                                                    <Input type="number" step="0.5" value={localSettings.label_size_y_mm} onChange={(e) => handleInputChange('label_size_y_mm', parseFloat(e.target.value))} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                         {/* Barcode Lines Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Label className="font-bold text-base">تنسيق خطوط الباركود</Label>
                                <Separator className="flex-1" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
                                <div className="space-y-2">
                                    <Label>ارتفاع الخطوط (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcodeHeight_mm} onChange={(e) => handleInputChange('label_barcodeHeight_mm', parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>الموضع الأفقي X (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcode_x_mm} onChange={(e) => handleInputChange('label_barcode_x_mm', parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>الموضع الرأسي Y (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcode_y_mm} onChange={(e) => handleInputChange('label_barcode_y_mm', parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* Barcode Value Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Label className="font-bold text-base">تنسيق رقم الباركود</Label>
                                <Separator className="flex-1" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
                                 <div className="space-y-2">
                                    <Label className="flex items-center gap-1"><Hash className="h-3 w-3" /> عينة للمعاينة</Label>
                                    <Input value={localSettings.label_barcode_sample} onChange={(e) => handleInputChange('label_barcode_sample', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>حجم الخط (نقطة)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcodeValueFontSize_pt} onChange={(e) => handleInputChange('label_barcodeValueFontSize_pt', parseFloat(e.target.value))} />
                                </div>
                                 <div className="space-y-2">
                                    <Label>أفقي X (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcodeValue_x_mm} onChange={(e) => handleInputChange('label_barcodeValue_x_mm', parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>رأسي Y (مم)</Label>
                                    <Input type="number" step="0.5" value={localSettings.label_barcodeValue_y_mm} onChange={(e) => handleInputChange('label_barcodeValue_y_mm', parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AuthLayout>
  );
}
