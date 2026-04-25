
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
 * محرك بيانات بسيط ومباشر (Realtime Only)
 * تم تحسينه لاستخدام الـ Indexes من جهة السيرفر لضمان السرعة.
 */
export function useRtdbList<T>(path: string, options?: { limit?: number }) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();

  useEffect(() => {
    if (!dbRTDB) return;

    const dbRef = ref(dbRTDB, path);
    let syncQuery: any = dbRef;
    
    // استخدام orderByKey() مع limitToLast() يضمن جلب أحدث العناصر بكفاءة عالية من السيرفر
    if (options?.limit) {
        syncQuery = query(dbRef, orderByKey(), limitToLast(options.limit));
    }

    const unsubscribe = onValue(syncQuery, (snapshot) => {
        const val = snapshot.val();
        if (!val) {
            setData([]);
            setIsLoading(false);
            return;
        }

        const list: T[] = [];
        
        if (path === 'daily-entries') {
            const orderMap = new Map();
            Object.keys(val).forEach(dateKey => {
                const dayData = val[dateKey];
                if (dayData && dayData.orders) {
                    Object.keys(dayData.orders).forEach(orderId => {
                        const order = dayData.orders[orderId];
                        // استخدام مفتاح مركب لضمان عدم حدوث تكرار في الـ Keys (Fixes NextJS Duplicate Key Error)
                        orderMap.set(orderId, { 
                            ...order, 
                            id: orderId,
                            datePath: dateKey,
                            uniqueKey: `${dateKey}_${orderId}`
                        });
                    });
                }
            });
            list.push(...Array.from(orderMap.values()) as T[]);
        } else {
            Object.keys(val).forEach(key => {
                list.push({ ...val[key], id: key });
            });
        }

        // ترتيب تنازلي بسيط
        list.sort((a: any, b: any) => {
            const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "0";
            const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "0";
            return dateB > dateA ? 1 : -1;
        });

        setData(list);
        setIsLoading(false);
    }, (err) => {
        console.error(`RTDB Connection Error at ${path}:`, err);
        setError(err);
        setIsLoading(false);
    });

    return () => off(syncQuery);
  }, [path, dbRTDB, options?.limit]);

  return { data, isLoading, error };
}
