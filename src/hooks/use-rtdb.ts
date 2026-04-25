
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
 * Standard RTDB hook - Removed all Delta Sync and complex caching.
 * Provides reliable, immediate realtime updates.
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
    
    // Limits are now optional and used only for performance on very large lists
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
            // Flatten orders from the date-based structure
            Object.keys(val).forEach(dateKey => {
                const dayData = val[dateKey];
                if (dayData.orders) {
                    Object.keys(dayData.orders).forEach(orderId => {
                        list.push({ 
                            ...dayData.orders[orderId], 
                            id: orderId,
                            datePath: dateKey 
                        });
                    });
                }
            });
        } else {
            // Standard Object to Array conversion
            Object.keys(val).forEach(key => {
                list.push({ ...val[key], id: key });
            });
        }

        // Sort by most recent first
        list.sort((a: any, b: any) => {
            const dateA = a.updatedAt || a.orderDate || a.date || a.createdAt || "0";
            const dateB = b.updatedAt || b.orderDate || b.date || b.createdAt || "0";
            return dateB > dateA ? 1 : -1;
        });

        setData(list);
        setIsLoading(false);
    }, (err) => {
        console.error(`RTDB Subscription Error at ${path}:`, err);
        setError(err);
        setIsLoading(false);
    });

    return () => off(syncQuery);
  }, [path, dbRTDB, options?.limit]);

  return { data, isLoading, error };
}
