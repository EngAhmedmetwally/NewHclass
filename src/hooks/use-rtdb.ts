'use client';

import { useState, useEffect } from 'react';
import { 
  ref, 
  onValue, 
  off, 
  query, 
  limitToLast,
  orderByKey
} from 'firebase/database';
import { useDatabase } from '@/firebase';

/**
 * محرك بيانات بسيط ومباشر (Direct Realtime Sync)
 * يضمن ظهور البيانات والورديات فور فتح الصفحة دون الحاجة لعمل ريفريش.
 */
export function useRtdbList<T>(path: string, options?: { limit?: number }) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();

  useEffect(() => {
    let isMounted = true;
    if (!dbRTDB) return;

    const dbRef = ref(dbRTDB, path);
    let syncQuery: any = dbRef;
    
    // استخدام التحميل المحدود لزيادة السرعة في الشاشات غير المالية
    if (options?.limit && (path === 'products' || path === 'daily-entries')) {
        syncQuery = query(dbRef, orderByKey(), limitToLast(options.limit));
    }

    const unsubscribe = onValue(syncQuery, (snapshot) => {
        if (!isMounted) return;
        
        const val = snapshot.val();
        if (!val) {
            setData([]);
            setIsLoading(false);
            return;
        }

        const list: T[] = [];
        
        if (path === 'daily-entries') {
            Object.keys(val).forEach(dateKey => {
                const dayData = val[dateKey];
                if (dayData && dayData.orders) {
                    Object.keys(dayData.orders).forEach(orderId => {
                        const order = dayData.orders[orderId];
                        list.push({ 
                            ...order, 
                            id: orderId,
                            datePath: dateKey,
                            uniqueKey: `${dateKey}_${orderId}`
                        } as T);
                    });
                }
            });
        } else {
            Object.keys(val).forEach(key => {
                list.push({ ...val[key], id: key });
            });
        }

        // ترتيب تنازلي بسيط لضمان ظهور الأحدث أولاً
        list.sort((a: any, b: any) => {
            const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "0";
            const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "0";
            return dateB > dateA ? 1 : -1;
        });

        setData(list);
        setIsLoading(false);
    }, (err) => {
        if (!isMounted) return;
        console.error(`RTDB Connection Error at ${path}:`, err);
        setError(err);
        setIsLoading(false);
    });

    return () => {
        isMounted = false;
        off(syncQuery);
    };
  }, [path, dbRTDB, options?.limit]);

  return { data, isLoading, error };
}
