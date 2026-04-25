
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ref, 
  onChildAdded, 
  onChildChanged, 
  onChildRemoved, 
  query, 
  orderByChild,
  startAt,
  limitToLast,
  off,
} from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db, type PersistentCacheItem } from '@/lib/db';

// الذاكرة المشتركة للبيانات
const globalMemoryCache: Record<string, Map<string, any>> = {};
// إدارة المستمعين (Listeners) لمنع تكرار الاتصالات
const activeListeners: Record<string, { count: number; syncQuery: any; dbRef: any }> = {};

const DELTA_SYNC_PATHS = ['products', 'daily-entries'];

export function useRtdbList<T>(path: string, options?: { limit?: number }) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  if (!globalMemoryCache[path]) {
    globalMemoryCache[path] = new Map();
  }
  const itemsMap = globalMemoryCache[path];

  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMap.values()).sort((a, b) => {
        const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "0";
        const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "0";
        return dateB > dateA ? 1 : -1;
    });
  }, [itemsMap]);

  const queueRender = useCallback(() => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      // استخدام مهلة زمنية قصيرة جداً لتجميع التحديثات الكثيفة (Batching)
      renderTimeoutRef.current = setTimeout(() => {
          setData(getSortedArray());
      }, 30); 
  }, [getSortedArray]);

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    
    const initialize = async () => {
        const isDeltaPath = DELTA_SYNC_PATHS.includes(path);

        // 1. تحميل الكاش من المتصفح فوراً إذا لم تكن البيانات محملة في الذاكرة
        if (isDeltaPath && itemsMap.size === 0) {
            try {
                // جلب أحدث السجلات فقط من الكاش لسرعة الفتح
                const cachedItems = await db.persistentCache
                    .where('path').equals(path)
                    .reverse()
                    .limit(options?.limit || 1000)
                    .toArray();
                    
                if (isMounted && cachedItems.length > 0) {
                    cachedItems.forEach(item => itemsMap.set(item.id, { ...item.data, id: item.id }));
                    setData(getSortedArray());
                    setIsLoading(false);
                }
            } catch (err) { console.error("Cache load error:", err); }
        } else if (itemsMap.size > 0) {
            setData(getSortedArray());
            setIsLoading(false);
        }

        // 2. إدارة المستمع المشترك (Shared Listener)
        if (!activeListeners[path]) {
            let lastKnownUpdate = "";
            itemsMap.forEach(item => {
                if (item.updatedAt && item.updatedAt > lastKnownUpdate) lastKnownUpdate = item.updatedAt;
            });

            const dbRef = ref(dbRTDB, path);
            let syncQuery: any = dbRef;

            if (isDeltaPath) {
                if (lastKnownUpdate) {
                    syncQuery = query(dbRef, orderByChild('updatedAt'), startAt(lastKnownUpdate));
                } else if (options?.limit) {
                    syncQuery = query(dbRef, limitToLast(options.limit));
                }
            }

            const handleSnapshot = (snapshot: any) => {
                const val = snapshot.val();
                const key = snapshot.key!;
                let hasChanges = false;

                const processItem = (id: string, itemData: any, datePath?: string) => {
                    const finalData = { ...itemData, id, datePath };
                    itemsMap.set(id, finalData);
                    if (isDeltaPath) {
                        db.persistentCache.put({
                            key: `${path}/${id}`, path, id, data: finalData, updatedAt: finalData.updatedAt || new Date().toISOString()
                        });
                    }
                    return true;
                };

                if (path === 'daily-entries' && val?.orders) {
                    Object.keys(val.orders).forEach(oKey => { if (processItem(oKey, val.orders[oKey], key)) hasChanges = true; });
                } else if (val) {
                    if (processItem(key, val)) hasChanges = true;
                }
                
                if (hasChanges) queueRender();
            };

            onChildAdded(syncQuery, handleSnapshot);
            onChildChanged(syncQuery, handleSnapshot);
            onChildRemoved(dbRef, (snapshot) => {
                const key = snapshot.key!;
                if (path === 'daily-entries') {
                    itemsMap.forEach((item, id) => {
                        if (item.datePath === key) {
                            itemsMap.delete(id);
                            db.persistentCache.delete(`${path}/${id}`);
                        }
                    });
                } else {
                    itemsMap.delete(key);
                    db.persistentCache.delete(`${path}/${key}`);
                }
                queueRender();
            });

            activeListeners[path] = { count: 1, syncQuery, dbRef };
        } else {
            activeListeners[path].count++;
        }

        // مهلة أمان لإنهاء حالة التحميل في حال تعثر الشبكة
        const timer = setTimeout(() => { if (isMounted) setIsLoading(false); }, 4000);
        return () => clearTimeout(timer);
    };

    initialize();

    return () => {
        isMounted = false;
        if (activeListeners[path]) {
            activeListeners[path].count--;
            if (activeListeners[path].count <= 0) {
                off(activeListeners[path].syncQuery);
                off(activeListeners[path].dbRef);
                delete activeListeners[path];
            }
        }
        if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [path, dbRTDB, getSortedArray, queueRender, options?.limit]); 

  return { data, isLoading, error };
}
