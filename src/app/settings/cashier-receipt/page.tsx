
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
import { AuthLayout } from '@/components/app-layout';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Shield, Type } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function CashierReceiptPageContent() {
  const { appUser, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const { settings, updateSetting, isLoading } = useSettings();

  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setIsMounted(true);
    setCurrentDate(new Date().toLocaleDateString('ar-EG'));
  }, []);

  const handleSave = () => {
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم تحديث تصميم إيصال الكاشير بنجاح.",
    });
  };

  if (!isMounted || isLoading || isUserLoading) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="تصميم إيصال الكاشير" showBackButton>
                <Skeleton className="h-10 w-24" />
            </PageHeader>
            <div className="grid md:grid-cols-3 gap-8">
                <Skeleton className="md:col-span-1 h-[600px]" />
                <Skeleton className="md:col-span-2 h-[600px]" />
            </div>
        </div>
    );
  }

  if (!appUser || appUser.username !== 'admin') {
      return (
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
      );
  }
  
  const {
      receipt_showHeader: showHeader,
      receipt_showLogo: showLogo,
      receipt_showShopName: showShopName,
      receipt_showAddress: showAddress,
      receipt_showPhone: showPhone,
      receipt_showWhatsapp: showWhatsapp,
      receipt_showOrderNumber: showOrderNumber,
      receipt_showSeller: showSeller,
      receipt_showCustomerInfo: showCustomerInfo,
      receipt_headerText: headerText,
      receipt_footerText: footerText,
      receipt_shopNameFontSize_pt: shopNameFontSize,
      receipt_detailsFontSize_pt: detailsFontSize,
      receipt_itemsFontSize_pt: itemsFontSize,
      receipt_totalsFontSize_pt: totalsFontSize,
      receipt_footerFontSize_pt: footerFontSize,
  } = settings;

  const DottedSeparator = () => (
    <div style={{
        borderBottom: '1.5px dashed #000',
        margin: '8px 0',
        transform: 'scaleY(0.5)',
    }}></div>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="تصميم إيصال الكاشير" showBackButton>
        <Button onClick={handleSave}>حفظ التغييرات</Button>
      </PageHeader>
      <div className="grid md:grid-cols-3 gap-8">
        {/* Receipt Preview */}
        <div className="md:col-span-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-4">
          <div className="w-[320px] mx-auto bg-white text-black p-3 font-mono text-right text-sm">
            {showHeader && (
                 <div className="text-center mb-4">
                    {showLogo && <HiClassLogo className="w-16 h-16 mx-auto mb-2" />}
                    {showShopName && <h2 className="font-bold font-headline" style={{ fontSize: `${shopNameFontSize}pt` }}>{headerText}</h2>}
                    {showAddress && <p style={{ fontSize: `${detailsFontSize}pt` }}>123 شارع التحرير, القاهرة</p>}
                    <div className="flex items-center justify-center gap-4 mt-1" style={{ fontSize: `${detailsFontSize}pt` }}>
                        {showPhone && <p>01234567890</p>}
                        {showWhatsapp && <div className="flex items-center gap-1"><p>01122334455</p><WhatsappIcon className="h-3 w-3" /></div>}
                    </div>
                </div>
            )}
            <DottedSeparator />
            <div className="space-y-1" style={{ fontSize: `${detailsFontSize}pt` }}>
                <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span>{currentDate}</span>
                </div>
                {showOrderNumber && (
                    <div className="flex justify-between">
                        <span>رقم الطلب:</span>
                        <span>700000001</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>طريقة الدفع:</span>
                    <span className="font-bold">كاش + فودافون</span>
                </div>
                {showSeller && (
                    <div className="flex justify-between">
                        <span>البائع:</span>
                        <span>محمد حسن</span>
                    </div>
                )}
                {showCustomerInfo && (
                    <>
                    <DottedSeparator />
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>العميل:</span>
                            <span>علياء مصطفى</span>
                        </div>
                        <div className="flex justify-between">
                            <span>الهاتف:</span>
                            <span>01012345678</span>
                        </div>
                    </div>
                    </>
                )}
            </div>
            <DottedSeparator />
            {/* Items */}
            <div className="space-y-1" style={{ fontSize: `${itemsFontSize}pt` }}>
                <div className="grid grid-cols-5 gap-1 font-bold">
                    <span className="col-span-3">الصنف</span>
                    <span>كمية</span>
                    <span>سعر</span>
                </div>
                <DottedSeparator />
                <div className="grid grid-cols-5 gap-1">
                    <span className="col-span-3 font-light">فستان سهرة ذهبي</span>
                    <span className="font-light">1</span>
                    <span className="font-light">1500</span>
                </div>
            </div>
            <DottedSeparator />
            {/* Totals */}
            <div className="space-y-1" style={{ fontSize: `${totalsFontSize}pt` }}>
                 <div className="flex justify-between">
                    <span>الإجمالي الفرعي:</span>
                    <span>1500.00</span>
                </div>
                <div className="flex justify-between">
                    <span>الخصم:</span>
                    <span>0.00</span>
                </div>
                <div className="flex justify-between font-bold" style={{ fontSize: `${totalsFontSize! + 2}pt` }}>
                    <span>الإجمالي:</span>
                    <span>1500.00</span>
                </div>
                 <div className="flex justify-between">
                    <span>المدفوع:</span>
                    <span>1500.00</span>
                </div>
                 <div className="flex justify-between font-bold">
                    <span>المتبقي:</span>
                    <span>0.00</span>
                </div>
            </div>
            <DottedSeparator />
            <div className="text-center whitespace-pre-wrap mt-4" style={{ fontSize: `${footerFontSize}pt` }}>
                {footerText?.replace(/\\n/g, '\n')}
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
                    <Switch id="showHeader" checked={showHeader} onCheckedChange={(v) => updateSetting('receipt_showHeader', v)} />
                    <Label htmlFor="showHeader" className="font-semibold">عرض قسم الترويسة بالكامل</Label>
                </div>
                {showHeader && (
                    <div className="grid gap-6 pl-8">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="showShopName" checked={showShopName} onCheckedChange={(v) => updateSetting('receipt_showShopName', v)} />
                                <Label htmlFor="showShopName">عرض اسم المحل</Label>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="headerText">نص اسم المحل</Label>
                                <Input id="headerText" value={headerText} onChange={(e) => updateSetting('receipt_headerText', e.target.value)} disabled={!showShopName} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showLogo" checked={showLogo} onCheckedChange={(v) => updateSetting('receipt_showLogo', v)} />
                            <Label htmlFor="showLogo">عرض الشعار (اللوجو)</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showAddress" checked={showAddress} onCheckedChange={(v) => updateSetting('receipt_showAddress', v)} />
                            <Label htmlFor="showAddress">عرض العنوان</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="showPhone" checked={showPhone} onCheckedChange={(v) => updateSetting('receipt_showPhone', v)} />
                            <Label htmlFor="showPhone">عرض رقم الهاتف</Label>
                        </div>
                         <div className="flex items-center gap-2">
                            <Switch id="showWhatsapp" checked={showWhatsapp} onCheckedChange={(v) => updateSetting('receipt_showWhatsapp', v)} />
                            <Label htmlFor="showWhatsapp">عرض رقم واتساب</Label>
                        </div>
                    </div>
                )}
             </div>

            <Separator/>

            <div className="grid gap-4">
                <div className="flex items-center gap-2">
                    <Switch id="showOrderNumber" checked={showOrderNumber} onCheckedChange={(v) => updateSetting('receipt_showOrderNumber', v)} />
                    <Label htmlFor="showOrderNumber">عرض رقم الطلب</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="showSeller" checked={showSeller} onCheckedChange={(v) => updateSetting('receipt_showSeller', v)} />
                    <Label htmlFor="showSeller">عرض اسم البائع</Label>
                </div>
                 <div className="flex items-center gap-2">
                    <Switch id="showCustomerInfo" checked={showCustomerInfo} onCheckedChange={(v) => updateSetting('receipt_showCustomerInfo', v)} />
                    <Label htmlFor="showCustomerInfo">عرض بيانات العميل</Label>
                </div>
            </div>

            <Separator/>

            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Type className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">أحجام الخطوط (نقطة pt)</CardTitle>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label>اسم المحل</Label>
                        <Input type="number" value={shopNameFontSize} onChange={(e) => updateSetting('receipt_shopNameFontSize_pt', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-2">
                        <Label>بيانات الطلب والعميل</Label>
                        <Input type="number" value={detailsFontSize} onChange={(e) => updateSetting('receipt_detailsFontSize_pt', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-2">
                        <Label>جدول الأصناف</Label>
                        <Input type="number" value={itemsFontSize} onChange={(e) => updateSetting('receipt_itemsFontSize_pt', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-2">
                        <Label>المبالغ الإجمالية</Label>
                        <Input type="number" value={totalsFontSize} onChange={(e) => updateSetting('receipt_totalsFontSize_pt', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-2">
                        <Label>نصوص التذييل</Label>
                        <Input type="number" value={footerFontSize} onChange={(e) => updateSetting('receipt_footerFontSize_pt', parseInt(e.target.value) || 1)} />
                    </div>
                </div>
            </div>

            <Separator/>
            
            <div className="flex flex-col gap-2">
                <Label htmlFor="footerText" className="font-semibold">نص التذييل</Label>
                <Textarea id="footerText" value={footerText} onChange={(e) => updateSetting('receipt_footerText', e.target.value)} rows={4} placeholder="الشروط والأحكام، رسائل الشكر، إلخ..."/>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export default function CashierReceiptPage() {
    return (
        <AuthLayout>
            <CashierReceiptPageContent />
        </AuthLayout>
    );
}
