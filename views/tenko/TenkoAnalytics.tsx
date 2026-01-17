import React, { useState, useMemo, useEffect } from 'react';
import { TenkoRecord, User } from '../../types';
import { Card, Button, Badge } from '../../components/UI';
import { StorageService } from '../../services/storage';
import * as XLSX from 'xlsx';

interface Props {
  records: TenkoRecord[];
}

export const TenkoAnalytics: React.FC<Props> = ({ records }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(''); // Filter state
  const [drivers, setDrivers] = useState<User[]>([]);

  useEffect(() => {
    StorageService.getUsers().then(users => {
        setDrivers(users.filter(u => u.role === 'driver'));
    });
  }, []);

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
        const d = new Date(r.checkin_timestamp || r.date);
        return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
    });
  }, [filteredRecords, currentMonth]);

  // --- Graph Data (Last 5 days for selected driver or aggregate) ---
  const graphData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...monthRecords]
        .filter(r => r.blood_pressure_high && r.blood_pressure_low)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Take last 5
    return sorted.slice(-5);
  }, [monthRecords]);


  // --- Export Logic ---
  const exportExcel = () => {
    const data = monthRecords.map(r => {
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
    
    // Auto-width
    const wscols = [
        {wch: 12}, {wch: 20}, {wch: 10}, 
        {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15},
        {wch: 25}, {wch: 25},
        {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15},
        {wch: 15}, {wch: 20}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 15},
        {wch: 20}, {wch: 20}, {wch: 20},
        {wch: 15}, {wch: 20}, {wch: 10}, {wch: 15}, {wch: 20}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TenkoReport");
    XLSX.writeFile(wb, `Tenko_Full_Export_${selectedDriverId || 'ALL'}_${currentMonth.toISOString().slice(0,7)}.xlsx`);
  };

  // --- Calendar Helpers ---
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const getDayCount = (day: number) => {
    const target = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return filteredRecords.filter(r => r.date === target).length;
  };

  // --- SVG Graph Render ---
  const renderBPGraph = () => {
    if (graphData.length < 2) return <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">ข้อมูลไม่เพียงพอสำหรับกราฟ (ต้องมีอย่างน้อย 2 วัน)</div>;

    // Canvas Configuration
    const svgHeight = 300;
    const svgWidth = 800; // Internal coordinate system width
    const paddingX = 80;
    const paddingY = 40;
    
    // Y-Axis Scale
    const maxVal = 180;
    const minVal = 50;
    const range = maxVal - minVal;
    const drawingHeight = svgHeight - (paddingY * 2);
    const drawingWidth = svgWidth - (paddingX * 2);

    const getX = (i: number) => paddingX + (i / (graphData.length - 1)) * drawingWidth;
    const getY = (val: number) => (svgHeight - paddingY) - ((val - minVal) / range) * drawingHeight;

    // Generate Points
    const pointsHigh = graphData.map((d, i) => `${getX(i)},${getY(d.blood_pressure_high || 0)}`).join(' ');
    const pointsLow = graphData.map((d, i) => `${getX(i)},${getY(d.blood_pressure_low || 0)}`).join(' ');

    // Generate Areas (for gradient fill)
    const areaHigh = `${pointsHigh} ${getX(graphData.length-1)},${svgHeight-paddingY} ${getX(0)},${svgHeight-paddingY}`;
    const areaLow = `${pointsLow} ${getX(graphData.length-1)},${svgHeight-paddingY} ${getX(0)},${svgHeight-paddingY}`;

    return (
        <div className="relative h-[320px] w-full p-2">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible drop-shadow-sm">
                <defs>
                    <linearGradient id="gradHigh" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradLow" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines & Y-Axis Labels */}
                {[60, 90, 120, 150].map((val) => (
                    <g key={val}>
                        <line 
                            x1={paddingX - 10} y1={getY(val)} 
                            x2={svgWidth - paddingX + 10} y2={getY(val)} 
                            stroke="#e2e8f0" strokeWidth="1" strokeDasharray={val === 90 || val === 140 ? "5,5" : ""} 
                        />
                        <text x={paddingX - 20} y={getY(val) + 4} fontSize="12" fill="#94a3b8" textAnchor="end">{val}</text>
                    </g>
                ))}

                {/* Area Fills */}
                <polygon points={areaHigh} fill="url(#gradHigh)" />
                <polygon points={areaLow} fill="url(#gradLow)" />

                {/* Lines */}
                <polyline points={pointsHigh} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pointsLow} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* Data Points */}
                {graphData.map((d, i) => (
                    <g key={i} className="group cursor-pointer">
                        {/* High Point */}
                        <circle cx={getX(i)} cy={getY(d.blood_pressure_high!)} r="5" fill="#fff" stroke="#ef4444" strokeWidth="2.5" className="transition-all duration-300 group-hover:r-7" />
                        <text x={getX(i)} y={getY(d.blood_pressure_high!) - 15} fontSize="14" fontWeight="bold" fill="#ef4444" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity select-none">{d.blood_pressure_high}</text>
                        
                        {/* Low Point */}
                        <circle cx={getX(i)} cy={getY(d.blood_pressure_low!)} r="5" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" className="transition-all duration-300 group-hover:r-7" />
                        <text x={getX(i)} y={getY(d.blood_pressure_low!) + 25} fontSize="14" fontWeight="bold" fill="#3b82f6" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity select-none">{d.blood_pressure_low}</text>
                        
                        {/* X-Axis Date Label */}
                        <text x={getX(i)} y={svgHeight - 10} fontSize="12" fill="#64748b" textAnchor="middle">{new Date(d.date).toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})}</text>
                        
                        {/* Vertical Guide Line on Hover */}
                        <line x1={getX(i)} y1={paddingY} x2={getX(i)} y2={svgHeight - paddingY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" className="opacity-0 group-hover:opacity-20" />
                    </g>
                ))}
            </svg>
            <div className="absolute top-2 right-4 flex gap-4 text-xs bg-white/80 p-2 rounded-lg backdrop-blur-sm shadow-sm border border-slate-100">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"></div> ความดันบน (SYS)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div> ความดันล่าง (DIA)</div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
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

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Calendar */}
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
                                ${selectedDriverId && count > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}
                            `}>
                                <span>{i+1}</span>
                                {count > 0 && (
                                    <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1 text-white font-bold
                                        ${selectedDriverId ? 'bg-emerald-500' : 'bg-blue-600'}
                                    `}>
                                        {selectedDriverId ? <i className="fas fa-check text-[10px]"></i> : count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Right: BP Graph */}
            <Card className="h-full flex flex-col">
                <div className="mb-4">
                    <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                        <i className="fas fa-heartbeat text-red-500"></i> แนวโน้มความดันโลหิต
                    </h3>
                    <p className="text-xs text-slate-500">5 วันล่าสุดที่มีข้อมูล {selectedDriverId ? '(รายบุคคล)' : '(รวม)'}</p>
                </div>
                <div className="flex-1 bg-white rounded-lg border border-slate-100 overflow-hidden shadow-inner">
                    {renderBPGraph()}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                        <span className="text-xs text-slate-500 block uppercase tracking-wide">Avg ความดันบน</span>
                        <span className="font-bold text-red-600 text-xl">
                            {graphData.length > 0 ? Math.round(graphData.reduce((a,b) => a + (b.blood_pressure_high||0), 0) / graphData.length) : '-'}
                        </span>
                        <span className="text-xs text-red-400 ml-1">mmHg</span>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <span className="text-xs text-slate-500 block uppercase tracking-wide">Avg ความดันล่าง</span>
                        <span className="font-bold text-blue-600 text-xl">
                            {graphData.length > 0 ? Math.round(graphData.reduce((a,b) => a + (b.blood_pressure_low||0), 0) / graphData.length) : '-'}
                        </span>
                        <span className="text-xs text-blue-400 ml-1">mmHg</span>
                    </div>
                </div>
            </Card>
        </div>

        {/* Bottom: Detailed List */}
        <Card>
            <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2">
                <i className="fas fa-list"></i> รายละเอียดการตรวจ ({monthRecords.length} รายการ)
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <tr>
                            <th className="p-3 rounded-tl-lg">วันที่</th>
                            <th className="p-3">พนักงาน</th>
                            <th className="p-3 text-center">เวลาเข้า</th>
                            <th className="p-3 text-center">BP (บน/ล่าง)</th>
                            <th className="p-3 text-center">Temp</th>
                            <th className="p-3 text-center">Alcohol</th>
                            <th className="p-3 text-right rounded-tr-lg">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {monthRecords.map(r => (
                            <tr key={r.__backendId} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-medium text-slate-700">{new Date(r.date).toLocaleDateString('th-TH')}</td>
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
                        ))}
                        {monthRecords.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400">ไม่พบข้อมูล</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
  );
};