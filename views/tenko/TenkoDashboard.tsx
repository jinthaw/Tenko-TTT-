import React from 'react';
import { TenkoRecord } from '../../types';
import { Card, Badge, Button } from '../../components/UI';
import * as XLSX from 'xlsx';

interface Props {
  view: string;
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
}

export const TenkoDashboard: React.FC<Props> = ({ view, records, onSelectRecord }) => {
  const pendingCheckin = records.filter(r => r.checkin_status === 'pending');
  // Drivers who are working (approved checkin) but haven't submitted checkout yet
  const activeDrivers = records.filter(r => r.checkin_status === 'approved' && !r.checkout_status);
  const pendingCheckout = records.filter(r => r.checkout_status === 'pending');
  const completed = records.filter(r => r.checkin_status === 'approved' && r.checkout_status === 'approved');
  const today = new Date().toISOString().split('T')[0];

  const exportExcel = () => {
    const data = records.map(r => {
        // Helper for combining status and detail
        const formatDetail = (status?: string, detail?: string) => {
            if (!status) return '-';
            return detail ? `${status} (${detail})` : status;
        };

        const sleepInfo = r.sleep_hours 
            ? `${r.sleep_hours} ชม. (${r.sleep_start || '-'} - ${r.sleep_end || '-'}) ${r.sleep_quality || ''}`
            : '-';
            
        const extraSleepInfo = r.extra_sleep === 'นอนเพิ่ม'
            ? `${r.extra_sleep_hours} ชม. (${r.extra_sleep_start || '-'} - ${r.extra_sleep_end || '-'}) ${r.extra_sleep_quality || ''}`
            : 'ไม่นอนเพิ่ม';

        return {
            "วันที่": r.date,
            "ชื่อพนักงาน": r.driver_name,
            "รหัสพนักงาน": r.driver_id,
            
            // --- 1. สุขภาพก่อนงาน (Driver Self Check) ---
            "ความเหนื่อยล้า": formatDetail(r.tired, r.tired_detail),
            "การเจ็บป่วย": r.sick === 'มี' ? `มี (${r.sick_detail || '-'}) หาหมอ: ${r.seen_doctor || '-'}` : 'ไม่มี',
            "ความง่วง": formatDetail(r.drowsy, r.drowsy_detail),
            "การบาดเจ็บ": formatDetail(r.injury, r.injury_detail),
            "การใช้ยา": r.medication === 'ทาน' ? `ทาน (${r.medication_name || '-'})` : 'ไม่ทาน',
            "สภาพร่างกาย(ก่อน)": formatDetail(r.body_condition, r.body_condition_detail),
            "การนอนหลับ": sleepInfo,
            "การนอนเพิ่ม": extraSleepInfo,
            "เรื่องกังวลใจ": formatDetail(r.worry_detail, r.worry_text),
            "สถานที่พักผ่อน": formatDetail(r.rest_location, r.rest_location_detail),
            "ปัญหาสายตา": `${r.vision_problem || '-'} (แว่น: ${r.glasses || '-'})`,
            "การได้ยิน": `${r.hearing_problem || '-'} (เครื่องช่วย: ${r.hearing_aid || '-'})`,

            // --- 2. การตรวจสอบก่อนงาน (Tenko Check) ---
            "เวลาเข้างาน (อนุมัติ)": r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH') : '-',
            "ผู้ตรวจ (เข้างาน)": r.checkin_tenko_name || '-',
            "อุณหภูมิ": r.temperature || '-',
            "ความดัน": `${r.blood_pressure_high || '-'}/${r.blood_pressure_low || '-'}`,
            "แอลกอฮอล์ (เข้า)": r.alcohol_checkin || 0,
            "เหตุผลแอลกอฮอล์(เข้า)": r.alcohol_checkin_reason || '-',
            "การใช้โทรศัพท์": formatDetail(r.phone_usage_compliant, r.phone_usage_reason),
            "ผลประเมิน": formatDetail(r.can_work, r.cannot_work_reason),

            // --- 3. รายงานหลังงาน (Driver Post-work) ---
            "การส่งมอบรถ": formatDetail(r.vehicle_handover, r.vehicle_detail),
            "สภาพร่างกาย(หลัง)": formatDetail(r.body_condition_checkout, r.body_detail_checkout),
            "จุดเสี่ยง": formatDetail(r.route_risk, r.route_detail),

            // --- 4. การตรวจสอบหลังงาน (Tenko Check) ---
            "เวลาเลิกงาน (อนุมัติ)": r.checkout_timestamp ? new Date(r.checkout_timestamp).toLocaleTimeString('th-TH') : '-',
            "ผู้ตรวจ (เลิกงาน)": r.checkout_tenko_name || '-',
            "แอลกอฮอล์ (ออก)": r.alcohol_checkout || 0,
            "เหตุผลแอลกอฮอล์(ออก)": r.alcohol_checkout_reason || '-',
            "ข้อละเมิดการขับขี่": formatDetail(r.driving_violation, r.violation_detail)
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-width for key columns
    const wscols = [
        {wch: 12}, {wch: 20}, {wch: 10}, // Date, Name, ID
        {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, // Health
        {wch: 25}, {wch: 25}, // Sleep
        {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, // Env
        {wch: 15}, {wch: 20}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 15}, // Tenko Checkin
        {wch: 20}, {wch: 20}, {wch: 20}, // Post-work Driver
        {wch: 15}, {wch: 20}, {wch: 10}, {wch: 15}, {wch: 20} // Tenko Checkout
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tenko Data");
    XLSX.writeFile(wb, `Tenko_Full_Report_${today}.xlsx`);
  };

  const getSafeTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '-';
    }
  };

  const getSafeDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString('th-TH', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (e) {
        return '-';
    }
  };

  const getFixStartBadge = (record: TenkoRecord) => {
    // Logic to find first Monday approved checkin
    const history = records.filter(r => 
        r.driver_id === record.driver_id && 
        r.checkin_status === 'approved' && 
        r.checkin_timestamp
    ).sort((a,b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const mondayRecord = history.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    
    let status = 'New';
    
    if (mondayRecord) {
        const currentStr = record.checkin_timestamp || record.checkin_real_timestamp;
        if (currentStr) {
             const baseDate = new Date(mondayRecord.checkin_timestamp!);
             const targetDate = new Date(currentStr);
             const baseMinutes = baseDate.getHours() * 60 + baseDate.getMinutes();
             const targetMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
             
             if (Math.abs(targetMinutes - baseMinutes) > 120) {
                 status = 'NG';
             } else {
                 status = 'OK';
             }
        }
    }

    if (status === 'NG') return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 whitespace-nowrap">Fix Start: NG</span>;
    if (status === 'OK') return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600 border border-emerald-200 whitespace-nowrap">Fix Start: OK</span>;
    return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">First Time</span>;
  };

  const calculateFixStartNGMonth = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let ngCount = 0;

    // Group approved records by driver for current month
    const driverGroups: Record<string, TenkoRecord[]> = {};
    records.filter(r => {
         if (!r.checkin_timestamp || r.checkin_status !== 'approved') return false;
         const d = new Date(r.checkin_timestamp);
         return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).forEach(r => {
        if (!driverGroups[r.driver_id]) driverGroups[r.driver_id] = [];
        driverGroups[r.driver_id].push(r);
    });

    // Check logic
    Object.values(driverGroups).forEach(list => {
        // Sort by time ascending
        list.sort((a,b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());
        
        // Find Monday base
        const monday = list.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
        if (monday) {
             const baseTime = new Date(monday.checkin_timestamp!);
             const baseMins = baseTime.getHours() * 60 + baseTime.getMinutes();

             list.forEach(item => {
                 const curTime = new Date(item.checkin_timestamp!);
                 const curMins = curTime.getHours() * 60 + curTime.getMinutes();
                 if (Math.abs(curMins - baseMins) > 120) {
                     ngCount++;
                 }
             });
        }
    });
    return ngCount;
  };

  const fixStartNGCount = calculateFixStartNGMonth();

  const renderStats = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none">
            <h3 className="text-amber-100 mb-1 text-sm">รอตรวจก่อนงาน</h3>
            <div className="text-3xl font-bold">{pendingCheckin.length}</div>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-none">
            <h3 className="text-blue-100 mb-1 text-sm">กำลังปฏิบัติงาน</h3>
            <div className="text-3xl font-bold">{activeDrivers.length}</div>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-none">
            <h3 className="text-purple-100 mb-1 text-sm">รอตรวจหลังงาน</h3>
            <div className="text-3xl font-bold">{pendingCheckout.length}</div>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none">
            <h3 className="text-emerald-100 mb-1 text-sm">เสร็จสิ้นแล้ว</h3>
            <div className="text-3xl font-bold">{completed.length}</div>
        </Card>
        <Card className={`${fixStartNGCount > 0 ? 'bg-red-600' : 'bg-blue-900'} text-white border-none`}>
            <h3 className="text-white/80 mb-1 text-sm">Fix Start (เดือนนี้)</h3>
            <div className="text-3xl font-bold flex items-baseline gap-2">
                {fixStartNGCount} <span className="text-sm font-normal">NG</span>
            </div>
            {fixStartNGCount === 0 && <div className="text-[10px] text-green-300 mt-1"><i className="fas fa-check-circle"></i> ปกติทุกท่าน</div>}
        </Card>
        <Card className="bg-white border-l-4 border-blue-500">
            <h3 className="text-slate-500 mb-1 text-sm">รายการวันนี้</h3>
            <div className="text-3xl font-bold text-slate-800">{records.filter(r => r.date === today).length}</div>
        </Card>
    </div>
  );

  const renderList = (title: string, items: TenkoRecord[], type: 'checkin' | 'checkout' | 'history') => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            {type === 'history' && (
                <Button onClick={exportExcel} variant="secondary" size="sm">
                    <i className="fas fa-file-excel"></i> Export Excel
                </Button>
            )}
        </div>
        
        {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <i className="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
                <p className="text-slate-500">ไม่มีรายการ</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(record => {
                    const timestamp = type === 'checkout' 
                        ? (record.checkout_timestamp || record.checkout_real_timestamp) 
                        : (record.checkin_timestamp || record.checkin_real_timestamp);
                    
                    return (
                        <Card key={record.__backendId} className="hover:shadow-md transition-all cursor-pointer group" onClick={() => onSelectRecord(record.__backendId)}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center flex-wrap gap-1">
                                        {record.driver_name}
                                        {type === 'checkin' && getFixStartBadge(record)}
                                    </h4>
                                    <p className="text-xs text-slate-500">ID: {record.driver_id}</p>
                                </div>
                                {type !== 'history' && <Badge type="pending">รออนุมัติ</Badge>}
                                {type === 'history' && <Badge type="approved">เสร็จสิ้น</Badge>}
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                                <p><i className="fas fa-calendar-day w-5 text-center text-slate-400"></i> {new Date(record.date).toLocaleDateString('th-TH')}</p>
                                <p><i className="fas fa-clock w-5 text-center text-slate-400"></i> {getSafeTime(timestamp)}</p>
                            </div>
                        </Card>
                    );
                })}
            </div>
        )}
    </div>
  );

  if (view === 'dashboard') {
    return (
      <div className="pb-10">
        <h1 className="text-2xl font-bold mb-6">ภาพรวมระบบ Tenko</h1>
        {renderStats()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
            {/* Column 1: Pending Check-in */}
            <Card className="flex flex-col h-full bg-white border-t-4 border-amber-500">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-amber-700 text-lg">
                        <i className="fas fa-clock"></i> รอตรวจก่อนงาน
                    </h3>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">{pendingCheckin.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {pendingCheckin.map(r => (
                        <div key={r.__backendId} onClick={() => onSelectRecord(r.__backendId)} className="flex justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100 transition-colors">
                            <div>
                                <p className="font-semibold text-slate-700 flex items-center gap-1">
                                    {r.driver_name}
                                    {getFixStartBadge(r)}
                                </p>
                                <p className="text-xs text-slate-400">ID: {r.driver_id}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-600">{getSafeTime(r.checkin_timestamp || r.checkin_real_timestamp)}</p>
                            </div>
                        </div>
                    ))}
                    {pendingCheckin.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <i className="fas fa-check-circle text-4xl mb-2"></i>
                            <p>ไม่มีรายการ</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Column 2: Active / Not Checkout Yet */}
            <Card className="flex flex-col h-full bg-white border-t-4 border-blue-500">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-blue-700 text-lg">
                        <i className="fas fa-truck-moving"></i> กำลังปฏิบัติงาน (ยังไม่ส่งเลิก)
                    </h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{activeDrivers.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {activeDrivers.map(r => (
                        <div key={r.__backendId} className="flex justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <div>
                                <p className="font-semibold text-slate-700">{r.driver_name}</p>
                                <p className="text-xs text-slate-500">เริ่มงานเมื่อ: {getSafeDateTime(r.checkin_timestamp)}</p>
                            </div>
                            <div className="text-right">
                                <Badge type="approved">On Duty</Badge>
                            </div>
                        </div>
                    ))}
                    {activeDrivers.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <i className="fas fa-road text-4xl mb-2"></i>
                            <p>ไม่มีรถวิ่งงาน</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Column 3: Pending Check-out */}
            <Card className="flex flex-col h-full bg-white border-t-4 border-purple-500">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-purple-700 text-lg">
                        <i className="fas fa-flag-checkered"></i> รอตรวจหลังงาน
                    </h3>
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">{pendingCheckout.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {pendingCheckout.map(r => (
                        <div key={r.__backendId} onClick={() => onSelectRecord(r.__backendId)} className="flex justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100 transition-colors">
                            <div>
                                <p className="font-semibold text-slate-700">{r.driver_name}</p>
                                <p className="text-xs text-slate-400">ID: {r.driver_id}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-600">{getSafeDateTime(r.checkout_timestamp || r.checkout_real_timestamp)}</p>
                            </div>
                        </div>
                    ))}
                     {pendingCheckout.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <i className="fas fa-check-circle text-4xl mb-2"></i>
                            <p>ไม่มีรายการ</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
      </div>
    );
  }

  if (view === 'queue-checkin') return renderList('คิวตรวจสอบ (ก่อนเริ่มงาน)', pendingCheckin, 'checkin');
  if (view === 'queue-checkout') return renderList('คิวตรวจสอบ (หลังเลิกงาน)', pendingCheckout, 'checkout');
  if (view === 'completed') return renderList('ประวัติรายการที่เสร็จสิ้น', completed, 'history');
  
  return null;
};