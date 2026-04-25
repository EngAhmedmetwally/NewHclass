
'use client';

import { useState, useEffect } from 'react';
import { 
  ref, 
  onValue, 
  off, 
  query, 
  limitToLast 
} from 'firebase/database';
import { useDatabase } from '@/firebase';

/**
 * محرك بيانات بسيط ومباشر (Realtime Only)
 * تم إلغاء كافة تعقيدات الـ Delta Sync لضمان السرعة القصوى والموثوقية.
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
    
    if (options?.limit) {
        syncQuery = query(dbRef, limitToLast(options.limit));
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
            // استخدام Map لضمان عدم تكرار أي مفاتيح (Prevent Duplicate Keys)
            const orderMap = new Map();
            Object.keys(val).forEach(dateKey => {
                const dayData = val[dateKey];
                if (dayData.orders) {
                    Object.keys(dayData.orders).forEach(orderId => {
                        // الاحتفاظ بالنسخة الأحدث فقط من الطلب في حالة وجود تكرار
                        orderMap.set(orderId, { 
                            ...dayData.orders[orderId], 
                            id: orderId,
                            datePath: dateKey 
                        });
                    });
                }
            });
            list.push(...Array.from(orderMap.values()) as T[]);
        } else {
            // تحويل الكائن القياسي إلى مصفوفة
            Object.keys(val).forEach(key => {
                list.push({ ...val[key], id: key });
            });
        }

        // ترتيب تنازلي حسب تاريخ التحديث أو الإنشاء
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
