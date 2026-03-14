
'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Download, Trash2, AlertTriangle, Loader2, Shield, Package, ShoppingCart, Tags, Users, Clock, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { MonthPickerDialog } from '@/components/ui/month-picker-dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDatabase, useUser } from '@/firebase';
import { ref, get, remove, update, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { format, isBefore, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product, Order } from '@/lib/definitions';

function DatabaseManagementPageContent() {
  const { appUser, isUserLoading } = useUser();
  const router = useRouter();

  const [deleteUntilDate, setDeleteUntilDate] = useState<Date | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [confirmTexts, setConfirmTexts] = useState<Record<string, string>>({});
  
  const db = useDatabase();
  const { toast } = useToast();

  const handleBackup = async () => {
    setIsBackingUp(true);
    toast({ title: 'جاري إنشاء النسخة الاحتياطية...' });
    try {
      const dbRef = ref(db);
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        const formattedDate = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        link.download = `hiclass_backup_${formattedDate}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        toast({ title: 'تم تحميل النسخة الاحتياطية بنجاح' });
      } else {
        toast({ variant: 'destructive', title: 'لا توجد بيانات لإنشاء نسخة احتياطية' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'فشل إنشاء النسخة الاحتياطية', description: error.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSyncStock = async () => {
    setIsSyncingStock(true);
    toast({ title: 'جاري إعادة حساب أرقام المخزون من واقع الفواتير...' });

    try {
        // 1. Fetch all products and all orders
        const productsSnapshot = await get(ref(db, 'products'));
        const ordersSnapshot = await get(ref(db, 'daily-entries'));

        if (!productsSnapshot.exists()) {
            toast({ variant: 'destructive', title: 'لا توجد منتجات لتصحيحها' });
            setIsSyncingStock(false);
            return;
        }

        const productsData = productsSnapshot.val() as Record<string, Product>;
        const allProducts = Object.keys(productsData).map(id => ({ ...productsData[id], id }));
        
        // Map to store calculated counts
        const calculatedStats: Record<string, { rented: number, sold: number }> = {};
        allProducts.forEach(p => {
            calculatedStats[p.id] = { rented: 0, sold: 0 };
        });

        // 2. Process all orders to find actual rented/sold quantities
        if (ordersSnapshot.exists()) {
            const dailyEntries = ordersSnapshot.val();
            // dailyEntries structure: { "2023-10-01": { orders: { "orderId": { ... } } } }
            Object.values(dailyEntries).forEach((dateEntry: any) => {
                if (dateEntry.orders) {
                    Object.values(dateEntry.orders).forEach((order: any) => {
                        // Ignore Cancelled orders entirely
                        if (order.status === 'Cancelled') return;

                        order.items?.forEach((item: any) => {
                            if (!calculatedStats[item.productId]) return;

                            const itemType = item.itemTransactionType || order.transactionType;
                            
                            if (itemType === 'Sale') {
                                // For Sales: Count as sold if order is not Cancelled
                                calculatedStats[item.productId].sold += (Number(item.quantity) || 0);
                            } else if (itemType === 'Rental') {
                                // For Rentals: Count as rented/reserved if order is NOT Cancelled and NOT Returned
                                if (order.status !== 'Returned') {
                                    calculatedStats[item.productId].rented += (Number(item.quantity) || 0);
                                }
                            }
                        });
                    });
                }
            });
        }

        // 3. Update products with corrected values based on initialStock
        const updates: Record<string, any> = {};
        let correctionCount = 0;

        allProducts.forEach(p => {
            const newRented = calculatedStats[p.id].rented;
            const newSold = calculatedStats[p.id].sold;
            
            // Recalculate Quantity In Stock (Physical items in shop)
            // Logic: InShop = InitialStock - Sold - Rented
            const initial = Number(p.initialStock) || 0;
            const newInStock = Math.max(0, initial - newSold - newRented);

            // Always apply to ensure everything is matched to invoices
            updates[`products/${p.id}/quantityRented`] = newRented;
            updates[`products/${p.id}/quantitySold`] = newSold;
            updates[`products/${p.id}/quantityInStock`] = newInStock;
            
            // Also sync rentalCount if it's vastly different
            updates[`products/${p.id}/rentalCount`] = newRented; 
            
            correctionCount++;
        });

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            toast({ 
                title: 'اكتملت عملية المزامنة', 
                description: `تم تصحيح بيانات ${correctionCount} صنف بناءً على سجل الفواتير الفعلي. تم تحديث العدادات (مؤجر/مباع/متاح) بدقة.`,
                variant: 'default'
            });
        } else {
            toast({ title: 'المخزون مطابق', description: 'لم يتم العثور على أي تضارب بين سجل الطلبات وعدادات المخزون.' });
        }

    } catch (error: any) {
        console.error("Stock sync failed:", error);
        toast({ variant: 'destructive', title: 'فشل تصحيح المخزون', description: error.message });
    } finally {
        setIsSyncingStock(false);
    }
  };

  const deletePath = async (paths: string[], category: string) => {
    setLoadingCategory(category);
    try {
      const promises = paths.map(path => remove(ref(db, path)));
      await Promise.all(promises);
      toast({ title: 'تم الحذف بنجاح', description: `تم مسح بيانات ${category} المحددة.` });
      setConfirmTexts(prev => ({ ...prev, [category]: '' }));
    } catch (error: any) {
      toast({ variant: "destructive", title: "فشل الحذف", description: error.message });
    } finally {
      setLoadingCategory(null);
    }
  };

  const handleDeleteOldData = async () => {
    if (!deleteUntilDate) {
      toast({ variant: "destructive", title: "الرجاء تحديد تاريخ" });
      return;
    }
    setIsDeleting(true);
    toast({ title: 'جاري حذف البيانات القديمة...' });

    const promises: Promise<void>[] = [];
    const pathsToDelete: { path: string, dateField: string }[] = [
        { path: 'daily-entries', dateField: 'key' },
        { path: 'expenses', dateField: 'date' },
        { path: 'shifts', dateField: 'startTime' },
        { path: 'saleReturns', dateField: 'returnDate' },
        { path: 'purchaseOrders', dateField: 'purchaseDate' },
        { path: 'discountRequests', dateField: 'requestDate' },
    ];
    let deletedCount = 0;

    for (const item of pathsToDelete) {
        const dataRef = ref(db, item.path);
        const snapshot = await get(dataRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            for (const key in data) {
                try {
                    const record = data[key];
                    const recordDateStr = item.dateField === 'key' ? key : record[item.dateField];
                    if (recordDateStr && isBefore(parseISO(recordDateStr), deleteUntilDate)) {
                        promises.push(remove(ref(db, `${item.path}/${key}`)));
                        deletedCount++;
                    }
                } catch(e) {
                     continue;
                }
            }
        }
    }
    
    try {
        await Promise.all(promises);
        toast({ title: 'نجاح', description: `تم حذف ${deletedCount} سجل قديم بنجاح.` });
    } catch (error: any) {
         toast({ variant: "destructive", title: "فشل الحذف", description: error.message });
    } finally {
      setIsDeleting(false);
      setDeleteUntilDate(undefined);
    }
  };

  if (isUserLoading) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="إدارة قاعدة البيانات" showBackButton />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
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

  const DeletionCard = ({ 
    title, 
    description, 
    icon: Icon, 
    category, 
    paths 
  }: { 
    title: string, 
    description: string, 
    icon: any, 
    category: string, 
    paths: string[] 
  }) => (
    <Card className="border-destructive/20">
        <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-2">
                        <Trash2 className="h-4 w-4" />
                        حذف {title}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف {title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف جميع {title} بشكل نهائي. للمتابعة، اكتب كلمة "حذف" في الحقل أدناه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                        <Input
                            placeholder='اكتب "حذف" هنا للتأكيد'
                            value={confirmTexts[category] || ''}
                            onChange={(e) => setConfirmTexts(prev => ({ ...prev, [category]: e.target.value }))}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletePath(paths, category)}
                            disabled={confirmTexts[category] !== 'حذف' || loadingCategory === category}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {loadingCategory === category && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            تأكيد الحذف النهائي
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="إدارة قاعدة البيانات" showBackButton />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
            <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <CardTitle>النسخ الاحتياطي</CardTitle>
            </div>
            <CardDescription>
                قم بتنزيل نسخة كاملة من قاعدة البيانات الخاصة بك في ملف JSON قبل إجراء أي عمليات حذف.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Button onClick={handleBackup} disabled={isBackingUp} className="w-full sm:w-auto">
                {isBackingUp ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="ml-2 h-4 w-4" />
                )}
                تنزيل نسخة احتياطية الآن
            </Button>
            </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <RefreshCcw className="h-5 w-5 text-primary" />
                    <CardTitle>مزامنة وتصحيح أرقام المخزون</CardTitle>
                </div>
                <CardDescription>
                    سيقوم النظام بمسح عدادات المخزون الحالية وإعادة حسابها بالكامل بناءً على "واقع الفواتير" (بيع وإيجار) الموجودة فعلياً في سجلاتك.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleSyncStock} disabled={isSyncingStock} variant="default" className="w-full sm:w-auto gap-2">
                    {isSyncingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    بدء المزامنة والتصحيح من الفواتير
                </Button>
            </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>حذف السجلات القديمة زمنيًا</CardTitle>
          </div>
           <CardDescription>
            حذف الطلبات والمعاملات المالية قبل شهر محدد لتخفيف حجم قاعدة البيانات.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-auto">
                 <MonthPickerDialog value={deleteUntilDate} onValueChange={setDeleteUntilDate} />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="secondary" disabled={!deleteUntilDate || isDeleting} className="w-full sm:w-auto gap-2">
                        <Trash2 className="h-4 w-4" />
                        حذف السجلات قبل هذا الشهر
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف الزمني</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف جميع الطلبات والقيود قبل شهر{' '}
                            <span className="font-bold text-destructive">{deleteUntilDate ? format(deleteUntilDate, 'MMMM yyyy', { locale: ar }) : ''}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteOldData}>تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DeletionCard 
            title="المنتجات" 
            description="حذف جميع الأصناف، الباركودات، وسجل حركة المخزون."
            icon={Package}
            category="products"
            paths={['products', 'counters/products']}
          />
          <DeletionCard 
            title="الطلبات والمالية" 
            description="حذف جميع الطلبات، الورديات، المصروفات، والمشتريات."
            icon={ShoppingCart}
            category="orders"
            paths={['daily-entries', 'shifts', 'expenses', 'discountRequests', 'saleReturns', 'purchaseOrders', 'purchaseReturns', 'counters/orders']}
          />
          <DeletionCard 
            title="المجموعات والمقاسات" 
            description="حذف جميع تصنيفات المجموعات وقائمة المقاسات."
            icon={Tags}
            category="metadata"
            paths={['productGroups', 'sizes']}
          />
          <DeletionCard 
            title="العملاء" 
            description="حذف قاعدة بيانات العملاء المسجلة بالكامل."
            icon={Users}
            category="customers"
            paths={['customers']}
          />
      </div>

      <div className="p-4 rounded-lg bg-muted border border-dashed text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              ملاحظة: عمليات الحذف لا تشمل الفروع أو المستخدمين للحفاظ على استقرار النظام.
          </p>
      </div>
    </div>
  );
}

export default function DatabaseManagementPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <DatabaseManagementPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
