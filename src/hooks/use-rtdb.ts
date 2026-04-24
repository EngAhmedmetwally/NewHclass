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
  get
} from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db, type PersistentCacheItem } from '@/lib/db';

/**
 * محرك جلب البيانات المطور (الإصدار 2.0):
 * 1. يحمل البيانات فوراً من IndexedDB (سرعة + توفير بيانات).
 * 2. يبدأ المزامنة من آخر وقت تعديل معروف (Delta Sync).
 * 3. يحفظ التعديلات الجديدة في الذاكرة المحلية تلقائياً.
 */
export function useRtdbList<T>(path: string, queryOptions?: { 
    limit?: number, 
    orderBy?: string, 
}) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();
  
  // خريطة في الذاكرة للدمج السريع
  const itemsMapRef = useRef<Map<string, any>>(new Map());

  const getSortedArray = useCallback(() => {
    return Array.from(itemsMapRef.current.values()).sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.orderDate || a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.orderDate || b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
    });
  }, []);

  useEffect(() => {
    if (!dbRTDB) return;

    let isMounted = true;
    setIsLoading(true);
    itemsMapRef.current.clear();

    const startSync = async () => {
        // 1. استرجاع البيانات من الكاش المحلي أولاً (Dexie)
        try {
            const cachedItems = await db.persistentCache
                .where('path')
                .equals(path)
                .toArray();
            
            if (cachedItems.length > 0 && isMounted) {
                cachedItems.forEach(item => {
                    itemsMapRef.current.set(item.id, { ...item.data, id: item.id, datePath: item.data.datePath });
                });
                setData(getSortedArray());
                // استمر فى التحميل للتأكد من وجود أحدث التعديلات
            }
        } catch (err) {
            console.error("Dexie Load Error:", err);
        }

        // 2. تحديد نقطة بداية المزامنة (أحدث updatedAt)
        let lastKnownUpdate = "1970-01-01T00:00:00.000Z";
        itemsMapRef.current.forEach(item => {
            if (item.updatedAt && item.updatedAt > lastKnownUpdate) {
                lastKnownUpdate = item.updatedAt;
            }
        });

        // 3. الاتصال بـ Firebase لجلب "الجديد فقط"
        const dbRef = ref(dbRTDB, path);
        let syncQuery: any = dbRef;

        // للمنتجات، نستخدم Delta Sync حقيقي عبر الـ Timestamp
        if (path === 'products') {
            syncQuery = query(dbRef, orderByChild('updatedAt'), startAt(lastKnownUpdate));
        }

        const handleSnapshot = async (snapshot: any, eventType: 'added' | 'changed') => {
            if (!isMounted) return;
            const val = snapshot.val();
            const key = snapshot.key!;

            if (path === 'daily-entries') {
                if (val.orders) {
                    const updates: PersistentCacheItem[] = [];
                    Object.keys(val.orders).forEach(oKey => {
                        const orderData = { ...val.orders[oKey], id: oKey, datePath: key };
                        itemsMapRef.current.set(oKey, orderData);
                        updates.push({
                            key: `${path}/${oKey}`,
                            path: path,
                            id: oKey,
                            data: orderData,
                            updatedAt: orderData.updatedAt || new Date().toISOString()
                        });
                    });
                    await db.persistentCache.bulkPut(updates);
                }
            } else {
                const itemData = { ...val, id: key };
                itemsMapRef.current.set(key, itemData);
                await db.persistentCache.put({
                    key: `${path}/${key}`,
                    path: path,
                    id: key,
                    data: itemData,
                    updatedAt: itemData.updatedAt || new Date().toISOString()
                });
            }
            setData(getSortedArray());
            setIsLoading(false);
        };

        const unsubscribeAdded = onChildAdded(syncQuery, (snapshot) => handleSnapshot(snapshot, 'added'));
        const unsubscribeChanged = onChildChanged(syncQuery, (snapshot) => handleSnapshot(snapshot, 'changed'));
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
            setData(getSortedArray());
        });

        // إذا لم يكن هناك استجابة خلال ثوانٍ، نعتبر التحميل الأولي انتهى
        setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, 3000);

        return () => {
            off(syncQuery);
            off(dbRef);
        };
    };

    const cleanupSync = startSync();

    return () => {
      isMounted = false;
      cleanupSync.then(cleanup => cleanup && cleanup());
    };
  }, [path, dbRTDB, getSortedArray]);

  return { data, isLoading, error };
}
