
'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HiClassLogo, WhatsappIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings, type AppSettings } from '@/hooks/use-settings';

export default function CashierReceiptPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const { settings, updateSetting, updateSettings, isLoading } = useSettings();

  // Local state for form inputs to avoid re-rendering the entire page on each keystroke
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    setIsMounted(true);
    if (!isLoading) {
      setLocalSettings(settings);
    }
  }, [isLoading, settings]);

  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('ar-EG'));
  }, []);

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
        description: "تم تحديث تصميم إيصال الكاشير بنجاح.",
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
      receipt_showHeader,
      receipt_showLogo,
      receipt_showShopName,
      receipt_showAddress,
      receipt_showPhone,
      receipt_showWhatsapp,
      receipt_showOrderNumber,
      receipt_showSeller,
      receipt_showCustomerInfo,
      receipt_headerText,
      receipt_footerText,
  } = localSettings;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تصميم إيصال الكاشير" showBackButton>
        <Button onClick={handleSave}>حفظ التغييرات</Button>
      </PageHeader>
      <div className="grid md:grid-cols-3 gap-8">
        {/* Receipt Preview */}
        <div className="md:col-span-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-4">
          <div className="w-[302px] mx-auto bg-white text-black p-3 font-mono text-right text-sm">
            {receipt_showHeader && (
                 <div className="text-center mb-4">
                    {receipt_showLogo && <HiClassLogo className="text-5xl text-blue-600" />}
                    {receipt_showShopName && <h2 className="text-lg font-bold font-headline -mt-2">{receipt_headerText}</h2>}
                    {receipt_showAddress && <p className="text-xs mt-1">اسم الفرع هنا</p>}
                    <div className="flex items-center justify-center gap-x-4 gap-y-1 mt-2 text-xs">
                        {receipt_showPhone && <p className="font-mono">01234567890</p>}
                        {receipt_showWhatsapp && <p className="font-mono">01122334455</p>}
                    </div>
                </div>
            )}
            <Separator className="border-dashed border-black my-2" />
             <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span>{currentDate}</span>
                </div>
                {receipt_showOrderNumber && (
                    <div className="flex justify-between">
                        <span>رقم الطلب:</span>
                        <span>70000001</span>
                    </div>
                )}
                 {receipt_showCustomerInfo && (
                     <div className="flex justify-between">
                        <span>العميل:</span>
                        <span>اسم العميل</span>
                    </div>
                 )}
                {receipt_showSeller && (
                    <div className="flex justify-between">
                        <span>البائع:</span>
                        <span>اسم البائع</span>
                    </div>
                 )}
            </div>
            
            <Separator className="border-dashed border-black my-2" />
            
            {/* Items */}
            <div className="space-y-2 text-xs">
                <div className="grid grid-cols-12 gap-1 font-semibold">
                    <span className="col-span-8">الصنف</span>
                    <span className="col-span-2 text-center">الكمية</span>
                    <span className="col-span-2 text-left">السعر</span>
                </div>
                <Separator className="border-dashed border-black"/>
                 <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-8 font-light flex flex-col">
                        <span>فستان سهرة طويل جدا</span>
                        <span className="text-muted-foreground text-[10px] pr-2">مقاس 42 (90000001)</span>
                    </div>
                    <span className="col-span-2 text-center font-light">1</span>
                    <span className="col-span-2 text-left font-light">5,000</span>
                </div>
            </div>

             <Separator className="border-dashed border-black my-2" />

            {/* Totals */}
            <div className="space-y-1 text-xs">
                 <div className="flex justify-between font-semibold">
                    <span>الإجمالي الفرعي:</span>
                    <span>5,000</span>
                </div>
                <div className="flex justify-between font-semibold">
                    <span>الخصم:</span>
                    <span>0</span>
                </div>
                <div className="flex justify-between font-bold text-sm my-1">
                    <span>الإجمالي:</span>
                    <span>5,000</span>
                </div>
                 <div className="flex justify-between">
                    <span>المدفوع:</span>
                    <span>3,333</span>
                </div>
                 <div className="flex justify-between font-bold">
                    <span>المتبقي:</span>
                    <span>1,667</span>
                </div>
            </div>

             <Separator className="border-dashed border-black my-2" />
             <div className="text-center whitespace-pre-wrap text-[10px] mt-4">
                {receipt_footerText?.replace(/\\n/g, '\n')}
             </div>
          </div>
        </div>

        {/* Receipt Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>إعدادات محتوى الإيصال</CardTitle>
            <CardDescription>تحكم في العناصر التي تظهر في إيصال الكاشير المطبوع.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8">
             <div className="grid gap-6">
                <div className="flex items-center gap-2">
                    <Switch id="showHeader" checked={receipt_showHeader} onCheckedChange={(v) => handleSwitchChange('receipt_showHeader', v)} />
                    <Label htmlFor="showHeader" className="font-semibold">عرض قسم الترويسة بالكامل</Label>
                </div>
                {receipt_showHeader && (
                    <div className="grid gap-6 pl-8">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="showShopName" checked={receipt_showShopName} onCheckedChange={(v) => handleSwitchChange('receipt_showShopName', v)} />
                                <Label htmlFor="showShopName">عرض اسم المحل</Label>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="headerText">نص اسم المحل</Label>
                                <Input id="headerText" value={receipt_headerText} onChange={(e) => handleInputChange('receipt_headerText', e.target.value)} disabled={!receipt_showShopName} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showLogo" checked={receipt_showLogo} onCheckedChange={(v) => handleSwitchChange('receipt_showLogo', v)} />
                            <Label htmlFor="showLogo">عرض الشعار (اللوجو)</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showAddress" checked={receipt_showAddress} onCheckedChange={(v) => handleSwitchChange('receipt_showAddress', v)} />
                            <Label htmlFor="showAddress">عرض العنوان</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showPhone" checked={receipt_showPhone} onCheckedChange={(v) => handleSwitchChange('receipt_showPhone', v)} />
                            <Label htmlFor="showPhone">عرض رقم الهاتف</Label>
                        </div>
                         <div className="flex items-center gap-2">
                            <Switch id="showWhatsapp" checked={receipt_showWhatsapp} onCheckedChange={(v) => handleSwitchChange('receipt_showWhatsapp', v)} />
                            <Label htmlFor="showWhatsapp">عرض رقم واتساب</Label>
                        </div>
                    </div>
                )}
             </div>

            <Separator/>

            <div className="grid gap-4">
                <div className="flex items-center gap-2">
                    <Switch id="showOrderNumber" checked={receipt_showOrderNumber} onCheckedChange={(v) => handleSwitchChange('receipt_showOrderNumber', v)} />
                    <Label htmlFor="showOrderNumber">عرض رقم الطلب</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="showSeller" checked={receipt_showSeller} onCheckedChange={(v) => handleSwitchChange('receipt_showSeller', v)} />
                    <Label htmlFor="showSeller">عرض اسم البائع</Label>
                </div>
                 <div className="flex items-center gap-2">
                    <Switch id="showCustomerInfo" checked={receipt_showCustomerInfo} onCheckedChange={(v) => handleSwitchChange('receipt_showCustomerInfo', v)} />
                    <Label htmlFor="showCustomerInfo">عرض بيانات العميل</Label>
                </div>
            </div>

            <Separator/>
            
            <div className="flex flex-col gap-2">
                <Label htmlFor="footerText" className="font-semibold">نص التذييل</Label>
                <Textarea id="footerText" value={receipt_footerText} onChange={(e) => handleInputChange('receipt_footerText', e.target.value)} rows={4} placeholder="الشروط والأحكام، رسائل الشكر، إلخ..."/>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
