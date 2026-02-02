
import React, { useState, useMemo, useEffect } from 'react';
import { TenkoRecord, User } from '../../types';
import { Card, Button, Badge } from '../../components/UI';
import { StorageService } from '../../services/storage';
import * as XLSX from 'xlsx';

interface Props {
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
}

export const TenkoAnalytics: React.FC<Props> = ({ records, onSelectRecord }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(''); // Filter state
  const [drivers, setDrivers] = useState<User[]>([]);
  const [showNGModal, setShowNGModal] = useState(false);

  useEffect(() => {
    StorageService.getUsers().then(users => {
        setDrivers(users.filter(u => u.role === 'driver'));
    });
  }, []);

  // --- Date Helper: Use Check-in Approval Date if available ---
  const getRecordDateStr = (r: TenkoRecord) => {
      if (r.checkin_timestamp) {
          const d = new Date(r.checkin_timestamp);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
      }
      return r.date;
  };

  // --- NG Logic Helpers ---
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const calculateResult = (targetTime: string, refMinutes: number) => {
      const d = new Date(targetTime);
      const m = d.getHours() * 60 + d.getMinutes();
      return Math.abs(m - refMinutes) > 120 ? 'NG' : 'OK';
  };

  const getFixStartInfo = (targetRecord: TenkoRecord) => {
    const driverApproved = records
      .filter(r => r.driver_id === targetRecord.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
      .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const targetDate = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp || targetRecord.date;
    const targetMonday = getMonday(targetDate);
    
    const weekRecords = driverApproved.filter(r => getMonday(r.checkin_timestamp!) === targetMonday);
    const mondayRecord = weekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    const referenceRecord = mondayRecord || weekRecords[0];

    if (!referenceRecord) return { status: 'New', time: '--:--' };

    const refDate = new Date(referenceRecord.checkin_timestamp!);
    const refMinutes = refDate.getHours() * 60 + refDate.getMinutes();
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    const checkTimeStr = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp;
    if (!checkTimeStr) return { status: 'OK', time: displayTime };

    const result = calculateResult(checkTimeStr, refMinutes);
    return { status: result, time: displayTime, refTime: displayTime };
  };

  // --- Filtering Logic ---
  const filteredRecords = useMemo(() => {
    let res = records;
    if (selectedDriverId) {
        res = res.filter(r => r.driver_id === selectedDriverId);
    }
    return res;
  }, [records, selectedDriverId]);

  const monthRecords = useMemo(() => {
    return filteredRecords.filter(r => {
        // Use Approval Date for filtering month
        const rDate = getRecordDateStr(r);
        const parts = rDate.split('-');
        if (parts.length !== 3) return false;
        const rYear = parseInt(parts[0]);
        const rMonth = parseInt(parts[1]) - 1;
        return rMonth === currentMonth.getMonth() && rYear === currentMonth.getFullYear();
    }).sort((a, b) => {
        // Sort by approval time
        const timeA = a.checkin_timestamp ? new Date(a.checkin_timestamp).getTime() : new Date(a.date).getTime();
        const timeB = b.checkin_timestamp ? new Date(b.checkin_timestamp).getTime() : new Date(b.date).getTime();
        return timeB - timeA;
    });
  }, [filteredRecords, currentMonth]);

  const ngRecords = useMemo(() => {
      return monthRecords.filter(r => getFixStartInfo(r).status === 'NG');
  }, [monthRecords, records]);

  // --- Graph Data ---
  const graphData = useMemo(() => {
    const sorted = [...monthRecords]
        .filter(r => r.blood_pressure_high && r.blood_pressure_low)
        .sort((a, b) => {
            const timeA = a.checkin_timestamp ? new Date(a.checkin_timestamp).getTime() : new Date(a.date).getTime();
            const timeB = b.checkin_timestamp ? new Date(b.checkin_timestamp).getTime() : new Date(b.date).getTime();
            return timeA - timeB;
        });
    return sorted.slice(-5);
  }, [monthRecords]);


  // --- Export Logic ---
  const exportExcel = () => {
    const data = monthRecords.map(r => {
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
        
        // Use approved date for export
        const dateStr = r.checkin_timestamp ? r.checkin_timestamp.split('T')[0] : r.date;

        return {
            "วันที่": dateStr,
            "ชื่อพนักงาน": r.driver_name,
            "รหัสพนักงาน": r.driver_id,
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
            "เวลาเข้างาน (อนุมัติ)": r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH') : '-',
            "ผู้ตรวจ (เข้างาน)": r.checkin_tenko_name || '-',
            "อุณหภูมิ": r.temperature || '-',
            "ความดัน": `${r.blood_pressure_high || '-'}/${r.blood_pressure_low || '-'}`,
            "แอลกอฮอล์ (เข้า)": r.alcohol_checkin || 0,
            "เหตุผลแอลกอฮอล์(เข้า)": r.alcohol_checkin_reason || '-',
            "การใช้โทรศัพท์": formatDetail(r.phone_usage_compliant, r.phone_usage_reason),
            "ผลประเมิน": formatDetail(r.can_work, r.cannot_work_reason),
            "การส่งมอบรถ": formatDetail(r.vehicle_handover, r.vehicle_detail),
            "สภาพร่างกาย(หลัง)": formatDetail(r.body_condition_checkout, r.body_detail_checkout),
            "จุดเสี่ยงและมาตรฐานSOP": formatDetail(r.route_risk, r.route_detail),
            "เวลาเลิกงาน (อนุมัติ)": r.checkout_timestamp ? new Date(r.checkout_timestamp).toLocaleTimeString('th-TH') : '-',
            "ผู้ตรวจ (เลิกงาน)": r.checkout_tenko_name || '-',
            "แอลกอฮอล์ (ออก)": r.alcohol_checkout || 0,
            "เหตุผลแอลกอฮอล์(ออก)": r.alcohol_checkout_reason || '-',
            "ข้อละเมิดการขับขี่": formatDetail(r.driving_violation, r.violation_detail)
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TenkoReport");
    XLSX.writeFile(wb, `Tenko_Full_Export_${selectedDriverId || 'ALL'}_${currentMonth.toISOString().slice(0,7)}.xlsx`);
  };

  // --- Calendar Helpers ---
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const getDayCount = (day: number) => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const target = `${y}-${m}-${d}`;
    // Use getRecordDateStr to compare against the calendar cell
    return filteredRecords.filter(r => getRecordDateStr(r) === target).length;
  };

  // --- SVG Graph Render ---
  const renderBPGraph = () => {
    if (graphData.length < 2) return <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">ข้อมูลไม่เพียงพอสำหรับกราฟ (ต้องมีอย่างน้อย 2 วัน)</div>;

    const svgHeight = 300;
    const svgWidth = 800;
    const paddingX = 80;
    const paddingY = 40;
    const maxVal = 180;
    const minVal = 50;
    const range = maxVal - minVal;
    const drawingHeight = svgHeight - (paddingY * 2);
    const drawingWidth = svgWidth - (paddingX * 2);

    const getX = (i: number) => paddingX + (i / (graphData.length - 1)) * drawingWidth;
    const getY = (val: number) => (svgHeight - paddingY) - ((val - minVal) / range) * drawingHeight;

    const pointsHigh = graphData.map((d, i) => `${getX(i)},${getY(d.blood_pressure_high || 0)}`).join(' ');
    const pointsLow = graphData.map((d, i) => `${getX(i)},${getY(d.blood_pressure_low || 0)}`).join(' ');

    return (
        <div className="relative h-[320px] w-full p-2">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible drop-shadow-sm">
                {[60, 90, 120, 150].map((val) => (
                    <g key={val}>
                        <line x1={paddingX - 10} y1={getY(val)} x2={svgWidth - paddingX + 10} y2={getY(val)} stroke="#e2e8f0" strokeWidth="1" />
                        <text x={paddingX - 20} y={getY(val) + 4} fontSize="12" fill="#94a3b8" textAnchor="end">{val}</text>
                    </g>
                ))}
                <polyline points={pointsHigh} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pointsLow} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {graphData.map((d, i) => {
                    // Display approval date in graph axis
                    const displayDate = d.checkin_timestamp ? new Date(d.checkin_timestamp) : new Date(d.date);
                    return (
                        <g key={i}>
                            <circle cx={getX(i)} cy={getY(d.blood_pressure_high!)} r="5" fill="#fff" stroke="#ef4444" strokeWidth="2.5" />
                            <circle cx={getX(i)} cy={getY(d.blood_pressure_low!)} r="5" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
                            <text x={getX(i)} y={svgHeight - 10} fontSize="12" fill="#64748b" textAnchor="middle">{displayDate.toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">แดชบอร์ด & สถิติ</h2>
                <p className="text-slate-500 text-sm">ข้อมูลเดือน: {currentMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <select 
                    className="p-2.5 border rounded-lg bg-slate-50 min-w-[200px]"
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                >
                    <option value="">-- พนักงานทั้งหมด --</option>
                    {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                    ))}
                </select>
                <Button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 whitespace-nowrap">
                    <i className="fas fa-file-excel"></i> Export
                </Button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <Card className="bg-blue-50 border-blue-200">
                 <p className="text-xs text-blue-600 font-bold uppercase">รายการทั้งหมดในเดือนนี้</p>
                 <p className="text-3xl font-black text-blue-800">{monthRecords.length}</p>
                 <p className="text-xs text-blue-400 mt-1">ครั้ง</p>
             </Card>
             
             {/* NG Status Card - Clickable */}
             <Card 
                className={`cursor-pointer transition-transform hover:scale-105 ${ngRecords.length > 0 ? 'bg-red-50 border-red-200 shadow-md shadow-red-100' : 'bg-slate-50 border-slate-200 opacity-60'}`}
                onClick={() => ngRecords.length > 0 && setShowNGModal(true)}
             >
                 <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-red-600 font-bold uppercase">NG Fix Start Time</p>
                        <p className={`text-3xl font-black ${ngRecords.length > 0 ? 'text-red-800' : 'text-slate-400'}`}>{ngRecords.length}</p>
                    </div>
                    {ngRecords.length > 0 && <div className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">คลิกดูรายชื่อ</div>}
                 </div>
                 <p className="text-xs text-red-400 mt-1">พบพนักงาน {new Set(ngRecords.map(r => r.driver_id)).size} ท่าน</p>
             </Card>

             <Card className="bg-emerald-50 border-emerald-200">
                 <p className="text-xs text-emerald-600 font-bold uppercase">เฉลี่ยอุณหภูมิ</p>
                 <p className="text-3xl font-black text-emerald-800">
                    {monthRecords.length > 0 ? (monthRecords.reduce((a, b) => a + (b.temperature || 0), 0) / monthRecords.length).toFixed(1) : '-'}
                 </p>
                 <p className="text-xs text-emerald-400 mt-1">°C</p>
             </Card>

             <Card className="bg-purple-50 border-purple-200">
                 <p className="text-xs text-purple-600 font-bold uppercase">เฉลี่ยชั่วโมงนอน</p>
                 <p className="text-3xl font-black text-purple-800">
                    {monthRecords.length > 0 ? (monthRecords.reduce((a, b) => a + (b.sleep_hours || 0), 0) / monthRecords.length).toFixed(1) : '-'}
                 </p>
                 <p className="text-xs text-purple-400 mt-1">ชั่วโมง</p>
             </Card>
        </div>

        {/* NG List Modal */}
        {showNGModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                    <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> รายชื่อพนักงานที่ติดสถานะ NG (Fix Start Time)
                        </h3>
                        <button onClick={() => setShowNGModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-800 font-bold border-b border-red-100 sticky top-0">
                                <tr>
                                    <th className="p-3">วันที่</th>
                                    <th className="p-3">ชื่อพนักงาน</th>
                                    <th className="p-3">เวลาเริ่มงาน</th>
                                    <th className="p-3">เวลาอ้างอิง (Ref)</th>
                                    <th className="p-3 text-right">ส่วนต่าง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ngRecords.map(r => {
                                    const info = getFixStartInfo(r);
                                    const d = new Date(r.checkin_timestamp || r.checkin_real_timestamp!);
                                    const targetMins = d.getHours() * 60 + d.getMinutes();
                                    const refParts = info.refTime?.split(':') || ['0','0'];
                                    const refMins = parseInt(refParts[0]) * 60 + parseInt(refParts[1]);
                                    const diff = Math.abs(targetMins - refMins);

                                    // Display Approval Date
                                    const displayDate = r.checkin_timestamp ? new Date(r.checkin_timestamp) : new Date(r.date);

                                    return (
                                        <tr key={r.__backendId} className="hover:bg-red-50/30 cursor-pointer" onClick={() => onSelectRecord(r.__backendId)}>
                                            <td className="p-3 font-medium">{displayDate.toLocaleDateString('th-TH')}</td>
                                            <td className="p-3 font-bold">{r.driver_name} ({r.driver_id})</td>
                                            <td className="p-3 text-red-600 font-bold">{new Date(r.checkin_timestamp!).toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'})}</td>
                                            <td className="p-3 text-slate-500">{info.refTime}</td>
                                            <td className="p-3 text-right font-bold text-red-700">{Math.floor(diff / 60)} ชม. {diff % 60} นาที</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button onClick={() => setShowNGModal(false)} variant="secondary">ปิดหน้าต่าง</Button>
                    </div>
                </Card>
            </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-700">ปฏิทินการทำงาน</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth()-1)))} className="p-1 hover:bg-slate-100 rounded"><i className="fas fa-chevron-left"></i></button>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth()+1)))} className="p-1 hover:bg-slate-100 rounded"><i className="fas fa-chevron-right"></i></button>
                    </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                    {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>)}
                    {Array.from({length: firstDay}).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({length: daysInMonth}).map((_, i) => {
                        const count = getDayCount(i+1);
                        return (
                            <div key={i} className={`
                                h-14 flex flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors relative
                                ${count > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}
                            `}>
                                <span>{i+1}</span>
                                {count > 0 && (
                                    <span className="text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1 text-white font-bold bg-blue-600">
                                        {selectedDriverId ? <i className="fas fa-check text-[10px]"></i> : count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card className="h-full flex flex-col">
                <div className="mb-4">
                    <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                        <i className="fas fa-heartbeat text-red-500"></i> แนวโน้มความดันโลหิต
                    </h3>
                    <p className="text-xs text-slate-500">5 วันล่าสุดที่มีข้อมูล {selectedDriverId ? '(รายบุคคล)' : '(รวม)'}</p>
                </div>
                <div className="flex-1 bg-white rounded-lg border border-slate-100 overflow-hidden shadow-inner min-h-[250px]">
                    {renderBPGraph()}
                </div>
            </Card>
        </div>

        {/* Detailed List */}
        <Card>
            <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2">
                <i className="fas fa-list"></i> รายละเอียดการตรวจ ({monthRecords.length} รายการ)
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <tr>
                            <th className="p-3">วันที่ (อนุมัติ)</th>
                            <th className="p-3">พนักงาน</th>
                            <th className="p-3 text-center">เวลาเข้า</th>
                            <th className="p-3 text-center">BP (บน/ล่าง)</th>
                            <th className="p-3 text-center">Temp</th>
                            <th className="p-3 text-center">Alcohol</th>
                            <th className="p-3 text-right">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {monthRecords.map(r => {
                            // Display Approval Date in table
                            const displayDate = r.checkin_timestamp ? new Date(r.checkin_timestamp) : new Date(r.date);
                            return (
                                <tr key={r.__backendId} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectRecord(r.__backendId)}>
                                    <td className="p-3 font-medium text-slate-700">{displayDate.toLocaleDateString('th-TH')}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-700">{r.driver_name}</div>
                                        <div className="text-xs text-slate-400">{r.driver_id}</div>
                                    </td>
                                    <td className="p-3 text-center text-slate-600">
                                        {r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '-'}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`font-bold ${r.blood_pressure_high! > 140 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {r.blood_pressure_high}
                                        </span> / {r.blood_pressure_low}
                                    </td>
                                    <td className="p-3 text-center">{r.temperature}</td>
                                    <td className="p-3 text-center text-emerald-600 font-bold">{r.alcohol_checkin}</td>
                                    <td className="p-3 text-right">
                                        <Badge type={r.checkin_status === 'approved' ? 'approved' : 'pending'}>
                                            {r.checkin_status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจ'}
                                        </Badge>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .animate-fade-in { animation: fadeIn 0.3s ease-out; }
          .animate-scale-up { animation: scaleUp 0.2s ease-out; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `}</style>
    </div>
  );
};
