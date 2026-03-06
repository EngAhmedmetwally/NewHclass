'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { HiClassLogo } from '@/components/icons';

export default function HomePage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, router]);

  // Show a loading indicator while checking auth state
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <HiClassLogo className="animate-pulse text-6xl text-primary" />
        <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  );
}
