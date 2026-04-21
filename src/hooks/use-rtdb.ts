'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, off, DatabaseReference, DataSnapshot } from 'firebase/database';
import { useDatabase } from '@/firebase';
import { db } from '@/lib/db'; // Import dexie db

/**
 * A custom hook to listen for data changes in a Firebase Realtime Database path and return it as a list.
 * It handles both simple lists (e.g., /products) and nested object structures (e.g., /daily-entries/{date}/orders).
 * It now uses a local cache (Dexie) for faster initial loads and offline support.
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

    // Explicit check for daily-entries structure
    const isDailyEntriesPath = path === 'daily-entries';

    if (isDailyEntriesPath) {
      // Iterate through all date keys (e.g., 2023-10-01)
      // Sort keys to process older dates first, so newer partial updates merge onto full older records
      const dateKeys = Object.keys(val).sort();
      
      dateKeys.forEach((dateKey: string) => {
        const dateEntry = val[dateKey];
        if (dateEntry && typeof dateEntry === 'object') {
            
            // 1. Check inside 'orders' folder if it exists
            if (dateEntry.orders && typeof dateEntry.orders === 'object') {
                Object.keys(dateEntry.orders).forEach(orderKey => {
                    const existing = itemMap.get(orderKey) || {};
                    const newData = dateEntry.orders[orderKey];
                    
                    // MERGE LOGIC: Don't overwrite full record with partial update
                    itemMap.set(orderKey, { 
                        ...existing,
                        ...newData, 
                        id: orderKey, 
                        // Keep the original datePath if we already have it, or set if new
                        datePath: existing.datePath || dateKey 
                    });
                });
            } 
            
            // 2. Check directly under the date folder for other structures
            Object.keys(dateEntry).forEach(key => {
                if (key === 'orders' || key === 'id' || key === 'datePath') return;
                
                const possibleOrder = dateEntry[key];
                if (possibleOrder && typeof possibleOrder === 'object') {
                    // Only treat as an order if it has some identifying properties
                    if (possibleOrder.customerName || possibleOrder.orderCode || possibleOrder.transactionType) {
                        const existing = itemMap.get(key) || {};
                        itemMap.set(key, { 
                            ...existing,
                            ...possibleOrder, 
                            id: key, 
                            datePath: existing.datePath || dateKey 
                        });
                    }
                }
            });
        }
      });
    } else {
      // Simple flat list structure
      Object.keys(val).forEach(key => {
        if (!itemMap.has(key)) {
          itemMap.set(key, { ...val[key], id: key });
        }
      });
    }
    
    // Sort by orderDate descending (Latest first)
    return Array.from(itemMap.values()).sort((a: any, b: any) => {
        const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
        return dateB - dateA;
    });
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
          setIsLoading(false);
        }
      } catch (e) {
        console.warn(`Dexie cache read failed for path: ${path}`, e);
      }

      // 2. Setup Firebase listener if online
      if (!dbRTDB) {
        setIsLoading(false);
        return () => {};
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
            db.dataCache.put({ path, data: val, timestamp: Date.now() })
              .catch(e => console.warn("Dexie cache write failed", e));
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
