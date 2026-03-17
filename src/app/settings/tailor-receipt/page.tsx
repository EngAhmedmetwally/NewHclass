
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
import { useSettings } from '@/hooks/use-settings';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ScrollText } from 'lucide-react';
import { AuthLayout } from '@/components/app-layout';

export default function TailorReceiptPage() {
    const { appUser, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const { settings, updateSetting, isLoading } = useSettings();
    
    const [currentDate, setCurrentDate] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');

    useEffect(() => {
        setIsMounted(true);
        const today = new Date();
        const delivery = new Date();
        delivery.setDate(today.getDate() + 5);

        setCurrentDate(today.toLocaleDateString('ar-EG'));
        setDeliveryDate(delivery.toLocaleDateString('ar-EG'));
    }, []);

    const handleSave = () => {
        toast({
            title: "تم حفظ الإعدادات",
            description: "تم تحديث تصميم وصل الخياط بنجاح.",
        });
    };

    if (!isMounted || isLoading || isUserLoading) {
        return (
            <AuthLayout>
                <div className="flex flex-col gap-8">
                    <PageHeader title="تصميم وصل الخياط" showBackButton>
                        <Skeleton className="h-10 w-24" />
                    </PageHeader>
                    <div className="grid md:grid-cols-3 gap-8">
                        <Skeleton className="md:col-span-1 h-[600px]" />
                        <Skeleton className="md:col-span-2 h-[600px]" />
                    </div>
                </div>
            </AuthLayout>
        );
    }
    
    if (!appUser || appUser.username !== 'admin') {
      return (
        <AuthLayout>
            <div className="flex flex-col gap-8">
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
        tailor_showLogo: showLogo,
        tailor_showShopName: showShopName,
        tailor_shopName: shopName,
        tailor_showContact: showContact,
        tailor_contactInfo: contactInfo,
        tailor_disclaimer: disclaimer,
    } = settings;

  return (
    <AuthLayout>
        <div className="flex flex-col gap-8">
        <PageHeader title="تصميم وصل الخياط" showBackButton>
            <Button onClick={handleSave}>حفظ التغييرات</Button>
        </PageHeader>
            <div className="grid md:grid-cols-3 gap-8 items-start">
                {/* Preview */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center gap-2 px-2 text-muted-foreground">
                        <ScrollText className="h-4 w-4" />
                        <span className="text-sm font-medium">معاينة وصل الخياط</span>
                    </div>
                    <div className="bg-muted rounded-lg shadow-inner p-4 flex justify-center max-h-[80vh] overflow-y-auto border border-dashed border-muted-foreground/20">
                        <div className="w-[360px] bg-white text-black p-4 border-2 border-dashed border-neutral-400 font-headline text-right shadow-xl h-fit">
                            <div className="text-center mb-4">
                                {showShopName && <h2 className="text-2xl font-bold font-headline">{shopName}</h2>}
                                {showContact && <p className="text-sm mt-1">{contactInfo}</p>}
                            </div>

                            <div style={{ borderBottom: '1.5px dashed #000', margin: '10px 0' }}></div>

                            <div className="space-y-2 text-base">
                                <div className="flex justify-between">
                                    <span>رقم الطلب:</span>
                                    <span className="font-bold">700000001</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>التاريخ:</span>
                                    <span>{currentDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>اسم العميل:</span>
                                    <span className="font-bold">علياء مصطفى</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>رقم الهاتف:</span>
                                    <span>01012345678</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span>موعد التسليم:</span>
                                    <span className="font-bold">{deliveryDate}</span>
                                </div>
                            </div>
                            
                            <div style={{ borderBottom: '1.5px dashed #000', margin: '10px 0' }}></div>

                            <h3 className="font-bold text-xl mb-3">تفاصيل التعديلات:</h3>
                            <div className="border border-black p-3 min-h-[120px] text-lg leading-relaxed">
                                <p className="font-bold mb-1">فستان سهرة ذهبي - مقاس XL</p>
                                <p>- تضييق منطقة الخصر 2 سم.</p>
                                <p>- تقصير طول الفستان 5 سم.</p>
                                <p>- تركيب حزام إضافي.</p>
                            </div>

                            <div style={{ borderBottom: '1.5px dashed #000', margin: '15px 0' }}></div>
                            <p className="text-sm text-center font-medium whitespace-pre-wrap">{disclaimer}</p>
                            
                            <div style={{ borderTop: '1px solid #000', marginTop: '20px', paddingTop: '10px', textAlign: 'center', fontSize: '12px' }}>
                                www.codlink.online
                            </div>
                        </div>
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
                                    <Switch id="showShopName" checked={showShopName} onCheckedChange={(v) => updateSetting('tailor_showShopName', v)} />
                                    <Label htmlFor="showShopName">عرض اسم المحل</Label>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="shopName">اسم المحل</Label>
                                    <Input id="shopName" value={shopName} onChange={(e) => updateSetting('tailor_shopName', e.target.value)} disabled={!showShopName}/>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch id="showContact" checked={showContact} onCheckedChange={(v) => updateSetting('tailor_showContact', v)} />
                                    <Label htmlFor="showContact">عرض بيانات التواصل</Label>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="contactInfo">بيانات التواصل (الهاتف/العنوان)</Label>
                                    <Input id="contactInfo" value={contactInfo} onChange={(e) => updateSetting('tailor_contactInfo', e.target.value)} disabled={!showContact}/>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="showLogo" checked={showLogo} onCheckedChange={(v) => updateSetting('tailor_showLogo', v)} />
                                <Label htmlFor="showLogo">عرض الشعار (الأسود)</Label>
                            </div>
                        </div>

                        <Separator/>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="disclaimer" className="font-semibold">نص التنبيهات والشروط</Label>
                            <Textarea id="disclaimer" value={disclaimer} onChange={(e) => updateSetting('tailor_disclaimer', e.target.value)} rows={4} placeholder="الشروط والأحكام التي تظهر في نهاية الوصل..."/>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AuthLayout>
  );
}
