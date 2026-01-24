
export interface User {
  id: string;
  name: string;
  role: 'driver' | 'tenko';
}

export type CheckStatus = 'pending' | 'approved' | null;

export interface TenkoRecord {
  __backendId: string;
  driver_id: string;
  driver_name: string;
  date: string; // YYYY-MM-DD
  
  // --- 1. Tired ---
  tired?: 'มี' | 'ไม่มี';
  tired_detail?: string;

  // --- 2. Sick/Disease ---
  sick?: 'มี' | 'ไม่มี';
  sick_detail?: string; // Specify disease name
  seen_doctor?: 'มี' | 'ไม่มี';
  seen_doctor_detail?: string;
  sick_taking_med?: 'ทาน' | 'ไม่ทาน';

  // --- 3. Drowsy ---
  drowsy?: 'มี' | 'ไม่มี';
  drowsy_detail?: string;

  // --- 4. Injury ---
  injury?: 'มี' | 'ไม่มี';
  injury_detail?: string;

  // --- 5. Medication ---
  medication?: 'ทาน' | 'ไม่ทาน'; // "ทานยาที่ส่งผลต่อการขับขี่"
  medication_name?: string;

  // --- 6. Body Condition ---
  body_condition?: 'ปกติ' | 'ไม่ปกติ';
  body_condition_detail?: string;

  // --- 7. Sleep ---
  sleep_start?: string;
  sleep_end?: string;
  sleep_hours?: number; // < 6 Red, > 6 Green
  sleep_quality?: 'หลับสนิท' | 'ไม่สนิท';
  sleep_quality_detail?: string;

  // --- 8. Extra Sleep ---
  extra_sleep?: 'นอนเพิ่ม' | 'ไม่นอนเพิ่ม';
  extra_sleep_start?: string;
  extra_sleep_end?: string;
  extra_sleep_hours?: number; // < 4.5 Red
  extra_sleep_quality?: 'หลับสนิท' | 'ไม่สนิท';
  extra_sleep_quality_detail?: string;

  // --- 9. Environment / Senses ---
  worry_detail?: 'มี' | 'ไม่มี'; // Worry
  worry_text?: string;
  rest_location?: 'บ้าน' | 'นอกบ้าน';
  rest_location_detail?: string;
  
  vision_problem?: 'มี' | 'ไม่มี';
  vision_detail?: string;
  glasses?: 'มี' | 'ไม่มี';
  glasses_detail?: string;
  
  hearing_problem?: 'มี' | 'ไม่มี';
  hearing_detail?: string;
  hearing_aid?: 'มี' | 'ไม่มี';
  hearing_aid_detail?: string;

  // --- Tenko Check-in Inputs (Pre-work) ---
  checkin_status: CheckStatus;
  checkin_timestamp?: string; // The time recorded by Tenko (Effective Start Work)
  checkin_real_timestamp?: string; // When the record was actually created
  checkin_tenko_name?: string;
  checkin_tenko_id?: string;

  phone_usage_compliant?: 'ตรงตามที่แจ้ง' | 'ไม่ตรงตามที่แจ้ง';
  phone_usage_reason?: string;
  phone_stop_time?: string;
  phone_start_time?: string;
  phone_total_hours?: number;

  temperature?: number; // > 37.5 Red
  blood_pressure_high?: number; // 90-160
  blood_pressure_low?: number; // 60-100
  alcohol_checkin?: number; // Must be 0
  alcohol_checkin_reason?: string; // If not 0

  can_work?: 'ได้' | 'ไม่ได้';
  cannot_work_reason?: string;

  // --- Post-work (Driver) ---
  checkout_status: CheckStatus;
  checkout_real_timestamp?: string;
  
  vehicle_handover?: 'ปกติ' | 'ไม่ปกติ';
  vehicle_detail?: string;
  
  body_condition_checkout?: 'ปกติ' | 'ไม่ปกติ';
  body_detail_checkout?: string;
  
  route_risk?: 'ปกติ' | 'พบจุดเสี่ยง';
  route_detail?: string;

  // --- Post-work (Tenko) ---
  checkout_timestamp?: string; // The time recorded by Tenko (Effective End Work)
  checkout_tenko_name?: string;
  checkout_tenko_id?: string;
  
  alcohol_checkout?: number; // Must be 0
  alcohol_checkout_reason?: string;
  
  driving_violation?: 'มี' | 'ไม่มี';
  violation_detail?: string;
}

export enum ViewState {
  LOGIN,
  DRIVER_HOME,
  DRIVER_CHECKIN,
  DRIVER_CHECKOUT,
  DRIVER_REPORT,
  TENKO_DASHBOARD,
  TENKO_QUEUE_CHECKIN,
  TENKO_QUEUE_CHECKOUT,
  TENKO_COMPLETED,
  TENKO_ANALYTICS,
  TENKO_MANAGE,
  TENKO_APPROVAL_CHECKIN,
  TENKO_APPROVAL_CHECKOUT
}
