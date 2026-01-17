import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS } from '../constants';

const OFFLINE_KEY = 'tenko_offline_records';
const SCRIPT_URL_KEY = 'TENKO_SCRIPT_URL';

let lastConnectionStatus: 'online' | 'offline' | 'error' = 'online';

const getScriptUrl = () => localStorage.getItem(SCRIPT_URL_KEY) || '';

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
    dbRecords.forEach(r => recordMap.set(r.__backendId, r));
    offlineRecords.forEach(r => recordMap.set(r.__backendId, r));

    return Array.from(recordMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  create: async (record: Partial<TenkoRecord>): Promise<{ isOk: boolean, data?: TenkoRecord }> => {
    const id = crypto.randomUUID();
    const fullRecord = { 
        ...record, 
        __backendId: id,
        driver_id: record.driver_id || '',
        date: record.date || ''
    } as TenkoRecord;

    if (getScriptUrl()) {
        try {
            await callScript('create', { data: fullRecord });
            return { isOk: true, data: fullRecord };
        } catch (e) {
            console.error("Create failed, saving offline", e);
        }
    }

    // Offline Fallback
    const offline = getOfflineData();
    offline.push(fullRecord);
    saveOfflineData(offline);
    return { isOk: true, data: fullRecord };
  },

  update: async (record: TenkoRecord): Promise<{ isOk: boolean }> => {
    if (getScriptUrl()) {
        try {
            await callScript('update', { data: record });
            return { isOk: true };
        } catch (e) {
            console.error("Update failed, saving offline", e);
        }
    }

    // Offline Update
    const offline = getOfflineData();
    const index = offline.findIndex(r => r.__backendId === record.__backendId);
    if (index >= 0) {
        offline[index] = record;
    } else {
        offline.push(record);
    }
    saveOfflineData(offline);
    return { isOk: true };
  },

  delete: async (recordId: string): Promise<{ isOk: boolean }> => {
    if (getScriptUrl()) {
         try {
            await callScript('delete', { id: recordId });
         } catch(e) {
             console.error("Delete failed", e);
         }
    }

    const offline = getOfflineData().filter(r => r.__backendId !== recordId);
    saveOfflineData(offline);
    return { isOk: true };
  },

  syncPendingData: async (): Promise<number> => {
      if (!getScriptUrl()) return 0;

      const offlineRecords = getOfflineData();
      if (offlineRecords.length === 0) return 0;

      console.log(`Syncing ${offlineRecords.length} records to Apps Script...`);
      const remainingRecords: TenkoRecord[] = [];
      let syncedCount = 0;

      for (const record of offlineRecords) {
          try {
             await callScript('update', { data: record });
             syncedCount++;
          } catch (e) {
              console.error("Sync failed for", record.__backendId, e);
              remainingRecords.push(record);
          }
      }
      
      saveOfflineData(remainingRecords);
      return syncedCount;
  },
  
  getPendingCount: (): number => {
      return getOfflineData().length;
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
        // If users is empty from sheet, fallback to defaults
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

  // NEW: Upload all default users to sheet
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