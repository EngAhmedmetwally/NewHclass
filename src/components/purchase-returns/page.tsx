

'use client';

import { PageHeader } from '@/components/page-header';
import { AppLayout, AuthGuard } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

const requiredPermissions = ['purchase-returns:add'] as const;

function PurchaseReturnsPageContent() {
  const { permissions } = usePermissions(requiredPermissions);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="مرتجعات المشتريات" showBackButton>
        {permissions.canPurchaseReturnsAdd && (
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                إنشاء مرتجع شراء
            </Button>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
            <CardTitle>مرتجعات المشتريات</CardTitle>
            <CardDescription>قائمة بجميع المرتجعات للموردين.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="text-center text-muted-foreground py-10">
                سيتم بناء هذه الشاشة في المراحل القادمة.
            </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function PurchaseReturnsPage() {
    return (
        <AppLayout>
            <AuthGuard>
                <PurchaseReturnsPageContent />
            </AuthGuard>
        </AppLayout>
    )
}
