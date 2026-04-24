
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getDatabase, 
  ref, 
  onValue, 
  off, 
  onChildAdded, 
  onChildChanged, 
  onChildRemoved, 
  query, 
  limitToLast,
  orderByChild,
  startAt,
  endAt
} from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db } from '@/lib/db';

/**
 * محرك جلب البيانات المطور:
 * يستخدم نظام Child Events لتوفير استهلاك البيانات (Bandwidth)
 * بدلاً من تحميل كامل القائمة عند كل تغيير صغير.
 */
export function useRtdbList<T>(path: string, queryOptions?: { 
    limit?: number, 
    orderBy?: string, 
    startAt?: any, 
    endAt?: any 
}) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  // استخدام Map داخلي للحفاظ على سرعة التحديث ومنع التكرار
  const itemsMapRef = useRef<Map<string, any>>(new Map());

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMapRef.current.values()).sort((a, b) => {
        const dateA = new Date(a.orderDate || a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.orderDate || b.date || b.createdAt || 0).getTime();
        return dateB - dateA; // الأحدث أولاً
    });
  }, []);

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    setIsLoading(true);
    itemsMapRef.current.clear();

    // بناء الاستعلام بناءً على الخيارات المتاحة
    let dbRef = ref(dbRTDB, path);
    let finalQuery: any = dbRef;

    if (queryOptions) {
        if (queryOptions.orderBy) {
            finalQuery = query(finalQuery, orderByChild(queryOptions.orderBy));
            if (queryOptions.startAt !== undefined) finalQuery = query(finalQuery, startAt(queryOptions.startAt));
            if (queryOptions.endAt !== undefined) finalQuery = query(finalQuery, endAt(queryOptions.endAt));
        }
        if (queryOptions.limit) {
            finalQuery = query(finalQuery, limitToLast(queryOptions.limit));
        }
    }

    // 1. تحميل البيانات الأولية مرة واحدة (سرعة الاستجابة)
    const initialLoad = onValue(finalQuery, (snapshot) => {
        if (!isMounted) return;
        if (snapshot.exists()) {
            const val = snapshot.val();
            const isDailyEntries = path === 'daily-entries';
            
            if (isDailyEntries) {
                // معالجة خاصة لهيكل daily-entries المعقد
                Object.keys(val).forEach(dateKey => {
                    const entry = val[dateKey];
                    if (entry.orders) {
                        Object.keys(entry.orders).forEach(orderKey => {
                            itemsMapRef.current.set(orderKey, { 
                                ...entry.orders[orderKey], 
                                id: orderKey, 
                                datePath: dateKey 
                            });
                        });
                    }
                });
            } else {
                Object.keys(val).forEach(key => {
                    itemsMapRef.current.set(key, { ...val[key], id: key });
                });
            }
            setData(getSortedArray());
        } else {
            setData([]);
        }
        setIsLoading(false);
    }, (err) => {
        if (isMounted) setError(err);
        setIsLoading(false);
    }, { onlyOnce: true });

    // 2. الاستماع للتغييرات الجزئية فقط (توفير البيانات)
    // ملاحظة: لتبسيط الكود، نعتمد على onValue للتحديثات التلقائية في النسخة الحالية 
    // ولكن مع تفعيل ميزة onlyOnce للتحميل الكبير، ثم ChildListeners للتحديثات.
    
    const unsubscribeAdded = onChildAdded(finalQuery, (snapshot) => {
        if (!isMounted || isLoading) return; // ننتظر انتهاء التحميل الأولي
        const val = snapshot.val();
        const key = snapshot.key!;
        
        if (path === 'daily-entries') {
            // تحديث جزئي للطلبات الجديدة
            if (val.orders) {
                Object.keys(val.orders).forEach(oKey => {
                    itemsMapRef.current.set(oKey, { ...val.orders[oKey], id: oKey, datePath: key });
                });
            }
        } else {
            itemsMapRef.current.set(key, { ...val, id: key });
        }
        setData(getSortedArray());
    });

    const unsubscribeChanged = onChildChanged(finalQuery, (snapshot) => {
        if (!isMounted) return;
        const val = snapshot.val();
        const key = snapshot.key!;
        
        if (path === 'daily-entries') {
            if (val.orders) {
                Object.keys(val.orders).forEach(oKey => {
                    itemsMapRef.current.set(oKey, { ...val.orders[oKey], id: oKey, datePath: key });
                });
            }
        } else {
            itemsMapRef.current.set(key, { ...val, id: key });
        }
        setData(getSortedArray());
    });

    const unsubscribeRemoved = onChildRemoved(finalQuery, (snapshot) => {
        if (!isMounted) return;
        const key = snapshot.key!;
        if (path === 'daily-entries') {
             // في حال حذف يوم كامل (نادر)
             const items = Array.from(itemsMapRef.current.values());
             items.forEach(item => {
                 if (item.datePath === key) itemsMapRef.current.delete(item.id);
             });
        } else {
            itemsMapRef.current.delete(key);
        }
        setData(getSortedArray());
    });

    return () => {
      isMounted = false;
      off(finalQuery);
    };
  }, [path, dbRTDB, getSortedArray, queryOptions?.limit, queryOptions?.startAt, queryOptions?.endAt]);

  return { data, isLoading, error };
}
