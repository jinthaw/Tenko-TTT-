import { Pool } from '@neondatabase/serverless';
import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS } from '../constants';

// *** ใช้ Connection String ที่ระบุมา (Neon DB) ***
// ระบบจะใช้ค่านี้ทันทีถ้าไม่มีการตั้งค่าใน Environment Variable
const CONNECTION_STRING = (import.meta as any).env?.VITE_DATABASE_URL || "postgresql://neondb_owner:npg_w1kO2JcqYApL@ep-morning-river-a1vzrjva-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Create a connection pool only if connection string is present
const pool = new Pool({ connectionString: CONNECTION_STRING });
const OFFLINE_KEY = 'tenko_offline_records';

// Flag to stop retrying if authentication fails (wrong password/url)
let isAuthFailed = false;
let lastConnectionStatus: 'online' | 'offline' | 'error' = 'online';

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

const handleDBError = (e: any) => {
    if (e.message?.includes('password') || e.code === '28P01') {
        console.error("Auth failed:", e);
        isAuthFailed = true;
        lastConnectionStatus = 'error';
    } else {
        console.error("Connection failed:", e);
        lastConnectionStatus = 'offline';
    }
};

const handleDBSuccess = () => {
    // Only recover if not in permanent auth failure
    if (!isAuthFailed) {
        lastConnectionStatus = 'online';
    }
};

export const StorageService = {
  getConnectionStatus: () => lastConnectionStatus,
  getIsAuthFailed: () => isAuthFailed,
  
  // --- Sync Mechanism ---
  syncPendingData: async (): Promise<number> => {
      // ถ้าไม่มี Connection String หรือ Authentication ผิดพลาด ให้ข้ามการ Sync
      if (!CONNECTION_STRING) {
          lastConnectionStatus = 'offline';
          return 0;
      }
      if (isAuthFailed) {
          lastConnectionStatus = 'error';
          return 0;
      }

      const offlineRecords = getOfflineData();
      if (offlineRecords.length === 0) return 0;

      console.log(`Syncing ${offlineRecords.length} records...`);
      const remainingRecords: TenkoRecord[] = [];
      let syncedCount = 0;

      for (const record of offlineRecords) {
          try {
              // Try to Upsert
              const check = await pool.query('SELECT id FROM records WHERE id = $1', [record.__backendId]);
              
              if (check.rows.length > 0) {
                  // Update
                  await pool.query(
                    'UPDATE records SET data = $1, checkin_status = $2, checkout_status = $3 WHERE id = $4',
                    [record, record.checkin_status, record.checkout_status, record.__backendId]
                  );
              } else {
                  // Insert
                  await pool.query(
                    'INSERT INTO records (id, driver_id, date, data, checkin_status, checkout_status) VALUES ($1, $2, $3, $4, $5, $6)',
                    [record.__backendId, record.driver_id, record.date, record, record.checkin_status, record.checkout_status]
                  );
              }
              syncedCount++;
              handleDBSuccess();
          } catch (e: any) {
              handleDBError(e);
              if (isAuthFailed) {
                  console.error("Sync stopped: Authentication failed.");
                  remainingRecords.push(...offlineRecords.slice(offlineRecords.indexOf(record)));
                  break; 
              }
              console.error("Sync failed for record", record.__backendId, e);
              remainingRecords.push(record);
          }
      }

      saveOfflineData(remainingRecords);
      return syncedCount;
  },

  getPendingCount: (): number => {
      return getOfflineData().length;
  },

  // --- Records ---
  getAll: async (): Promise<TenkoRecord[]> => {
    let dbRecords: TenkoRecord[] = [];
    
    // พยายามโหลดจาก DB เฉพาะเมื่อมี Connection String และยังไม่เคย Auth Fail
    if (CONNECTION_STRING && !isAuthFailed) {
        try {
          const result = await pool.query('SELECT * FROM records ORDER BY date DESC');
          dbRecords = result.rows.map(row => ({
              ...row.data,
              __backendId: row.id,
              driver_id: row.driver_id,
              date: row.date,
              checkin_status: row.checkin_status || row.data.checkin_status,
              checkout_status: row.checkout_status || row.data.checkout_status
            } as TenkoRecord));
          handleDBSuccess();
        } catch (e: any) {
          handleDBError(e);
          console.error("Failed to load data from Neon (Offline mode active)", e);
        }
    }

    // Merge with offline records
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

    if (CONNECTION_STRING && !isAuthFailed) {
        try {
          await pool.query(
            'INSERT INTO records (id, driver_id, date, data, checkin_status, checkout_status) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, fullRecord.driver_id, fullRecord.date, fullRecord, fullRecord.checkin_status, fullRecord.checkout_status]
          );
          handleDBSuccess();
          return { isOk: true, data: fullRecord };
        } catch (e: any) {
          handleDBError(e);
          console.warn("Neon connection failed. Saving locally.", e);
        }
    }

    // Fallback: Save to LocalStorage
    const offline = getOfflineData();
    offline.push(fullRecord);
    saveOfflineData(offline);
    return { isOk: true, data: fullRecord };
  },

  update: async (record: TenkoRecord): Promise<{ isOk: boolean }> => {
    if (CONNECTION_STRING && !isAuthFailed) {
        try {
          await pool.query(
            'UPDATE records SET data = $1, checkin_status = $2, checkout_status = $3 WHERE id = $4',
            [record, record.checkin_status, record.checkout_status, record.__backendId]
          );
          handleDBSuccess();
          return { isOk: true };
        } catch (e: any) {
          handleDBError(e);
          console.warn("Neon connection failed. Updating locally.", e);
        }
    }

    // Fallback: Update in LocalStorage
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
    if (CONNECTION_STRING && !isAuthFailed) {
        try {
          await pool.query('DELETE FROM records WHERE id = $1', [recordId]);
          handleDBSuccess();
          
          const offline = getOfflineData().filter(r => r.__backendId !== recordId);
          saveOfflineData(offline);
          
          return { isOk: true };
        } catch (e: any) {
          handleDBError(e);
          console.warn("Neon delete failed. Attempting local delete only.", e);
        }
    }

    const offline = getOfflineData().filter(r => r.__backendId !== recordId);
    saveOfflineData(offline);
    return { isOk: true };
  },

  // --- Users ---
  getUsers: async (): Promise<User[]> => {
    const defaults = [
          ...DRIVERS.map(d => ({ ...d, role: 'driver' as const })),
          ...TENKO_USERS.map(u => ({ ...u, role: 'tenko' as const }))
    ];

    if (!CONNECTION_STRING || isAuthFailed) return defaults;

    try {
      const result = await pool.query('SELECT * FROM users');
      handleDBSuccess();
      if (result.rows.length === 0) return defaults;
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        role: row.role as 'driver' | 'tenko'
      }));
    } catch (e: any) {
      handleDBError(e);
      // Offline fallback
      return defaults;
    }
  },

  saveUser: async (user: User) => {
    if (!CONNECTION_STRING || isAuthFailed) return;
    try {
      await pool.query(
        `INSERT INTO users (id, name, role, data) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = $2, role = $3`,
        [user.id, user.name, user.role, user]
      );
      handleDBSuccess();
    } catch (e: any) {
      handleDBError(e);
      console.error("Failed to save user (Offline)", e);
    }
  },

  deleteUser: async (userId: string) => {
    if (!CONNECTION_STRING || isAuthFailed) return;
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      handleDBSuccess();
    } catch (e: any) {
      handleDBError(e);
      console.error("Failed to delete user", e);
    }
  }
};