'use client';

import { AppLayout, AuthGuard } from '@/components/app-layout';
import { HiClassLogo } from '@/components/icons';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function HomePageContent() {
    const { appUser } = useUser();

    return (
        <div className="flex flex-1 items-center justify-center -mt-16">
            <Card className="w-full max-w-lg text-center border-none shadow-none bg-transparent">
                <CardHeader>
                    <HiClassLogo className="mx-auto h-24 w-auto" />
                    <CardTitle className="mt-6 text-3xl font-headline">
                        أهلاً بك، {appUser?.fullName}!
                    </CardTitle>
                    <CardDescription className="text-base">
                        لقد تم تسجيل دخولك بنجاح.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                       يمكنك البدء بالتنقل بين أقسام البرنامج من القائمة.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link href="/orders">
                           <Button className="mt-6">عرض الطلبات</Button>
                        </Link>
                         <Link href="/products">
                           <Button variant="outline" className="mt-6">عرض المنتجات</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function HomePage() {
    return (
        <AppLayout>
            <AuthGuard>
                <HomePageContent />
            </AuthGuard>
        </AppLayout>
    );
}
