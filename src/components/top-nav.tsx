'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutGrid,
  Package,
  ShoppingCart,
  Store,
  Clock,
  Settings,
  Users2,
  PackageSearch,
  Wallet,
  UserCircle,
  Truck,
  FileText,
  LogOut,
  Undo2,
  PackagePlus,
  Undo,
  Users,
  ClipboardList,
  Warehouse,
  Shield,
  Contact,
  Repeat,
  ChevronDown,
  Building,
  BadgePercent,
  CircleDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HiClassLogo } from './icons';
import { Button } from './ui/button';
import { ThemeToggle } from './app-layout';
import { useUser } from '@/firebase';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import React from 'react';
import { SyncIndicator } from './sync-indicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "./change-password-dialog";


const dailyOperationsNavItems = [
  { href: '/home', label: 'الرئيسية', description: 'الشاشة الرئيسية للتطبيق.', icon: LayoutGrid, permission: '' },
  { href: '/dashboard', label: 'لوحة التحكم', description: 'نظرة شاملة على أداء عملك.', icon: BarChart3, permission: 'dashboard:view' },
  { href: '/products', label: 'المنتجات', description: 'إدارة جميع المنتجات والمخزون.', icon: Package, permission: 'products:view' },
  { href: '/orders', label: 'الطلبات', description: 'متابعة جميع طلبات البيع والإيجار.', icon: ShoppingCart, permission: 'orders:view' },
];

const peopleNavItems = [
    { href: '/customers', label: 'العملاء', description: 'إدارة بيانات العملاء.', icon: Users, permission: 'customers:view' },
    { href: '/suppliers', label: 'الموردون', description: 'إدارة بيانات الموردين.', icon: Contact, permission: 'suppliers:view' },
]

const followupNavItems = [
    { href: '/delivery-prep', label: 'تجهيز الطلبات', description: 'متابعة الطلبات قيد التجهيز والجاهزة للتسليم.', icon: Truck, permission: 'delivery-prep:view' },
    { href: '/returns', label: 'استلام المرتجعات', description: 'تسجيل استلام المنتجات المؤجرة.', icon: Undo2, permission: 'returns:view' },
];

const inventoryNavItems = [
    { href: '/inventory-check', label: 'استعلام عن منتج', description: 'البحث عن حالة وتوفر منتج معين.', icon: PackageSearch, permission: 'inventory-check:view' },
    { href: '/purchases', label: 'المشتريات', description: 'تسجيل فواتير الشراء من الموردين.', icon: PackagePlus, permission: 'purchases:view' },
    { href: '/sale-returns', label: 'مرتجعات البيع', description: 'تسجيل مرتجعات المبيعات من العملاء.', icon: Undo, permission: 'sale-returns:view' },
    { href: '/purchase-returns', label: 'مرتجعات المشتريات', description: 'تسجيل مرتجعات البضاعة للموردين.', icon: Undo, permission: 'purchase-returns:view' },
    { href: '/inventory-cost', label: 'تكلفة المخزون', description: 'عرض وتعديل أسعار التكلفة للمنتجات.', icon: CircleDollarSign, permission: 'reports:inventory-cost' },
];

const managementNavItems = [
  { href: '/branches', label: 'الفروع', description: 'إدارة فروع العمل.', icon: Store, permission: 'branches:view' },
  { href: '/users', label: 'المستخدمون', description: 'إدارة صلاحيات وأدوار المستخدمين.', icon: Users2, permission: 'users:view' },
];

const financeNavItems = [
    { href: '/treasuries', label: 'الخزائن', description: 'إدارة الخزائن النقدية والتدفقات المالية.', icon: Wallet, permission: 'treasuries:view' },
    { href: '/shifts', label: 'الورديات', description: 'إدارة الورديات المالية للموظفين.', icon: Clock, permission: 'shifts:view' },
    { href: '/expenses', label: 'المصروفات', description: 'تسجيل ومتابعة المصروفات.', icon: FileText, permission: 'expenses:view' },
    { href: '/discount-requests', label: 'طلبات الخصم', icon: BadgePercent, permission: 'discount-requests:view' },
];

const reportsNavItems = [
    { href: '/reports', label: 'جميع التقارير', description: 'عرض جميع التقارير المتاحة.', icon: BarChart3, permission: 'reports:view' },
];


const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { icon: React.ElementType }
>(({ className, title, children, icon: Icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2 text-sm font-medium leading-none">
            <Icon className="h-4 w-4" />
            {title}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"


export function TopNav({ userName, onLogout }: { userName: string, onLogout: () => void }) {
  const pathname = usePathname();
  const { appUser } = useUser();
  const userPermissions = appUser?.permissions || [];
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);

  const canView = (permission: string) => {
    if (!appUser) return false;
    return userPermissions.includes('all') || userPermissions.includes(permission);
  }

  const renderNavGroup = (title: string, icon: React.ElementType, items: any[]) => {
    const visibleItems = items.filter(item => !item.permission || canView(item.permission));
    if (visibleItems.length === 0) return null;

    return (
        <NavigationMenuItem>
            <NavigationMenuTrigger>
                {React.createElement(icon, { className: "h-4 w-4 ml-2" })}
                {title}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    {visibleItems.map(item => (
                        <ListItem key={item.href} href={item.href} title={item.label} icon={item.icon}>
                            {item.description}
                        </ListItem>
                    ))}
                </ul>
            </NavigationMenuContent>
        </NavigationMenuItem>
    )
  }

  return (
    <>
    <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <HiClassLogo className="h-8 w-auto text-amber-500" />
        </Link>
        <NavigationMenu>
            <NavigationMenuList>
                {renderNavGroup("العمليات اليومية", ClipboardList, dailyOperationsNavItems)}
                {renderNavGroup("العملاء و الموردين", Users, peopleNavItems)}
                {renderNavGroup("المتابعة والمخزون", Warehouse, [...followupNavItems, ...inventoryNavItems])}
                {renderNavGroup("الإدارة", Building, managementNavItems)}
                {renderNavGroup("المالية", Wallet, financeNavItems)}
                {renderNavGroup("التقارير", BarChart3, reportsNavItems)}
                {appUser?.username === 'admin' && (
                    <NavigationMenuItem>
                        <NavigationMenuLink asChild>
                            <Link href="/settings" className={navigationMenuTriggerStyle()}>
                                <Settings className="h-4 w-4 ml-2" />
                                الإعدادات
                            </Link>
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                )}
            </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end space-x-2">
            <SyncIndicator />
            <ThemeToggle isTopNav={true} />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                        <UserCircle className="h-5 w-5" />
                        {userName}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsChangePasswordOpen(true)}>
                        تغيير كلمة المرور
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onLogout}>
                        <LogOut className="h-4 w-4 ml-2" />
                        تسجيل الخروج
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
        </div>
      </div>
    </header>
    </>
  );
}