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
  Truck,
  FileText,
  Undo2,
  PackagePlus,
  Undo,
  Users,
  Contact,
  BadgePercent,
  CircleDollarSign,
  Wallet,
} from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from './ui/sidebar';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';
import { Separator } from './ui/separator';
import { useUser } from '@/firebase';
import { useSettings } from '@/hooks/use-settings';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const navGroups = [
  {
    id: 'daily-ops',
    title: 'العمليات اليومية',
    items: [
      { href: '/home', label: 'الرئيسية', icon: LayoutGrid, permission: '' },
      { href: '/dashboard', label: 'لوحة التحكم', icon: BarChart3, permission: 'dashboard:view' },
      { href: '/products', label: 'المنتجات', icon: Package, permission: 'products:view' },
      { href: '/orders', label: 'الطلبات', icon: ShoppingCart, permission: 'orders:view' },
    ],
  },
  {
    id: 'followup-inventory',
    title: 'متابعة ومخزون',
    items: [
      { href: '/delivery-prep', label: 'تجهيز الطلبات', icon: Truck, permission: 'delivery-prep:view' },
      { href: '/returns', label: 'استلام المرتجعات', icon: Undo2, permission: 'returns:view' },
      { href: '/inventory-check', label: 'استعلام عن صنف', icon: PackageSearch, permission: 'inventory-check:view' },
      { href: '/purchases', label: 'المشتريات', icon: PackagePlus, permission: 'purchases:view' },
      { href: '/sale-returns', label: 'مرتجعات البيع', icon: Undo, permission: 'sale-returns:view' },
      { href: '/purchase-returns', label: 'مرتجعات المشتريات', icon: Undo, permission: 'purchase-returns:view' },
      { href: '/inventory-cost', label: 'تكلفة المخزون', icon: CircleDollarSign, permission: 'reports:inventory-cost' },
    ]
  },
  {
    id: 'people',
    title: 'العملاء و الموردين',
    items: [
      { href: '/customers', label: 'العملاء', icon: Users, permission: 'customers:view' },
      { href: '/suppliers', label: 'الموردون', icon: Contact, permission: 'suppliers:view' },
    ]
  },
  {
    id: 'management-finance',
    title: 'الإدارة والمالية',
    items: [
      { href: '/branches', label: 'الفروع', icon: Store, permission: 'branches:view' },
      { href: '/users', label: 'المستخدمون', icon: Users2, permission: 'users:view' },
      { href: '/treasuries', label: 'الخزائن', icon: Wallet, permission: 'treasuries:view' },
      { href: '/shifts', label: 'الورديات', icon: Clock, permission: 'shifts:view' },
      { href: '/expenses', label: 'المصروفات', icon: FileText, permission: 'expenses:view' },
      { href: '/discount-requests', label: 'طلبات الخصم', icon: BadgePercent, permission: 'discount-requests:view' },
      { href: '/reports', label: 'جميع التقارير', icon: BarChart3, permission: 'reports:view' },
    ]
  }
];

const settingsNavItem = { href: '/settings', label: 'الإعدادات', icon: Settings };


export function DashboardNav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { appUser } = useUser();
  const { settings } = useSettings();
  const NavWrapper = isMobile ? SheetClose : 'div';
  
  const userPermissions = appUser?.permissions || [];

  const canView = (permission: string) => {
    if (!appUser) return false;
    return userPermissions.includes('all') || userPermissions.includes(permission);
  }

  const renderNavItems = (items: Omit<typeof navGroups[0]['items'][0], 'permission'>[]) => {
    return items.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        const button = (
           <SidebarMenuButton
              key={href}
              isActive={isActive}
              tooltip={{ children: label }}
              className={cn("w-full text-base", isMobile ? "justify-between" : "justify-end")}
            >
              <span>{label}</span>
              <Icon className="h-5 w-5" />
            </SidebarMenuButton>
        )

        return (
          <SidebarMenuItem key={href}>
              {isMobile ? (
                   <NavWrapper asChild>
                      <Link href={href}>{button}</Link>
                  </NavWrapper>
              ) : (
                  <Link href={href}>{button}</Link>
              )}
          </SidebarMenuItem>
        );
      })
  }

  const defaultActiveAccordion = navGroups.find(group => group.items.some(item => pathname.startsWith(item.href)))?.id;

  return (
    <nav className="grid items-start gap-2 p-2 text-sm font-medium">
      <SidebarMenuItem>
        <div className="flex items-center gap-2 rounded-md p-2 text-lg font-semibold text-sidebar-primary-foreground">
          {settings.appName}
        </div>
      </SidebarMenuItem>
      <Separator />

      <Accordion type="single" collapsible defaultValue={defaultActiveAccordion} className="w-full space-y-1">
        {navGroups.map(group => {
            const visibleItems = group.items.filter(item => !item.permission || canView(item.permission));
            if (visibleItems.length === 0) return null;
            
            return (
                 <AccordionItem value={group.id} key={group.id} className="border-b-0">
                    <AccordionTrigger className="px-2 py-3 text-base hover:no-underline hover:bg-sidebar-accent rounded-md">
                        <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 pt-1 pl-4">
                        <SidebarMenu>
                            {renderNavItems(visibleItems)}
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>
            )
        })}
      </Accordion>
      
      <Separator className="my-2" />
      
      {appUser?.username === 'admin' && (
          <SidebarMenu>
             {renderNavItems([settingsNavItem])}
          </SidebarMenu>
      )}
    </nav>
  );
}