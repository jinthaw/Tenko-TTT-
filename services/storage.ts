
import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS, DEFAULT_SCRIPT_URL } from '../constants';

const OFFLINE_KEY = 'tenko_offline_records';
const SCRIPT_URL_KEY = 'TENKO_SCRIPT_URL';

let lastConnectionStatus: 'online' | 'offline' | 'error' = 'online';

const getScriptUrl = () => {
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

  clearLocalCache: () => {
      localStorage.removeItem(OFFLINE_KEY);
  },

  getAll: async (): Promise<TenkoRecord[]> => {
    let dbRecords: TenkoRecord[] = [];
    
    if (getScriptUrl()) {
        try {
            dbRecords = await callScript('getAll');
            if (!Array.isArray(dbRecords)) dbRecords = [];
        } catch (e) {
            console.warn("Failed to fetch from script", e);
        }
    }

    const offlineRecords = getOfflineData();
    const recordMap = new Map<string, TenkoRecord>();
    
    // Server data is the source of truth
    dbRecords.forEach(r => recordMap.set(r.__backendId, r));
    
    // Local data might have newer updates or pending creates
    offlineRecords.forEach(r => recordMap.set(r.__backendId, r));

    // Deduplicate logical duplicates
    const uniqueMap = new Map<string, TenkoRecord>();
    Array.from(recordMap.values()).forEach(r => {
        const key = `${r.driver_id}_${r.date}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, r);
        } else {
            const existing = uniqueMap.get(key)!;
            let scoreExisting = (existing.checkin_status === 'approved' ? 2 : 0) + (existing.checkout_status === 'approved' ? 2 : 0);
            let scoreNew = (r.checkin_status === 'approved' ? 2 : 0) + (r.checkout_status === 'approved' ? 2 : 0);

            if (scoreNew > scoreExisting) {
                uniqueMap.set(key, r);
            } else if (scoreNew === scoreExisting) {
                const timeExisting = new Date(existing.checkin_real_timestamp || existing.date).getTime();
                const timeNew = new Date(r.checkin_real_timestamp || r.date).getTime();
                if (timeNew > timeExisting) uniqueMap.set(key, r);
            }
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  create: async (record: Partial<TenkoRecord>): Promise<{ isOk: boolean, data?: TenkoRecord }> => {
    const offline = getOfflineData();
    const today = record.date || new Date().toISOString().split('T')[0];
    const id = crypto.randomUUID();
    const fullRecord = { 
        ...record, 
        __backendId: id,
        driver_id: record.driver_id || '',
        date: today
    } as TenkoRecord;

    offline.push(fullRecord);
    saveOfflineData(offline);

    if (getScriptUrl()) {
        await callScript('create', { data: fullRecord }).catch(e => console.warn(e));
    }

    return { isOk: true, data: fullRecord };
  },

  update: async (record: TenkoRecord): Promise<{ isOk: boolean }> => {
    const offline = getOfflineData();
    const index = offline.findIndex(r => r.__backendId === record.__backendId);
    if (index >= 0) {
        offline[index] = record;
    } else {
        offline.push(record);
    }
    saveOfflineData(offline);

    if (getScriptUrl()) {
        await callScript('update', { data: record }).catch(e => console.warn(e));
    }

    return { isOk: true };
  },

  delete: async (recordId: string): Promise<{ isOk: boolean }> => {
    // 1. ลบจาก Local Storage ทันทีเพื่อไม่ให้กลับมาตอน Merge
    const offline = getOfflineData().filter(r => r.__backendId !== recordId);
    saveOfflineData(offline);

    // 2. ส่งคำสั่งลบไปยัง Server (Google Sheet)
    if (getScriptUrl()) {
        try {
            await callScript('delete', { id: recordId });
            console.log("Deleted from server:", recordId);
        } catch (e) {
            console.error("Server delete failed, but local is cleared:", e);
        }
    }

    return { isOk: true };
  },

  syncPendingData: async (): Promise<number> => {
      if (!getScriptUrl()) return 0;
      const offlineRecords = getOfflineData();
      if (offlineRecords.length === 0) return 0;

      let syncedCount = 0;
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
  
  getPendingCount: (): number => lastConnectionStatus === 'offline' ? 1 : 0,

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
        return defaults;
    }
  },

  saveUser: async (user: User) => {
      if (getScriptUrl()) await callScript('saveUser', { data: user }).catch(e => console.error(e));
  },

  deleteUser: async (userId: string) => {
      if (getScriptUrl()) await callScript('deleteUser', { id: userId }).catch(e => console.error(e));
  },

  initializeDefaultUsers: async () => {
      const defaults = [
          ...DRIVERS.map(d => ({ ...d, role: 'driver' as const })),
          ...TENKO_USERS.map(u => ({ ...u, role: 'tenko' as const }))
      ];
      let successCount = 0;
      for (const user of defaults) {
          try {
              await callScript('saveUser', { data: user });
              successCount++;
          } catch (e) {}
      }
      return successCount;
  }
};
