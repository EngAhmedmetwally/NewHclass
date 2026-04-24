'use client';

import Dexie, { type Table } from 'dexie';

export interface SyncQueueItem {
  id?: number; // Auto-incrementing primary key
  type: 'create-order' | 'start-shift'; // The type of data, e.g., 'order'
  payload: any; // The data to be synced
  timestamp: number;
}

export interface PersistentCacheItem {
  key: string;   // Compound key: path/id
  path: string;  // Base path for indexing (e.g., 'products')
  id: string;    // Original item ID
  data: any;     // Full object data
  updatedAt: string; // ISO timestamp for delta sync
}

export class AppOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem>; 
  persistentCache!: Table<PersistentCacheItem, string>;

  constructor() {
    super('hiclassDB');
    // Version 3: Added granular persistent cache for individual items
    this.version(3).stores({
      syncQueue: '++id, type, timestamp',
      persistentCache: 'key, path, updatedAt' 
    });
  }
}

export const db = new AppOfflineDB();
