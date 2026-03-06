'use client';

import Dexie, { type Table } from 'dexie';

export interface SyncQueueItem {
  id?: number; // Auto-incrementing primary key
  type: 'create-order' | 'start-shift'; // The type of data, e.g., 'order'
  payload: any; // The data to be synced
  timestamp: number;
}

export interface DataCacheItem {
  path: string;
  data: any;
  timestamp: number;
}

export class AppOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem>; 
  dataCache!: Table<DataCacheItem>;

  constructor() {
    super('hiclassDB');
    this.version(2).stores({
      syncQueue: '++id, type, timestamp',
      dataCache: '&path, timestamp' // Use path as primary key
    });
  }
}

export const db = new AppOfflineDB();
