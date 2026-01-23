
import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS, DEFAULT_SCRIPT_URL } from '../constants';

const OFFLINE_KEY = 'tenko_offline_records';
const SCRIPT_URL_KEY = 'TENKO_SCRIPT_URL';

let lastConnectionStatus: 'online' | 'offline' | 'error' = 'online';

// Utility to get YYYY-MM-DD in local time
const getLocalISODate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getScriptUrl = () => {
    if (DEFAULT_SCRIPT_URL) return DEFAULT_SCRIPT_URL;
    return localStorage.getItem(SCRIPT_URL_KEY) || '';
};

const getOfflineData = (): TenkoRecord[] => {
    try {
        const data = localStorage.getItem(OFFLINE_KEY);
        return data ? JSON.parse(data) : [];
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
        
        const text = await response.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse server response:", text);
            throw new Error("Invalid server response format");
        }

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
    const localRecords = getOfflineData();
    
    if (getScriptUrl()) {
        try {
            const serverData = await callScript('getAll');
            if (Array.isArray(serverData)) {
                dbRecords = serverData;
                const serverIds = new Set(dbRecords.map(r => r.__backendId));
                const reconciledLocal = localRecords.filter(lr => {
                    const existsOnServer = serverIds.has(lr.__backendId);
                    const isNewPending = lr.checkin_status === 'pending' && !lr.checkin_tenko_id;
                    return existsOnServer || isNewPending;
                });
                saveOfflineData(reconciledLocal);
            }
        } catch (e) {
            console.warn("Failed to fetch from script", e);
        }
    }

    const currentLocal = getOfflineData();
    const recordMap = new Map<string, TenkoRecord>();
    dbRecords.forEach(r => recordMap.set(r.__backendId, r));
    currentLocal.forEach(r => recordMap.set(r.__backendId, r));

    const uniqueMap = new Map<string, TenkoRecord>();
    Array.from(recordMap.values()).forEach(r => {
        const driverId = String(r.driver_id).trim();
        const key = `${driverId}_${r.date}`;
        
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, r);
        } else {
            const existing = uniqueMap.get(key)!;
            
            // PRIORITY LOGIC: 
            // 1. Give priority to records that are NOT fully closed (Check-out is still pending or empty)
            // 2. If both are the same status, pick the one with the latest timestamp
            
            const getScore = (rec: TenkoRecord) => {
                let score = 0;
                // If check-in is pending, high priority (needs action)
                if (rec.checkin_status === 'pending') score += 100;
                // If check-in is approved but check-out is pending, even higher priority (in-queue for exit)
                if (rec.checkin_status === 'approved' && rec.checkout_status === 'pending') score += 200;
                // If approved but not checked out yet, high priority (currently working)
                if (rec.checkin_status === 'approved' && !rec.checkout_status) score += 50;
                return score;
            };

            const existingScore = getScore(existing);
            const newScore = getScore(r);

            if (newScore > existingScore) {
                uniqueMap.set(key, r);
            } else if (newScore === existingScore) {
                // If scores are equal, pick the one with the most recent actual interaction
                const timeExisting = new Date(existing.checkout_real_timestamp || existing.checkin_real_timestamp || existing.date).getTime();
                const timeNew = new Date(r.checkout_real_timestamp || r.checkin_real_timestamp || r.date).getTime();
                if (timeNew > timeExisting) {
                    uniqueMap.set(key, r);
                }
            }
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  create: async (record: Partial<TenkoRecord>): Promise<{ isOk: boolean, data?: TenkoRecord }> => {
    const offline = getOfflineData();
    const today = record.date || getLocalISODate();
    const id = crypto.randomUUID();
    const fullRecord = { 
        ...record, 
        __backendId: id,
        driver_id: String(record.driver_id || '').trim(),
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
    const offline = getOfflineData().filter(r => r.__backendId !== recordId);
    saveOfflineData(offline);
    if (getScriptUrl()) {
        try {
            await callScript('delete', { id: recordId });
        } catch (e) {
            console.error(e);
        }
    }
    return { isOk: true };
  },

  syncPendingData: async (): Promise<number> => {
      if (!getScriptUrl()) return 0;
      const offlineRecords = getOfflineData();
      const pendingSync = offlineRecords.filter(r => r.checkin_status === 'pending' || r.checkout_status === 'pending');
      if (pendingSync.length === 0) return 0;
      let syncedCount = 0;
      for (const record of pendingSync) {
          try {
             await callScript('update', { data: record });
             syncedCount++;
          } catch (e) {
              console.error(e);
          }
      }
      return syncedCount;
  },
  
  getPendingCount: (): number => {
      const offline = getOfflineData();
      return offline.filter(r => r.checkin_status === 'pending' || r.checkout_status === 'pending').length;
  },

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
