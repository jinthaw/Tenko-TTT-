import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS, DEFAULT_SCRIPT_URL } from '../constants';

const OFFLINE_KEY = 'tenko_offline_records';
const SCRIPT_URL_KEY = 'TENKO_SCRIPT_URL';

let lastConnectionStatus: 'online' | 'offline' | 'error' = 'online';

const getScriptUrl = () => {
    // Priority: 1. Code Config 2. LocalStorage
    if (DEFAULT_SCRIPT_URL) return DEFAULT_SCRIPT_URL;
    return localStorage.getItem(SCRIPT_URL_KEY) || '';
};

const getOfflineData = (): TenkoRecord[] => {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
    } catch {
        return [];
    }
};

const saveOfflineData = (records: TenkoRecord[]) => {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(records));
};

// Generic fetcher for GAS
const callScript = async (action: string, payload: any = {}) => {
    const url = getScriptUrl();
    if (!url) throw new Error("No Script URL configured");

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action, ...payload })
        });
        
        const json = await response.json();
        lastConnectionStatus = 'online';
        return json;
    } catch (e) {
        lastConnectionStatus = 'offline';
        throw e;
    }
};

export const StorageService = {
  getConnectionStatus: () => lastConnectionStatus,
  
  hasScriptUrl: () => !!getScriptUrl(),

  // --- Records Logic ---
  getAll: async (): Promise<TenkoRecord[]> => {
    let dbRecords: TenkoRecord[] = [];
    
    // Always load offline data first for speed (if we wanted purely offline first),
    // but for 'getAll' we usually want fresh data.
    // However, to keep it fast, the UI uses what we return here.
    
    if (getScriptUrl()) {
        try {
            dbRecords = await callScript('getAll');
            if (!Array.isArray(dbRecords)) dbRecords = [];
        } catch (e) {
            console.warn("Failed to fetch from script, using offline only", e);
        }
    }

    // Merge offline
    const offlineRecords = getOfflineData();
    const recordMap = new Map<string, TenkoRecord>();
    
    // Server data is base
    dbRecords.forEach(r => recordMap.set(r.__backendId, r));
    
    // Local data overwrites server data (because it's newer/pending)
    offlineRecords.forEach(r => recordMap.set(r.__backendId, r));

    return Array.from(recordMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  // Optimistic Create
  create: async (record: Partial<TenkoRecord>): Promise<{ isOk: boolean, data?: TenkoRecord }> => {
    const id = crypto.randomUUID();
    const fullRecord = { 
        ...record, 
        __backendId: id,
        driver_id: record.driver_id || '',
        date: record.date || ''
    } as TenkoRecord;

    // 1. Save to Local Storage IMMEDIATELY
    const offline = getOfflineData();
    offline.push(fullRecord);
    saveOfflineData(offline);

    // 2. Try to Sync in Background (Fire and Forget-ish)
    if (getScriptUrl()) {
        callScript('create', { data: fullRecord })
            .then(() => {
                console.log("Background sync created:", id);
            })
            .catch(e => {
                console.warn("Background sync failed, data is safe in local:", e);
            });
    }

    // 3. Return success immediately to UI
    return { isOk: true, data: fullRecord };
  },

  // Optimistic Update
  update: async (record: TenkoRecord): Promise<{ isOk: boolean }> => {
    // 1. Update Local Storage IMMEDIATELY
    const offline = getOfflineData();
    const index = offline.findIndex(r => r.__backendId === record.__backendId);
    if (index >= 0) {
        offline[index] = record;
    } else {
        offline.push(record);
    }
    saveOfflineData(offline);

    // 2. Sync Background
    if (getScriptUrl()) {
        callScript('update', { data: record })
            .then(() => console.log("Background sync updated:", record.__backendId))
            .catch(e => console.warn("Background sync failed:", e));
    }

    // 3. Return success
    return { isOk: true };
  },

  // Optimistic Delete
  delete: async (recordId: string): Promise<{ isOk: boolean }> => {
    // 1. Update Local Storage IMMEDIATELY
    const offline = getOfflineData().filter(r => r.__backendId !== recordId);
    saveOfflineData(offline);

    // 2. Sync Background
    if (getScriptUrl()) {
         callScript('delete', { id: recordId })
            .then(() => console.log("Background sync deleted:", recordId))
            .catch(e => console.warn("Background sync delete failed:", e));
    }

    return { isOk: true };
  },

  syncPendingData: async (): Promise<number> => {
      if (!getScriptUrl()) return 0;

      const offlineRecords = getOfflineData();
      if (offlineRecords.length === 0) return 0;

      // In the optimistic approach, 'offlineRecords' is actually the full state of local changes.
      // But typically we only want to sync things that haven't been synced.
      // Since our simple GAS implementation just uses upsert (update if exists, insert if not),
      // sending everything in offlineRecords that *might* be unsynced is safe but heavy.
      
      // For this simplified version, we'll iterate and push.
      // In a more complex app, we'd have a 'dirty' flag.
      // Here we assume 'syncPendingData' is called on load to ensure consistency.

      console.log(`Syncing ${offlineRecords.length} records to Apps Script...`);
      let syncedCount = 0;

      // We only try to sync, we don't remove them from offline immediately 
      // because offline is our "cache". We rely on 'getAll' to eventually give us the server truth,
      // but for now, we just push.
      
      for (const record of offlineRecords) {
          try {
             await callScript('update', { data: record });
             syncedCount++;
          } catch (e) {
              console.error("Sync failed for", record.__backendId, e);
          }
      }
      
      return syncedCount;
  },
  
  getPendingCount: (): number => {
      // With optimistic UI, everything is technically "pending" until we confirm,
      // but we treat offline data as our "database" for the UI.
      // We can check connection status instead.
      return lastConnectionStatus === 'offline' ? 1 : 0; 
  },

  // --- Users Logic ---
  getUsers: async (): Promise<User[]> => {
    const defaults = [
          ...DRIVERS.map(d => ({ ...d, role: 'driver' as const })),
          ...TENKO_USERS.map(u => ({ ...u, role: 'tenko' as const }))
    ];

    if (!getScriptUrl()) return defaults;

    try {
        const users = await callScript('getUsers');
        return Array.isArray(users) && users.length > 0 ? users : defaults;
    } catch (e) {
        console.warn("Failed to get users from script", e);
        return defaults;
    }
  },

  saveUser: async (user: User) => {
      if (!getScriptUrl()) return;
      try {
           await callScript('saveUser', { data: user });
      } catch (e) {
          console.error("Save user failed", e);
      }
  },

  deleteUser: async (userId: string) => {
      if (!getScriptUrl()) return;
      try {
           await callScript('deleteUser', { id: userId });
      } catch (e) {
          console.error("Delete user failed", e);
      }
  },

  initializeDefaultUsers: async () => {
      if (!getScriptUrl()) throw new Error("No Script URL");
      
      const defaults = [
          ...DRIVERS.map(d => ({ ...d, role: 'driver' as const })),
          ...TENKO_USERS.map(u => ({ ...u, role: 'tenko' as const }))
      ];

      let successCount = 0;
      for (const user of defaults) {
          try {
              await callScript('saveUser', { data: user });
              successCount++;
          } catch (e) {
              console.error("Failed init user", user.id);
          }
      }
      return successCount;
  }
};