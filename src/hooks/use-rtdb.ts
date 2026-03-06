'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, off, DatabaseReference, DataSnapshot } from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db } from '@/lib/db'; // Import dexie db

/**
 * A custom hook to listen for data changes in a Firebase Realtime Database path and return it as a list.
 * It handles both simple lists (e.g., /products) and nested object structures (e.g., /daily-entries/{date}/orders).
 * It now uses a local cache (Dexie) for faster initial loads and offline support.
 *
 * @param path The path to the data in the Realtime Database.
 * @returns An object containing the data list, a loading state, and any error that occurred.
 */
export function useRtdbList<T>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRTDB = useDatabase();

  const processSnapshot = useCallback((val: any): T[] => {
    const itemMap = new Map<string, any>();
    if (!val || typeof val !== 'object') {
      return [];
    }

    const isNestedDailyEntries = path === 'daily-entries' && Object.values(val).some(
      (child: any) => child && typeof child === 'object' && 'orders' in child
    );

    if (isNestedDailyEntries) {
      Object.values(val).forEach((dateEntry: any) => {
        if (dateEntry.orders && typeof dateEntry.orders === 'object') {
          Object.keys(dateEntry.orders).forEach(orderKey => {
            // Use orderKey as the unique identifier to prevent duplicates
            if (!itemMap.has(orderKey)) {
              itemMap.set(orderKey, { ...dateEntry.orders[orderKey], id: orderKey });
            }
          });
        }
      });
    } else {
      Object.keys(val).forEach(key => {
        if (!itemMap.has(key)) {
          itemMap.set(key, { ...val[key], id: key });
        }
      });
    }
    return Array.from(itemMap.values());
  }, [path]);

  useEffect(() => {
    let isMounted = true;

    async function setupListener() {
      // 1. Try to load from cache
      try {
        const cachedItem = await db.dataCache.get(path);
        if (isMounted && cachedItem) {
          const list = processSnapshot(cachedItem.data);
          setData(list);
          setIsLoading(false); // We have data, don't show loading skeleton
        }
      } catch (e) {
        console.warn(`Dexie cache read failed for path: ${path}`, e);
      }

      // 2. Setup Firebase listener if online
      if (!dbRTDB) {
        setIsLoading(false);
        return () => {}; // Return empty cleanup function
      }
      
      const dbRef = ref(dbRTDB, path);

      const handleValue = (snapshot: DataSnapshot) => {
        if (!isMounted) return;
        try {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const list = processSnapshot(val);
            setData(list);
            setError(null);
            db.dataCache.put({ path, data: val, timestamp: Date.now() }).catch(e => console.warn("Dexie cache write failed", e));
          } else {
            setData([]);
            setError(null);
            db.dataCache.delete(path).catch(e => console.warn("Dexie cache delete failed", e));
          }
        } catch (e: any) {
          console.error(`Error processing RTDB data at path: ${path}`, e);
          setError(e);
        } finally {
          setIsLoading(false);
        }
      };

      const handleError = (err: Error) => {
        if (!isMounted) return;
        console.error(`RTDB listener error at path: ${path}`, err);
        setError(err);
        setIsLoading(false);
      };
      
      onValue(dbRef, handleValue, handleError);

      return () => {
        off(dbRef, 'value', handleValue);
      };
    }

    const cleanupPromise = setupListener();

    return () => {
      isMounted = false;
      cleanupPromise.then(cleanup => {
        if (cleanup) {
          cleanup();
        }
      });
    };
  }, [path, dbRTDB, processSnapshot]);

  return { data, isLoading, error };
}
