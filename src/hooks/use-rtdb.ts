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
  off,
} from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db, type PersistentCacheItem } from '@/lib/db';

// ذاكرة مشتركة خارج الـ Hook للحفاظ على البيانات بين عمليات الـ Render لنفس المسار
const globalMemoryCache: Record<string, Map<string, any>> = {};

// الجداول التي تحتاج مزامنة فارقة (Delta Sync) لتوفير البيانات (المنتجات والطلبات الكبيرة)
const DELTA_SYNC_PATHS = ['products', 'daily-entries'];

/**
 * محرك جلب البيانات المطور (الإصدار 7.0 - استراتيجية مختلطة):
 * 1. المنتجات والطلبات: تحميل من الكاش المحلي + مزامنة الجديد فقط (Delta Sync) لتوفير الباقة.
 * 2. الورديات والمستخدمين والفروع: مزامنة كاملة لضمان الدقة اللحظية.
 */
export function useRtdbList<T>(path: string, options?: { limit?: number }) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  if (!globalMemoryCache[path]) {
    globalMemoryCache[path] = new Map();
  }
  const itemsMap = globalMemoryCache[path];

  const cacheBufferRef = useRef<PersistentCacheItem[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMap.values()).sort((a, b) => {
        const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "0";
        const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "0";
        // الترتيب التنازلي (الأحدث أولاً)
        return dateB > dateA ? 1 : -1;
    });
  }, [itemsMap]);

  const queueRender = useCallback(() => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = setTimeout(() => {
          setData(getSortedArray());
      }, 150); 
  }, [getSortedArray]);

  const flushCacheBuffer = async () => {
      if (cacheBufferRef.current.length === 0) return;
      const items = [...cacheBufferRef.current];
      cacheBufferRef.current = [];
      try {
          await db.persistentCache.bulkPut(items);
      } catch (err) {
          console.error("Failed to sync IndexedDB:", err);
      }
  };

  const queueCacheSave = (item: PersistentCacheItem) => {
      if (!DELTA_SYNC_PATHS.includes(path)) return; // لا نحفظ الجداول الصغيرة اللحظية
      cacheBufferRef.current.push(item);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushCacheBuffer, 1000);
  };

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    
    const startSync = async () => {
        const isDeltaPath = DELTA_SYNC_PATHS.includes(path);

        // 1. تحميل الكاش المحلي (فقط للجداول الكبيرة)
        if (isDeltaPath && itemsMap.size === 0) {
            try {
                const cachedItems = await db.persistentCache
                    .where('path')
                    .equals(path)
                    .toArray();
                
                if (isMounted && cachedItems.length > 0) {
                    cachedItems.forEach(item => {
                        itemsMap.set(item.id, { ...item.data, id: item.id });
                    });
                    setData(getSortedArray());
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Dexie Error:", err);
            }
        }

        // 2. تحديد توقيت المزامنة
        let lastKnownUpdate = "";
        if (isDeltaPath) {
            itemsMap.forEach(item => {
                if (item.updatedAt && item.updatedAt > lastKnownUpdate) {
                    lastKnownUpdate = item.updatedAt;
                }
            });
        }

        const dbRef = ref(dbRTDB, path);
        const syncQuery = (isDeltaPath && lastKnownUpdate)
            ? query(dbRef, orderByChild('updatedAt'), startAt(lastKnownUpdate))
            : dbRef;

        const handleSnapshot = (snapshot: any) => {
            if (!isMounted) return;
            const val = snapshot.val();
            const key = snapshot.key!;

            const processItem = (id: string, data: any, datePath?: string) => {
                const existing = itemsMap.get(id);
                // منع التكرار إذا كانت البيانات متطابقة زمنياً
                if (existing && data.updatedAt && existing.updatedAt === data.updatedAt) return false;

                const finalData = { ...data, id, datePath };
                itemsMap.set(id, finalData);
                
                if (isDeltaPath) {
                    queueCacheSave({
                        key: `${path}/${id}`,
                        path: path,
                        id: id,
                        data: finalData,
                        updatedAt: finalData.updatedAt || new Date().toISOString()
                    });
                }
                return true;
            };

            let hasChanges = false;
            if (path === 'daily-entries') {
                if (val && val.orders) {
                    Object.keys(val.orders).forEach(oKey => {
                        if (processItem(oKey, val.orders[oKey], key)) hasChanges = true;
                    });
                }
            } else if (val) {
                if (processItem(key, val)) hasChanges = true;
            }
            
            if (hasChanges || isLoading) {
                setIsLoading(false);
                queueRender();
            }
        };

        const unsubscribeAdded = onChildAdded(syncQuery, handleSnapshot);
        const unsubscribeChanged = onChildChanged(syncQuery, handleSnapshot);
        const unsubscribeRemoved = onChildRemoved(dbRef, async (snapshot) => {
            const key = snapshot.key!;
            if (path === 'daily-entries') {
                 itemsMap.forEach((item, id) => {
                     if (item.datePath === key) {
                        itemsMap.delete(id);
                        if (isDeltaPath) db.persistentCache.delete(`${path}/${id}`);
                     }
                 });
            } else {
                itemsMap.delete(key);
                if (isDeltaPath) db.persistentCache.delete(`${path}/${key}`);
            }
            queueRender();
        });

        // ضمان إغلاق حالة التحميل بعد فترة زمنية معينة
        const loaderTimer = setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, isDeltaPath ? 5000 : 2000);

        return () => {
            clearTimeout(loaderTimer);
            off(syncQuery);
            off(dbRef);
        };
    };

    startSync();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [path, dbRTDB, getSortedArray, queueRender]); 

  return { data, isLoading, error };
}