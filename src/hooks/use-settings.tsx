
"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { ref, onValue, update, off, set } from 'firebase/database';
import { useDatabase } from '@/firebase';

export interface AppSettings {
  [key: string]: any;
  appName?: string;
  productView?: 'grid' | 'table';
  navigationLayout?: 'sidebar' | 'topnav';
  // Product display settings
  product_sortOrder?: 'asc' | 'desc';
  product_hideOutOfStock?: boolean;
  // Feature Flags
  feature_enableTailorWorkflow?: boolean;
  sale_preventNegativeStock?: boolean;
  // Receipt settings
  receipt_showHeader?: boolean;
  receipt_showLogo?: boolean;
  receipt_showShopName?: boolean;
  receipt_showAddress?: boolean;
  receipt_showPhone?: boolean;
  receipt_showWhatsapp?: boolean;
  receipt_showOrderNumber?: boolean;
  receipt_showSeller?: boolean;
  receipt_showCustomerInfo?: boolean;
  receipt_headerText?: string;
  receipt_footerText?: string;
  // Receipt font sizes
  receipt_shopNameFontSize_pt?: number;
  receipt_detailsFontSize_pt?: number;
  receipt_itemsFontSize_pt?: number;
  receipt_totalsFontSize_pt?: number;
  receipt_footerFontSize_pt?: number;
  // Label settings
  label_showPrice?: boolean;
  label_showSize?: boolean;
  label_showBarcodeLines?: boolean;
  label_barcode_sample?: string;
  label_width_mm?: number;
  label_height_mm?: number;
  label_barcodeHeight_mm?: number;
  label_productNameFontSize_pt?: number;
  label_detailsFontSize_pt?: number;
  label_barcodeValueFontSize_pt?: number;
  label_productName_x_mm?: number;
  label_productName_y_mm?: number;
  label_price_x_mm?: number;
  label_price_y_mm?: number;
  label_size_x_mm?: number;
  label_size_y_mm?: number;
  label_barcode_x_mm?: number;
  label_barcode_y_mm?: number;
  label_barcodeValue_x_mm?: number;
  label_barcodeValue_y_mm?: number;
  // Tailor receipt settings
  tailor_showLogo?: boolean;
  tailor_showShopName?: boolean;
  tailor_shopName?: string;
  tailor_showContact?: boolean;
  tailor_contactInfo?: string;
  tailor_disclaimer?: string;
}

const defaultSettings: AppSettings = {
  appName: 'VENTI',
  productView: 'grid',
  navigationLayout: 'sidebar',
  product_sortOrder: 'desc',
  product_hideOutOfStock: false,
  feature_enableTailorWorkflow: true,
  sale_preventNegativeStock: true,
  receipt_showHeader: true,
  receipt_showLogo: true,
  receipt_showShopName: true,
  receipt_showAddress: true,
  receipt_showPhone: true,
  receipt_showWhatsapp: true,
  receipt_showOrderNumber: true,
  receipt_showSeller: false,
  receipt_showCustomerInfo: true,
  receipt_headerText: 'VENTI',
  receipt_footerText: 'شكراً لزيارتكم!\\nيمكن استبدال المبيعات خلال 14 يوم',
  receipt_shopNameFontSize_pt: 14,
  receipt_detailsFontSize_pt: 10,
  receipt_itemsFontSize_pt: 10,
  receipt_totalsFontSize_pt: 10,
  receipt_footerFontSize_pt: 9,
  label_showPrice: true,
  label_showSize: true,
  label_showBarcodeLines: true,
  label_barcode_sample: '900000001',
  label_width_mm: 35,
  label_height_mm: 25,
  label_barcodeHeight_mm: 8,
  label_productNameFontSize_pt: 10,
  label_detailsFontSize_pt: 8,
  label_barcodeValueFontSize_pt: 7,
  label_productName_x_mm: 17.5,
  label_productName_y_mm: 2,
  label_price_x_mm: 17.5,
  label_price_y_mm: 7,
  label_size_x_mm: 17.5,
  label_size_y_mm: 11,
  label_barcode_x_mm: 17.5,
  label_barcode_y_mm: 16,
  label_barcodeValue_x_mm: 17.5,
  label_barcodeValue_y_mm: 22,
  tailor_showLogo: false,
  tailor_showShopName: true,
  tailor_shopName: 'VENTI',
  tailor_showContact: true,
  tailor_contactInfo: '01234567890',
  tailor_disclaimer: 'الرجاء إحضار هذا الوصل عند الاستلام. المحل غير مسؤول عن الفستان بعد 30 يومًا من تاريخ التسليم المتوقع.',
};


interface SettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  updateSetting: (key: keyof AppSettings, value: any) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const db = useDatabase();

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const settingsRef = ref(db, 'settings');
    const handleValue = (snapshot: any) => {
      if (snapshot.exists()) {
        const dbSettings = snapshot.val();
        // Merge with defaults to ensure all keys are present
        setSettings({ ...defaultSettings, ...dbSettings });
      } else {
        // If no settings in DB, set the defaults
        set(settingsRef, defaultSettings);
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    };

    const handleError = (err: Error) => {
      console.error("RTDB listener error at path: settings", err);
      setError(err);
      setIsLoading(false);
    };

    onValue(settingsRef, handleValue, handleError);

    return () => {
      off(settingsRef, 'value', handleValue);
    };
  }, [db]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (!db) throw new Error("Database not connected.");
    const settingsRef = ref(db, 'settings');
    setSettings(prev => ({...prev, ...updates}));
    await update(settingsRef, updates);
  }, [db]);

  const updateSetting = useCallback(async (key: keyof AppSettings, value: any) => {
    if (!db) throw new Error("Database not connected.");
    const settingsRef = ref(db, 'settings');
    setSettings(prev => ({...prev, [key]: value}));
    await update(settingsRef, {[key]: value});
  }, [db]);


  return (
    <SettingsContext.Provider value={{ settings, isLoading, error, updateSettings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
