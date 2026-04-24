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

/**
 * محرك جلب البيانات المطور (الإصدار 5.0 - توفير البيانات القصوى):
 * 1. لا يطلب أي بيانات من السيرفر إلا إذا كانت أحدث من النسخة المحلية.
 * 2. يستخدم ذاكرة Static لمنع إعادة المزامنة عند التنقل بين الصفحات.
 * 3. يدعم 3500+ صنف بكفاءة عبر تقليل الـ Object Creation.
 */
export function useRtdbList<T>(path: string, queryOptions?: { 
    limit?: number, 
    orderBy?: string, 
}) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  // استخدام الذاكرة العالمية أو إنشاء واحدة جديدة للمسار الحالي
  if (!globalMemoryCache[path]) {
    globalMemoryCache[path] = new Map();
  }
  const itemsMap = globalMemoryCache[path];

  const cacheBufferRef = useRef<PersistentCacheItem[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMap.values()).sort((a, b) => {
        const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "";
        const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "";
        return dateB > dateA ? 1 : -1;
    });
  }, [itemsMap, path]);

  const queueRender = useCallback(() => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = setTimeout(() => {
          setData(getSortedArray());
      }, 500); 
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
      cacheBufferRef.current.push(item);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushCacheBuffer, 2000);
  };

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    
    const startSync = async () => {
        // 1. تحميل الكاش المحلي فوراً إذا كانت الذاكرة فارغة
        if (itemsMap.size === 0) {
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
        } else {
            // البيانات موجودة بالفعل في الذاكرة من زيارة سابقة
            setData(getSortedArray());
            setIsLoading(false);
        }

        // 2. تحديد آخر وقت تحديث بدقة لمنع جلب البيانات القديمة
        let lastKnownUpdate = "1970-01-01T00:00:00.000Z";
        itemsMap.forEach(item => {
            if (item.updatedAt && item.updatedAt > lastKnownUpdate) {
                lastKnownUpdate = item.updatedAt;
            }
        });

        const dbRef = ref(dbRTDB, path);
        
        // استخدام استعلام ذكي يجلب فقط ما تم تحديثه "بعد" آخر تحديث لديك
        const syncQuery = query(dbRef, orderByChild('updatedAt'), startAt(lastKnownUpdate));

        const handleSnapshot = (snapshot: any) => {
            if (!isMounted) return;
            const val = snapshot.val();
            const key = snapshot.key!;

            // دالة لمعالجة وتخزين كل عنصر
            const processItem = (id: string, data: any, datePath?: string) => {
                const existing = itemsMap.get(id);
                // منع التحديث إذا كان التوقيت والبيانات متطابقين
                if (existing && existing.updatedAt === data.updatedAt) return;

                const finalData = { ...data, id, datePath };
                itemsMap.set(id, finalData);
                queueCacheSave({
                    key: `${path}/${id}`,
                    path: path,
                    id: id,
                    data: finalData,
                    updatedAt: finalData.updatedAt || new Date().toISOString()
                });
                return true;
            };

            let hasChanges = false;
            if (path === 'daily-entries') {
                if (val.orders) {
                    Object.keys(val.orders).forEach(oKey => {
                        if (processItem(oKey, val.orders[oKey], key)) hasChanges = true;
                    });
                }
            } else {
                if (processItem(key, val)) hasChanges = true;
            }
            
            if (hasChanges) queueRender();
        };

        const unsubscribeAdded = onChildAdded(syncQuery, handleSnapshot);
        const unsubscribeChanged = onChildChanged(syncQuery, handleSnapshot);
        const unsubscribeRemoved = onChildRemoved(dbRef, async (snapshot) => {
            const key = snapshot.key!;
            if (path === 'daily-entries') {
                 const items = Array.from(itemsMap.values());
                 for (const item of items) {
                     if (item.datePath === key) {
                        itemsMap.delete(item.id);
                        await db.persistentCache.delete(`${path}/${item.id}`);
                     }
                 }
            } else {
                itemsMap.delete(key);
                await db.persistentCache.delete(`${path}/${key}`);
            }
            queueRender();
        });

        // التأكد من إغلاق حالة التحميل بعد فترة قصيرة حتى لو لم تصل بيانات
        const loaderTimer = setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, 3000);

        return () => {
            clearTimeout(loaderTimer);
            off(syncQuery);
            off(dbRef);
        };
    };

    const cleanupSyncPromise = startSync();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [path, dbRTDB]); 

  return { data, isLoading, error };
}
