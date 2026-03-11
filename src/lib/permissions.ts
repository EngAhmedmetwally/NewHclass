export const PERMISSIONS_CONFIG = {
    dashboard: {
        id: 'dashboard',
        label: 'لوحة التحكم',
        view: { id: 'dashboard:view', label: 'عرض لوحة التحكم' },
    },
    products: {
        id: 'products',
        label: 'المنتجات',
        view: { id: 'products:view', label: 'عرض المنتجات' },
        actions: {
            add: { id: 'products:add', label: 'إضافة منتج' },
            edit: { id: 'products:edit', label: 'تعديل منتج' },
            delete: { id: 'products:delete', label: 'حذف منتج' },
            addStock: { id: 'products:add-stock', label: 'إضافة مخزون' },
            printLabel: { id: 'products:print-label', label: 'طباعة باركود' },
            viewDetails: { id: 'products:view-details', label: 'عرض تفاصيل المنتج' },
            import: { id: 'products:import', label: 'استيراد من Excel' },
        }
    },
    orders: {
        id: 'orders',
        label: 'الطلبات',
        view: { id: 'orders:view', label: 'عرض الطلبات' },
        actions: {
            add: { id: 'orders:add', label: 'إضافة طلب' },
            edit: { id: 'orders:edit', label: 'تعديل طلب' },
            cancel: { id: 'orders:cancel', label: 'إلغاء/حذف الطلب' },
            addPayment: { id: 'orders:add-payment', label: 'إضافة دفعة' },
            applyDiscount: { id: 'orders:apply-discount', label: 'تطبيق خصم' },
            addNote: { id: 'orders:add-note', label: 'إضافة ملاحظة' },
            printReceipt: { id: 'orders:print-receipt', label: 'طباعة إيصال' },
            printTailorReceipt: { id: 'orders:print-tailor-receipt', label: 'طباعة وصل خياط' },
        }
    },
    customers: {
        id: 'customers',
        label: 'العملاء',
        view: { id: 'customers:view', label: 'عرض العملاء' },
        actions: {
            add: { id: 'customers:add', label: 'إضافة عميل' },
            edit: { id: 'customers:edit', label: 'تعديل عميل' },
            delete: { id: 'customers:delete', label: 'حذف عميل' },
        }
    },
    suppliers: {
        id: 'suppliers',
        label: 'الموردون',
        view: { id: 'suppliers:view', label: 'عرض الموردين' },
        actions: {
            add: { id: 'suppliers:add', label: 'إضافة مورد' },
            edit: { id: 'suppliers:edit', label: 'تعديل مورد' },
            delete: { id: 'suppliers:delete', label: 'حذف مورد' },
        }
    },
    purchases: {
        id: 'purchases',
        label: 'المشتريات',
        view: { id: 'purchases:view', label: 'عرض المشتريات' },
        actions: {
            add: { id: 'purchases:add', label: 'إضافة فاتورة' },
            edit: { id: 'purchases:edit', label: 'تعديل فاتورة' },
            delete: { id: 'purchases:delete', label: 'حذف فاتورة' },
        }
    },
    saleReturns: {
        id: 'sale-returns',
        label: 'مرتجعات البيع',
        view: { id: 'sale-returns:view', label: 'عرض مرتجعات البيع' },
        actions: {
            add: { id: 'sale-returns:add', label: 'إنشاء مرتجع بيع' },
        }
    },
    purchaseReturns: {
        id: 'purchase-returns',
        label: 'مرتجعات المشتريات',
        view: { id: 'purchase-returns:view', label: 'عرض مرتجعات المشتريات' },
        actions: {
            add: { id: 'purchase-returns:add', label: 'إنشاء مرتجع شراء' },
        }
    },
    deliveryPrep: {
        id: 'delivery-prep',
        label: 'تجهيز الطلبات',
        view: { id: 'delivery-prep:view', label: 'عرض شاشة التجهيز' },
    },
    returns: {
        id: 'returns',
        label: 'استلام المرتجعات',
        view: { id: 'returns:view', label: 'عرض شاشة استلام المرتجعات' },
    },
    inventoryCheck: {
        id: 'inventory-check',
        label: 'استعلام عن صنف',
        view: { id: 'inventory-check:view', label: 'عرض شاشة الاستعلام' },
    },
     discountRequests: {
        id: 'discount-requests',
        label: 'طلبات الخصم',
        view: { id: 'discount-requests:view', label: 'عرض طلبات الخصم' },
        actions: {
            process: { id: 'discount-requests:process', label: 'معالجة طلبات الخصم' },
        }
    },
    branches: {
        id: 'branches',
        label: 'الفروع',
        view: { id: 'branches:view', label: 'عرض الفروع' },
        actions: {
            add: { id: 'branches:add', label: 'إضافة فرع' },
            edit: { id: 'branches:edit', label: 'تعديل فرع' },
            delete: { id: 'branches:delete', label: 'حذف فرع' },
        }
    },
    users: {
        id: 'users',
        label: 'المستخدمون',
        view: { id: 'users:view', label: 'عرض المستخدمين' },
        actions: {
            add: { id: 'users:add', label: 'إضافة مستخدم' },
            edit: { id: 'users:edit', label: 'تعديل مستخدم' },
            delete: { id: 'users:delete', label: 'حذف مستخدم' },
        }
    },
    shifts: {
        id: 'shifts',
        label: 'الورديات',
        view: { id: 'shifts:view', label: 'عرض الورديات' },
        actions: {
            start: { id: 'shifts:start', label: 'بدء وردية' },
            end: { id: 'shifts:end', label: 'إنهاء وردية' },
            reopen: { id: 'shifts:reopen', label: 'إعادة فتح وردية' },
            delete: { id: 'shifts:delete', label: 'حذف وردية' },
        }
    },
    expenses: {
        id: 'expenses',
        label: 'المصروفات',
        view: { id: 'expenses:view', label: 'عرض المصروفات' },
        actions: {
            add: { id: 'expenses:add', label: 'إضافة مصروف' },
            edit: { id: 'expenses:edit', label: 'تعديل مصروف' },
            delete: { id: 'expenses:delete', label: 'حذف مصروف' },
        }
    },
    reports: {
        id: 'reports',
        label: 'التقارير',
        view: { id: 'reports:view', label: 'عرض صفحة التقارير الرئيسية' },
        actions: {
            branchSummary: { id: 'reports:branch-summary', label: 'عرض تقرير ملخصات الفروع' },
            sellerPerformance: { id: 'reports:seller-performance', label: 'عرض تقرير أداء البائعين' },
            financialLog: { id: 'reports:financial-log', label: 'عرض السجل المالي للورديات' },
            discounts: { id: 'reports:discounts', label: 'عرض تقرير الخصومات' },
            productPerformance: { id: 'reports:product-performance', label: 'عرض تقرير أداء المنتجات' },
            topSelling: { id: 'reports:top-selling-products', label: 'عرض تقرير الأكثر مبيعًا' },
            topRented: { id: 'reports:top-rented-products', label: 'عرض تقرير الأكثر إيجارًا' },
            stagnant: { id: 'reports:stagnant-products', label: 'عرض تقرير الأصناف الراكدة' },
            overdue: { id: 'reports:overdue-orders', label: 'عرض تقرير الطلبات المتأخرة' },
            inventoryHistory: { id: 'reports:inventory-history', label: 'عرض تقرير حركة المخزون' },
            maintenance: { id: 'reports:maintenance-required', label: 'عرض تقرير أصناف الصيانة' },
            inventorySummary: { id: 'reports:inventory-summary', label: 'عرض تقرير ملخص المخزون' },
            salesByCategory: { id: 'reports:sales-by-category', label: 'عرض تقرير مبيعات حسب الفئة' },
            inventoryCost: { id: 'reports:inventory-cost', label: 'عرض تقرير تكلفة المخزون' },
            priceDeviations: { id: 'reports:price-deviations', label: 'عرض تقرير انحراف الأسعار' },
            cancelledOrders: { id: 'reports:cancelled-orders', label: 'عرض تقرير الطلبات الملغاة' },
        }
    },
} as const;

type PermissionConfig = typeof PERMISSIONS_CONFIG;

type ExtractPermissionIds<T> = T extends { id: string }
  ? T['id'] | (T extends { actions: Record<string, { id: string }> } ? T['actions'][keyof T['actions']]['id'] : never) | (T extends { view: { id: string } } ? T['view']['id'] : never)
  : never;

type FlattenPermissions<T> = {
  [K in keyof T]: ExtractPermissionIds<T[K]>;
}[keyof T];

export type PermissionId = FlattenPermissions<PermissionConfig>;
export type PermissionCategory = PermissionConfig[keyof PermissionConfig];