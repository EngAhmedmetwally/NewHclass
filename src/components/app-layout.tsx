'use client';

import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { DashboardNav } from './dashboard-nav';
import { HiClassLogo } from './icons';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet';
import { PanelLeft, Moon, Sun, UserCircle, LogOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useState, useEffect } from 'react';
import { TopNav } from './top-nav';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import type { User as AppUserDef } from '@/lib/definitions';
import { usePathname, useRouter } from 'next/navigation';
import { useSettings, type AppSettings } from '@/hooks/use-settings';
import { Skeleton } from './ui/skeleton';
import { SyncIndicator } from './sync-indicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChangePasswordDialog } from "./change-password-dialog";


export function ThemeToggle({ isTopNav = false }: { isTopNav?: boolean }) {
    const { theme, setTheme } = useTheme();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <Button variant="ghost" size="icon" disabled className={!isTopNav ? "w-full justify-start gap-2 px-2" : ""}>
                <div className="h-5 w-5" />
                {!isTopNav && <span className="text-sm group-data-[collapsible=icon]:hidden">...</span>}
            </Button>
        )
    }

    const isDark = theme === 'dark';

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(!isTopNav && "w-full justify-start gap-2 px-2")}
        >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {!isTopNav && (
                <span className="text-sm group-data-[collapsible=icon]:hidden">
                    {isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </span>
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}

function SidebarLayout({ children, appUser, settings }: { children: React.ReactNode, appUser?: AppUserDef, settings: AppSettings }) {
  const isMobile = useIsMobile();
  const userName = appUser?.fullName || '...';
  const auth = useAuth();
  const router = useRouter();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('app_user_id');
    router.push('/login');
  };


  return (
    <SidebarProvider defaultOpen>
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
      {isMobile ? (
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-30">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>القائمة الرئيسية</SheetTitle>
                  <SheetDescription>التنقل بين أقسام التطبيق المختلفة.</SheetDescription>
                </SheetHeader>
                <SidebarHeader className="border-b p-4">
                  <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <HiClassLogo className="h-8 w-auto" />
                    <span className="sr-only font-headline text-xl">{settings.appName}</span>
                  </Link>
                </SidebarHeader>
                <DashboardNav isMobile />
                <div className='p-2 mt-auto border-t'>
                  <ThemeToggle />
                   <Button variant="ghost" onClick={handleLogout} size="icon" className="w-full justify-start gap-2 px-2 mt-1">
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm">تسجيل الخروج</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex w-full items-center gap-2">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold md:hidden">
                <HiClassLogo className="h-6 w-auto" />
                <span className="sr-only font-headline text-lg">{settings.appName}</span>
              </Link>
            </div>
            <SyncIndicator />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            {children}
          </main>
        </div>
      ) : (
        <>
          <Sidebar side="right" collapsible="icon">
            <SidebarHeader className="border-b">
              <Link
                href="/dashboard"
                className={cn(
                  'flex items-center justify-center gap-2 font-semibold transition-transform duration-200 h-14',
                  'group-data-[collapsible=icon]:-translate-x-0'
                )}
              >
                <HiClassLogo className="h-10 w-auto shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:h-12" />
                <span className="font-headline text-xl group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 sr-only">
                  {settings.appName}
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <DashboardNav />
            </SidebarContent>
            <SidebarFooter>
              <SidebarSeparator />
              <SidebarMenu>
                <SidebarMenuItem>
                  <ThemeToggle />
                </SidebarMenuItem>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full justify-start gap-2 px-2">
                            <UserCircle className="h-5 w-5" />
                            <span className="text-sm group-data-[collapsible=icon]:hidden">
                            {userName}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start">
                        <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setIsChangePasswordOpen(true)}>
                            تغيير كلمة المرور
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <SidebarMenuItem>
                  <Button variant="ghost" onClick={handleLogout} size="icon" className="w-full justify-start gap-2 px-2">
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm group-data-[collapsible=icon]:hidden">
                      تسجيل الخروج
                    </span>
                  </Button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="p-4 pt-0 md:p-8 md:pt-4">
            <header className="sticky top-0 z-10 hidden h-16 items-center justify-start gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:flex md:px-0">
              <SidebarTrigger />
            </header>
            {children}
          </SidebarInset>
        </>
      )}
    </SidebarProvider>
  );
}

function TopNavLayout({ children, appUser }: { children: React.ReactNode, appUser?: AppUserDef }) {
    const userName = appUser?.fullName || '...';
    const auth = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('app_user_id');
        router.push('/login');
    };


    return (
        <div className="flex min-h-screen w-full flex-col">
            <TopNav userName={userName} onLogout={handleLogout} />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                {children}
            </main>
        </div>
    );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { settings, isLoading: isLoadingSettings } = useSettings();
    const [isMounted, setIsMounted] = useState(false);
    const isMobile = useIsMobile();
    const { appUser } = useUser();
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || isLoadingSettings) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Skeleton className="h-16 w-16" />
            </div>
        );
    }

    const LayoutComponent = settings.navigationLayout === 'topnav' && !isMobile ? TopNavLayout : SidebarLayout;

    return <LayoutComponent settings={settings} appUser={appUser || undefined}>{children}</LayoutComponent>;
}


export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user: firebaseUser, isUserLoading, appUser } = useUser();

  useEffect(() => {
    if (!isUserLoading && (!firebaseUser || !appUser)) {
      router.replace('/login');
    }
  }, [isUserLoading, firebaseUser, appUser, router]);

  if (isUserLoading || !appUser) {
    return (
      <div className="flex h-[calc(100vh-150px)] w-full items-center justify-center">
        <HiClassLogo className="h-16 w-16 animate-pulse text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}


export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user: firebaseUser, isUserLoading, appUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!firebaseUser || !appUser)) {
      router.replace('/login');
    }
  }, [isUserLoading, firebaseUser, appUser, router]);


  if (isUserLoading || !firebaseUser || !appUser) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <HiClassLogo className="animate-pulse text-6xl text-primary" />
        <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
    );
  }
  
  return <AppLayout>{children}</AppLayout>;
}
