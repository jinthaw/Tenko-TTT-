import { User } from './types';

export const SYSTEM_VERSION = "tenko V.01 (160126) บริษัท ออโต้แครี่เออร์";

// --- การตั้งค่า Server ---
// คุณสามารถนำ Web App URL จาก Google Apps Script มาวางตรงนี้ได้เลย
// เช่น "https://script.google.com/macros/s/......./exec"
// ถ้าใส่แล้ว หน้า Login จะไม่ถามหา URL อีก
export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwu7JSVxZYZn4KRRaYZryJj8N4lLcZWak2cMU29IZz3N7U3YaQVgqxZC1RH0rtg15iC/exec"; 

export const DRIVERS: { id: string; name: string }[] = [
  { id: "240", name: "นายนิรุท สาเกตุ" },
  { id: "244", name: "นายสายฝน พลหมั่น" },
  { id: "263", name: "นายกิติพงษ์ ดวงงาม" },
  { id: "291", name: "นายสมรถ แข่งกระโทก" },
  { id: "342", name: "นายเมืองมล ชาบุญมา" },
  { id: "346", name: "นายสกนธ์ จันเวิน" },
  { id: "373", name: "นายประกิจ แสนแดง" },
  { id: "408", name: "นายอนุชา ชาบุญมา" },
  { id: "422", name: "นายสายยนต์ ชาบุญมา" },
  { id: "470", name: "นายอำนาจ สวัสดิ์รักษา" },
  { id: "517", name: "นายจิรวรรณ บุญแท่ง" },
  { id: "539", name: "นายวัฒนพงษ์ ศรีทิน" },
  { id: "541", name: "นายเสริมศักดิ์ พิมมา" },
  { id: "550", name: "นายอภิชาติ เรืองเทศ" },
  { id: "598", name: "นายสมชาติ แสงเพชร" },
  { id: "655", name: "นายวันชัย สารจันทร" },
  { id: "659", name: "นายบุญเยี่ยม คำยา" }
];

export const TENKO_USERS: { id: string; name: string }[] = [
  { id: "009", name: "นายชัยสิทธิ์ ธัญญพืช" },
  { id: "567", name: "นายจินตวัฒน์ ทองแพรว" },
  { id: "704", name: "นายวสันต์ แจ้งคง" },
  { id: "755", name: "นายกฤตกร บุญเซ่ง" }
];