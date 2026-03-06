
'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HiClassLogo } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings, type AppSettings } from '@/hooks/use-settings';

export default function TailorReceiptPage() {
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


    const [currentDate, setCurrentDate] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');

    useEffect(() => {
        const today = new Date();
        const delivery = new Date();
        delivery.setDate(today.getDate() + 5);

        setCurrentDate(today.toLocaleDateString('ar-EG'));
        setDeliveryDate(delivery.toLocaleDateString('ar-EG'));
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
                description: "تم تحديث تصميم وصل الخياط بنجاح.",
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
        tailor_showLogo,
        tailor_showShopName,
        tailor_shopName,
        tailor_showContact,
        tailor_contactInfo,
        tailor_disclaimer,
    } = localSettings;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تصميم وصل الخياط" showBackButton>
        <Button onClick={handleSave}>حفظ التغييرات</Button>
      </PageHeader>
        <div className="grid md:grid-cols-3 gap-8">
            {/* Preview */}
            <div className="md:col-span-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-4 flex items-center justify-center">
                 <div className="w-[360px] mx-auto bg-white text-black p-4 border-2 border-dashed border-neutral-400 font-serif text-right">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-right">
                            <h2 className="text-2xl font-bold font-headline">وصل استلام للخياط</h2>
                            {tailor_showShopName && <p className="text-sm">{tailor_shopName}</p>}
                            {tailor_showContact && <p className="text-sm">{tailor_contactInfo}</p>}
                        </div>
                        {tailor_showLogo && <HiClassLogo className="w-20 h-20" />}
                    </div>

                    <Separator className="border-black my-2"/>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-md">
                        <div><span className="font-semibold">رقم الطلب:</span> 700000001</div>
                        <div><span className="font-semibold">التاريخ:</span> {currentDate}</div>
                        <div><span className="font-semibold">اسم العميل:</span> علياء مصطفى</div>
                        <div><span className="font-semibold">رقم الهاتف:</span> 01012345678</div>
                        <div className="col-span-2"><span className="font-semibold">تاريخ التسليم المتوقع:</span> {deliveryDate}</div>
                    </div>
                    
                    <Separator className="border-black my-2"/>

                    <h3 className="font-bold text-lg mb-2">تفاصيل التعديلات:</h3>
                    <div className="border border-black p-2 min-h-[100px] text-md leading-relaxed">
                        <p>- تضييق منطقة الخصر 2 سم.</p>
                        <p>- تقصير طول الفستان 5 سم.</p>
                        <p>- تركيب حزام إضافي.</p>
                    </div>

                    <div className="mt-4 text-center">
                        <p className="font-semibold">إجمالي التكلفة: 250 ج.م</p>
                        <p className="font-semibold">المدفوع: 100 ج.م</p>
                        <p className="font-bold text-lg">المتبقي: 150 ج.م</p>
                    </div>
                     <Separator className="border-dashed border-black my-3"/>
                     <p className="text-xs text-center whitespace-pre-wrap">{tailor_disclaimer}</p>
                 </div>
            </div>

            {/* Settings */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>إعدادات وصل الخياط</CardTitle>
                    <CardDescription>تحكم في العناصر التي تظهر في وصل الخياط المطبوع.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-8">
                     <div className="grid gap-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="showShopName" checked={tailor_showShopName} onCheckedChange={(v) => handleSwitchChange('tailor_showShopName', v)} />
                                <Label htmlFor="showShopName">عرض اسم المحل</Label>
                            </div>
                             <div className="flex flex-col gap-2">
                                <Label htmlFor="shopName">اسم المحل</Label>
                                <Input id="shopName" value={tailor_shopName} onChange={(e) => handleInputChange('tailor_shopName', e.target.value)} disabled={!tailor_showShopName}/>
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="showContact" checked={tailor_showContact} onCheckedChange={(v) => handleSwitchChange('tailor_showContact', v)} />
                                <Label htmlFor="showContact">عرض بيانات التواصل</Label>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="contactInfo">بيانات التواصل (الهاتف/العنوان)</Label>
                                <Input id="contactInfo" value={tailor_contactInfo} onChange={(e) => handleInputChange('tailor_contactInfo', e.target.value)} disabled={!tailor_showContact}/>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showLogo" checked={tailor_showLogo} onCheckedChange={(v) => handleSwitchChange('tailor_showLogo', v)} />
                            <Label htmlFor="showLogo">عرض الشعار</Label>
                        </div>
                    </div>

                    <Separator/>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="disclaimer" className="font-semibold">نص التنبيهات والشروط</Label>
                        <Textarea id="disclaimer" value={tailor_disclaimer} onChange={(e) => handleInputChange('tailor_disclaimer', e.target.value)} rows={4} placeholder="الشروط والأحكام التي تظهر في نهاية الوصل..."/>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
