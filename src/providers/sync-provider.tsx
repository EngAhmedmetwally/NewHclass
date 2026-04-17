'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { getDatabase, ref, runTransaction, push, set, update, get } from 'firebase/database';
import { useDatabase, useUser } from '@/firebase';
import type { Order, Product, StockMovement, Shift, User } from '@/lib/definitions';
import { format } from 'date-fns';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingItems: number;
  triggerSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const dbRTDB = useDatabase();
  const { appUser } = useUser();
  const pendingItemsCount = useLiveQuery(() => db.syncQueue.count(), [], 0);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing || !dbRTDB || !appUser) return;
    const itemsToSync = await db.syncQueue.toArray();
    if (itemsToSync.length === 0) return;

    setIsSyncing(true);
    toast({ title: 'جاري المزامنة...', description: `يوجد ${itemsToSync.length} عنصر للمزامنة.` });

    let successCount = 0;
    for (const item of itemsToSync) {
        try {
            if (item.type === 'start-shift') {
                const newShiftRef = push(ref(dbRTDB, 'shifts'));
                const shiftData = { ...item.payload, id: newShiftRef.key! };
                await set(newShiftRef, shiftData);
            } else if (item.type === 'create-order') {
                const orderData: Partial<Order> = item.payload;

                const counterRef = ref(dbRTDB, 'counters/orders');
                const transactionResult = await runTransaction(counterRef, (currentData) => {
                    if (currentData === null) return { name: 'orders', value: 70000001 };
                    currentData.value++;
                    return currentData;
                });
                if (!transactionResult.committed) throw new Error("Sync Error: Failed to generate order code.");
                
                const orderCode = transactionResult.snapshot.val().value.toString();
                orderData.orderCode = orderCode;
                orderData.notes = (orderData.notes || '') + `\n[SYNC] Synced from offline by ${appUser.fullName}.`;
                orderData.createdAt = new Date().toISOString();

                const datePath = format(new Date(orderData.orderDate!), 'yyyy-MM-dd');
                const newOrderRef = push(ref(dbRTDB, `daily-entries/${datePath}/orders`));
                orderData.id = newOrderRef.key!;
                await set(newOrderRef, orderData);

                // Update product stock
                for (const orderItem of orderData.items!) {
                    const productRef = ref(dbRTDB, `products/${orderItem.productId}`);
                    await runTransaction(productRef, (currentProduct: Product) => {
                        if (currentProduct) {
                            if (orderData.transactionType === 'Sale') {
                                currentProduct.quantityInStock -= orderItem.quantity;
                                currentProduct.quantitySold = (currentProduct.quantitySold || 0) + orderItem.quantity;
                            } else { // Rental
                                currentProduct.quantityRented = (currentProduct.quantityRented || 0) + orderItem.quantity;
                            }
                        }
                        return currentProduct;
                    });
                }

                // Update shift for payment
                if (orderData.paid! > 0) {
                     const shiftsSnapshot = await get(ref(dbRTDB, 'shifts'));
                     if(shiftsSnapshot.exists()) {
                         const shifts = shiftsSnapshot.val();
                         let openShiftId: string | null = null;
                         for (const id in shifts) {
                             if(shifts[id].cashier?.id === appUser.id && !shifts[id].endTime) {
                                 openShiftId = id;
                                 break;
                             }
                         }
                         if (openShiftId) {
                             const shiftRef = ref(dbRTDB, `shifts/${openShiftId}`);
                             await runTransaction(shiftRef, (currentShift: Shift) => {
                                 if(currentShift) {
                                     // Extract initial payment method if recorded
                                     const method = (orderData.payments as any)?.["initial-payment"]?.method || 'Cash';
                                     if (method === 'Vodafone Cash') currentShift.vodafoneCash = (currentShift.vodafoneCash || 0) + orderData.paid!;
                                     else if (method === 'InstaPay') currentShift.instaPay = (currentShift.instaPay || 0) + orderData.paid!;
                                     else if (method === 'Visa') currentShift.visa = (currentShift.visa || 0) + orderData.paid!;
                                     else currentShift.cash = (currentShift.cash || 0) + orderData.paid!;

                                     if (orderData.transactionType === 'Sale') {
                                         currentShift.salesTotal = (currentShift.salesTotal || 0) + orderData.total!;
                                     } else {
                                         currentShift.rentalsTotal = (currentShift.rentalsTotal || 0) + orderData.total!;
                                     }
                                 }
                                 return currentShift;
                             });
                         }
                     }
                }
            }

            await db.syncQueue.delete(item.id!);
            successCount++;
        } catch (e) {
            console.error("Sync error for item:", item, e);
            toast({ variant: 'destructive', title: `فشل مزامنة العنصر رقم ${item.id}`, description: (e as Error).message });
        }
    }

    setIsSyncing(false);
    if (successCount > 0) {
        toast({ title: 'اكتملت المزامنة', description: `تمت مزامنة ${successCount} من ${itemsToSync.length} عنصر بنجاح.` });
    } else {
        toast({ variant: 'destructive', title: 'فشل المزامنة', description: 'لم يتم مزامنة أي عناصر. الرجاء المحاولة مرة أخرى.' });
    }
  }, [isOnline, isSyncing, toast, dbRTDB, appUser]);

  useEffect(() => {
    if (isOnline && pendingItemsCount > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOnline, pendingItemsCount, triggerSync, isSyncing]);
  
  const value = {
    isOnline,
    isSyncing,
    pendingItems: pendingItemsCount,
    triggerSync,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncManager(): SyncContextType {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncManager must be used within a SyncProvider');
  }
  return context;
}
