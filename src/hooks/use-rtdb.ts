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

/**
 * محرك جلب البيانات المطور (الإصدار 3.0 - نظام الدفعات):
 * 1. يحمل البيانات فوراً من IndexedDB.
 * 2. يجمع التحديثات القادمة من السيرفر في "بافر" ويحفظها كمجموعة واحدة لتجنب بطء المتصفح.
 * 3. يقلل عدد مرات إعادة رسم الواجهة (Rendering) لضمان سلاسة التعامل مع آلاف الأصناف.
 */
export function useRtdbList<T>(path: string, queryOptions?: { 
    limit?: number, 
    orderBy?: string, 
}) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  const itemsMapRef = useRef<Map<string, any>>(new Map());
  const cacheBufferRef = useRef<PersistentCacheItem[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMapRef.current.values()).sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.orderDate || a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.orderDate || b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
    });
  }, []);

  const queueRender = useCallback(() => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = setTimeout(() => {
          setData(getSortedArray());
          setIsLoading(false);
      }, 150); // تجميع تحديثات الواجهة كل 150 ملجم
  }, [getSortedArray]);

  const flushCacheBuffer = async () => {
      if (cacheBufferRef.current.length === 0) return;
      const items = [...cacheBufferRef.current];
      cacheBufferRef.current = [];
      try {
          await db.persistentCache.bulkPut(items);
      } catch (err) {
          console.error("Failed to bulk put items to Dexie:", err);
      }
  };

  const queueCacheSave = (item: PersistentCacheItem) => {
      cacheBufferRef.current.push(item);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushCacheBuffer, 500); // حفظ في الداتابيز كل نصف ثانية
  };

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    itemsMapRef.current.clear();

    const startSync = async () => {
        // 1. استرجاع البيانات من الكاش المحلي أولاً (Dexie) بسرعة
        try {
            const cachedItems = await db.persistentCache
                .where('path')
                .equals(path)
                .toArray();
            
            if (cachedItems.length > 0 && isMounted) {
                cachedItems.forEach(item => {
                    itemsMapRef.current.set(item.id, { ...item.data, id: item.id });
                });
                setData(getSortedArray());
                setIsLoading(false);
            }
        } catch (err) {
            console.error("Dexie Load Error:", err);
        }

        // 2. تحديد نقطة بداية المزامنة لجلب "الجديد/المعدل" فقط
        let lastKnownUpdate = "1970-01-01T00:00:00.000Z";
        itemsMapRef.current.forEach(item => {
            if (item.updatedAt && item.updatedAt > lastKnownUpdate) {
                lastKnownUpdate = item.updatedAt;
            }
        });

        const dbRef = ref(dbRTDB, path);
        let syncQuery: any = dbRef;

        // تفعيل المزامنة الذكية للأصناف لتقليل استهلاك البيانات
        if (path === 'products') {
            syncQuery = query(dbRef, orderByChild('updatedAt'), startAt(lastKnownUpdate));
        }

        const handleSnapshot = (snapshot: any) => {
            if (!isMounted) return;
            const val = snapshot.val();
            const key = snapshot.key!;

            if (path === 'daily-entries') {
                if (val.orders) {
                    Object.keys(val.orders).forEach(oKey => {
                        const orderData = { ...val.orders[oKey], id: oKey, datePath: key };
                        itemsMapRef.current.set(oKey, orderData);
                        queueCacheSave({
                            key: `${path}/${oKey}`,
                            path: path,
                            id: oKey,
                            data: orderData,
                            updatedAt: orderData.updatedAt || new Date().toISOString()
                        });
                    });
                }
            } else {
                const itemData = { ...val, id: key };
                itemsMapRef.current.set(key, itemData);
                queueCacheSave({
                    key: `${path}/${key}`,
                    path: path,
                    id: key,
                    data: itemData,
                    updatedAt: itemData.updatedAt || new Date().toISOString()
                });
            }
            queueRender();
        };

        const unsubscribeAdded = onChildAdded(syncQuery, handleSnapshot);
        const unsubscribeChanged = onChildChanged(syncQuery, handleSnapshot);
        const unsubscribeRemoved = onChildRemoved(dbRef, async (snapshot) => {
            const key = snapshot.key!;
            if (path === 'daily-entries') {
                 const items = Array.from(itemsMapRef.current.values());
                 for (const item of items) {
                     if (item.datePath === key) {
                        itemsMapRef.current.delete(item.id);
                        await db.persistentCache.delete(`${path}/${item.id}`);
                     }
                 }
            } else {
                itemsMapRef.current.delete(key);
                await db.persistentCache.delete(`${path}/${key}`);
            }
            queueRender();
        });

        // انتهاء التحميل الأولي إذا لم توجد بيانات جديدة
        setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, 2000);

        return () => {
            off(syncQuery);
            off(dbRef);
        };
    };

    const cleanupSyncPromise = startSync();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      cleanupSyncPromise.then(cleanup => cleanup && cleanup());
    };
  }, [path, dbRTDB, queueRender, getSortedArray]);

  return { data, isLoading, error };
}
