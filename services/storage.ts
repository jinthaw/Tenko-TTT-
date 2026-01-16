import { TenkoRecord, User } from '../types';
import { DRIVERS, TENKO_USERS } from '../constants';

const DATA_KEY = 'tenko_ttt_data';
const USERS_KEY = 'tenko_ttt_users';

export const StorageService = {
  // --- Records ---
  getAll: (): TenkoRecord[] => {
    try {
      const data = localStorage.getItem(DATA_KEY);
      if (!data) {
        // --- Generate Sample Data for Driver 240 as requested ---
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const days = ['01', '03', '05', '06', '07', '08', '12'];
        
        const samples: TenkoRecord[] = days.map((day, index) => {
            // Varying BP values for graph visualization
            const bpH = 120 + Math.floor(Math.random() * 20) - 10; // 110-130
            const bpL = 80 + Math.floor(Math.random() * 10) - 5;   // 75-85
            const dateStr = `${y}-${m}-${day}`;

            return {
                __backendId: `sample-${day}`,
                driver_id: '240',
                driver_name: 'นายนิรุท สาเกตุ',
                date: dateStr,
                tired: 'ไม่มี',
                sick: 'ไม่มี',
                drowsy: 'ไม่มี',
                injury: 'ไม่มี',
                medication: 'ไม่ทาน',
                body_condition: 'ปกติ',
                sleep_start: '22:00',
                sleep_end: '06:00',
                sleep_hours: 8,
                sleep_quality: 'หลับสนิท',
                extra_sleep: 'ไม่นอนเพิ่ม',
                checkin_status: 'approved',
                checkin_timestamp: `${dateStr}T07:30:00.000Z`,
                checkin_tenko_name: 'นายชัยสิทธิ์ ธัญญพืช',
                checkin_tenko_id: '009',
                temperature: 36.5,
                alcohol_checkin: 0,
                blood_pressure_high: bpH,
                blood_pressure_low: bpL,
                phone_usage_compliant: 'ตรงตามที่แจ้ง',
                can_work: 'ได้',
                
                checkout_status: 'approved',
                checkout_timestamp: `${dateStr}T17:30:00.000Z`,
                checkout_tenko_name: 'นายชัยสิทธิ์ ธัญญพืช',
                alcohol_checkout: 0,
                vehicle_handover: 'ปกติ',
                body_condition_checkout: 'ปกติ',
                route_risk: 'ปกติ'
            } as TenkoRecord;
        });
        
        localStorage.setItem(DATA_KEY, JSON.stringify(samples));
        return samples;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to load data", e);
      return [];
    }
  },

  save: (records: TenkoRecord[]) => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("Failed to save data", e);
    }
  },

  create: (record: Partial<TenkoRecord>): { isOk: boolean, data?: TenkoRecord } => {
    const records = StorageService.getAll();
    const newRecord: TenkoRecord = {
      ...record,
      __backendId: Date.now().toString() + Math.random().toString(36).substring(2),
    } as TenkoRecord;
    
    records.push(newRecord);
    StorageService.save(records);
    return { isOk: true, data: newRecord };
  },

  update: (record: TenkoRecord): { isOk: boolean } => {
    const records = StorageService.getAll();
    const index = records.findIndex(r => r.__backendId === record.__backendId);
    if (index !== -1) {
      records[index] = record;
      StorageService.save(records);
      return { isOk: true };
    }
    return { isOk: false };
  },

  delete: (recordId: string): { isOk: boolean } => {
    let records = StorageService.getAll();
    const initialLength = records.length;
    records = records.filter(r => r.__backendId !== recordId);
    if (records.length !== initialLength) {
      StorageService.save(records);
      return { isOk: true };
    }
    return { isOk: false };
  },

  // --- Users ---
  getUsers: (): User[] => {
    try {
      const data = localStorage.getItem(USERS_KEY);
      if (!data) {
        // Initialize with constants if empty
        const initialUsers: User[] = [
          ...DRIVERS.map(d => ({ ...d, role: 'driver' as const })),
          ...TENKO_USERS.map(u => ({ ...u, role: 'tenko' as const }))
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
        return initialUsers;
      }
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  saveUser: (user: User) => {
    const users = StorageService.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: (userId: string) => {
    const users = StorageService.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};