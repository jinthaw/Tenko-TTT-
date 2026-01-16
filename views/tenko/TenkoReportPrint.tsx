import React, { useState, useMemo } from 'react';
import { TenkoRecord, User } from '../../types';
import { StorageService } from '../../services/storage';
import { Button, Card } from '../../components/UI';

interface Props {
  records: TenkoRecord[];
}

export const TenkoReportPrint: React.FC<Props> = ({ records }) => {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const drivers = useMemo(() => StorageService.getUsers().filter(u => u.role === 'driver'), []);
  
  // Get available dates for the selected driver
  const availableDates = useMemo(() => {
    if (!selectedDriverId) return [];
    return records
        .filter(r => r.driver_id === selectedDriverId)
        .map(r => r.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [records, selectedDriverId]);

  const record = useMemo(() => {
    return records.find(r => r.driver_id === selectedDriverId && r.date === selectedDate);
  }, [records, selectedDriverId, selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  // Helper for checkbox rendering
  const CheckBox = ({ checked, label, detail }: { checked: boolean; label: string; detail?: string }) => (
    <div className="flex items-start gap-2 text-sm mb-1">
      <div className={`w-4 h-4 border border-slate-600 flex items-center justify-center shrink-0 mt-0.5 ${checked ? 'bg-slate-800 text-white' : 'bg-white'}`}>
        {checked && <i className="fas fa-check text-[10px]"></i>}
      </div>
      <div className="leading-tight">
        <span className={checked ? 'font-bold' : ''}>{label}</span>
        {checked && detail && <span className="ml-1 underline decoration-dotted text-slate-700">({detail})</span>}
      </div>
    </div>
  );

  const LabelVal = ({ label, val, unit = '' }: { label: string; val?: string | number; unit?: string }) => (
    <div className="flex justify-between items-end border-b border-slate-300 border-dotted pb-0.5 mb-1">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="text-sm font-bold text-slate-900">{val || '-'} {unit}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Controls - Hidden on Print */}
      <div className="print:hidden mb-6 space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800"><i className="fas fa-print"></i> พิมพ์รายงาน (A4)</h2>
        </div>
        
        <Card className="bg-white border-l-4 border-blue-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-bold mb-1">เลือกพนักงานขับรถ</label>
                    <select 
                        className="w-full p-2 border rounded"
                        value={selectedDriverId}
                        onChange={e => { setSelectedDriverId(e.target.value); setSelectedDate(''); }}
                    >
                        <option value="">-- กรุณาเลือก --</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">เลือกวันที่</label>
                    <select 
                        className="w-full p-2 border rounded"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        disabled={!selectedDriverId}
                    >
                        <option value="">-- กรุณาเลือก --</option>
                        {availableDates.map(d => (
                            <option key={d} value={d}>{new Date(d).toLocaleDateString('th-TH', {dateStyle: 'full'})}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <Button onClick={handlePrint} disabled={!record} className="w-full bg-slate-800 text-white hover:bg-slate-700">
                        <i className="fas fa-file-pdf"></i> พิมพ์ / บันทึกเป็น PDF
                    </Button>
                </div>
            </div>
        </Card>
      </div>

      {/* A4 Report Area */}
      <div className="flex-1 flex justify-center bg-slate-200 p-4 print:p-0 print:bg-white overflow-y-auto">
        {record ? (
            <div 
                id="print-section"
                className="bg-white shadow-lg print:shadow-none mx-auto relative box-border"
                style={{ width: '210mm', minHeight: '297mm', padding: '15mm 15mm' }}
            >
                {/* Header */}
                <div className="border-b-2 border-slate-800 pb-4 mb-4 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 uppercase">แบบฟอร์มตรวจสอบความพร้อม (Tenko)</h1>
                        <p className="text-slate-500 text-sm">บริษัท ออโต้แครี่เออร์ จำกัด (ACT)</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-600">วันที่ปฏิบัติงาน</div>
                        <div className="text-xl font-bold">{new Date(record.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</div>
                    </div>
                </div>

                {/* Driver Info Row */}
                <div className="bg-slate-100 p-3 rounded mb-4 border border-slate-300 flex justify-between">
                    <div><span className="font-bold">ชื่อพนักงาน:</span> {record.driver_name}</div>
                    <div><span className="font-bold">รหัส:</span> {record.driver_id}</div>
                </div>

                <div className="grid grid-cols-2 gap-6 h-full">
                    {/* LEFT COLUMN: Check-in */}
                    <div className="flex flex-col gap-4">
                        {/* 1. Driver Self Check */}
                        <div className="border border-slate-400 rounded p-3">
                            <h3 className="font-bold bg-slate-200 px-2 py-1 -mx-3 -mt-3 mb-2 text-sm border-b border-slate-400 text-center">1. การประเมินตนเอง (Driver Self-Check)</h3>
                            
                            <div className="space-y-1 mb-3">
                                <CheckBox checked={record.tired === 'มี'} label="มีความเหนื่อยล้าสะสม" detail={record.tired_detail} />
                                <CheckBox checked={record.sick === 'มี'} label="มีอาการเจ็บป่วย / ไม่สบาย" detail={record.sick_detail} />
                                <CheckBox checked={record.drowsy === 'มี'} label="มีอาการง่วงนอน" detail={record.drowsy_detail} />
                                <CheckBox checked={record.injury === 'มี'} label="มีอาการบาดเจ็บทางร่างกาย" detail={record.injury_detail} />
                                <CheckBox checked={record.medication === 'ทาน'} label="ทานยาที่ส่งผลต่อการขับขี่" detail={record.medication_name} />
                            </div>

                            <div className="border-t border-slate-300 pt-2 mb-2">
                                <p className="font-bold text-sm mb-1">การนอนหลับ</p>
                                <LabelVal label="เวลานอน" val={`${record.sleep_start} - ${record.sleep_end}`} />
                                <LabelVal label="รวมชั่วโมง" val={record.sleep_hours} unit="ชม." />
                                <CheckBox checked={record.sleep_quality === 'หลับสนิท'} label="หลับสนิท" />
                                {record.extra_sleep === 'นอนเพิ่ม' && (
                                    <div className="mt-1 text-xs text-slate-600 bg-slate-50 p-1 rounded">
                                        นอนเพิ่ม: {record.extra_sleep_start}-{record.extra_sleep_end} ({record.extra_sleep_hours} ชม.)
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-300 pt-2">
                                <CheckBox checked={record.vision_problem === 'มี'} label="มีปัญหาสายตา" />
                                <CheckBox checked={record.glasses === 'มี'} label="สวมใส่แว่นตา" />
                                <CheckBox checked={record.hearing_problem === 'มี'} label="มีปัญหาการได้ยิน" />
                            </div>
                        </div>

                        {/* 2. Tenko Check-in */}
                        <div className="border border-slate-400 rounded p-3 grow">
                            <h3 className="font-bold bg-blue-100 px-2 py-1 -mx-3 -mt-3 mb-2 text-sm border-b border-blue-300 text-center text-blue-900">2. ตรวจสอบก่อนงาน (Pre-work Check)</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <div className="text-xs text-slate-500">อุณหภูมิ</div>
                                    <div className="text-xl font-bold">{record.temperature}°C</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">แอลกอฮอล์</div>
                                    <div className="text-xl font-bold">{record.alcohol_checkin} <span className="text-sm font-normal">mg%</span></div>
                                </div>
                            </div>
                            <div className="mb-3">
                                <LabelVal label="ความดันโลหิต" val={`${record.blood_pressure_high} / ${record.blood_pressure_low}`} unit="mmHg" />
                            </div>

                            <div className="bg-slate-50 p-2 rounded border border-slate-200 mb-2">
                                <p className="text-xs font-bold mb-1">การใช้โทรศัพท์</p>
                                <CheckBox checked={record.phone_usage_compliant === 'ตรงตามที่แจ้ง'} label="ตรงตามที่แจ้ง" />
                                {record.phone_usage_compliant !== 'ตรงตามที่แจ้ง' && <p className="text-xs text-red-600 pl-6">{record.phone_usage_reason}</p>}
                            </div>

                            <div className="text-center mt-4 pt-2 border-t border-slate-300">
                                <div className={`inline-block border-2 px-4 py-1 rounded font-bold uppercase ${record.checkin_status === 'approved' ? 'border-green-600 text-green-700' : 'border-red-600 text-red-700'}`}>
                                    {record.checkin_status === 'approved' ? 'อนุญาตให้ปฏิบัติงาน' : 'รออนุมัติ / ไม่อนุญาต'}
                                </div>
                                <div className="mt-2 text-xs">
                                    ผู้ตรวจสอบ: <b>{record.checkin_tenko_name || '-'}</b>
                                </div>
                                <div className="text-xs text-slate-500">
                                    เวลา: {record.checkin_timestamp ? new Date(record.checkin_timestamp).toLocaleTimeString('th-TH') : '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Check-out */}
                    <div className="flex flex-col gap-4">
                        {/* 3. Driver Post-work Report */}
                        <div className="border border-slate-400 rounded p-3">
                            <h3 className="font-bold bg-slate-200 px-2 py-1 -mx-3 -mt-3 mb-2 text-sm border-b border-slate-400 text-center">3. รายงานหลังเลิกงาน (Post-work Report)</h3>
                            
                            <div className="mb-3">
                                <p className="font-bold text-sm mb-1">การส่งมอบรถสินค้า</p>
                                <div className="flex gap-4">
                                    <CheckBox checked={record.vehicle_handover === 'ปกติ'} label="ปกติ" />
                                    <CheckBox checked={record.vehicle_handover === 'ไม่ปกติ'} label="ไม่ปกติ" detail={record.vehicle_detail} />
                                </div>
                            </div>

                            <div className="mb-3 border-t border-slate-300 pt-2">
                                <p className="font-bold text-sm mb-1">สภาพร่างกายหลังขับ</p>
                                <div className="flex gap-4">
                                    <CheckBox checked={record.body_condition_checkout === 'ปกติ'} label="ปกติ" />
                                    <CheckBox checked={record.body_condition_checkout === 'ไม่ปกติ'} label="ไม่ปกติ" detail={record.body_detail_checkout} />
                                </div>
                            </div>

                            <div className="border-t border-slate-300 pt-2">
                                <p className="font-bold text-sm mb-1">จุดเสี่ยงในเส้นทาง</p>
                                <CheckBox checked={record.route_risk === 'ปกติ'} label="ไม่พบจุดเสี่ยงเพิ่มเติม" />
                                <CheckBox checked={record.route_risk === 'พบจุดเสี่ยง'} label="พบจุดเสี่ยง" detail={record.route_detail} />
                            </div>
                        </div>

                        {/* 4. Tenko Check-out */}
                        <div className="border border-slate-400 rounded p-3 grow">
                             <h3 className="font-bold bg-purple-100 px-2 py-1 -mx-3 -mt-3 mb-2 text-sm border-b border-purple-300 text-center text-purple-900">4. ตรวจสอบหลังงาน (Post-work Check)</h3>
                             
                             <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200 mb-4">
                                <span className="text-sm font-bold">ปริมาณแอลกอฮอล์</span>
                                <span className="text-xl font-bold">{record.alcohol_checkout || 0} <span className="text-sm font-normal">mg%</span></span>
                             </div>

                             <div className="mb-4">
                                <p className="font-bold text-sm mb-1">ข้อละเมิดการขับขี่</p>
                                <div className="flex gap-4">
                                    <CheckBox checked={record.driving_violation === 'ไม่มี'} label="ไม่มี" />
                                    <CheckBox checked={record.driving_violation === 'มี'} label="มี" detail={record.violation_detail} />
                                </div>
                             </div>

                             <div className="text-center mt-auto pt-4 border-t border-slate-300">
                                <div className={`inline-block border-2 px-4 py-1 rounded font-bold uppercase ${record.checkout_status === 'approved' ? 'border-green-600 text-green-700' : 'border-slate-300 text-slate-400'}`}>
                                    {record.checkout_status === 'approved' ? 'จบงานสมบูรณ์' : 'รอตรวจสอบ'}
                                </div>
                                <div className="mt-2 text-xs">
                                    ผู้ตรวจสอบ: <b>{record.checkout_tenko_name || '-'}</b>
                                </div>
                                <div className="text-xs text-slate-500">
                                    เวลา: {record.checkout_timestamp ? new Date(record.checkout_timestamp).toLocaleTimeString('th-TH') : '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Signature Section */}
                <div className="mt-6 border-t-2 border-slate-800 pt-6 flex justify-around">
                    <div className="text-center w-1/3">
                        <div className="h-16 border-b border-slate-400 mb-2"></div>
                        <p className="font-bold">{record.driver_name}</p>
                        <p className="text-xs text-slate-500">พนักงานขับรถ</p>
                    </div>
                    <div className="text-center w-1/3">
                        <div className="h-16 border-b border-slate-400 mb-2"></div>
                        <p className="font-bold">{record.checkin_tenko_name || 'เจ้าหน้าที่'}</p>
                        <p className="text-xs text-slate-500">เจ้าหน้าที่ Tenko (ผู้รับรอง)</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-400">
                    เอกสารนี้ถูกสร้างจากระบบ Tenko TTT System เมื่อ {new Date().toLocaleString('th-TH')}
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
                <i className="fas fa-file-invoice text-6xl mb-4 opacity-50"></i>
                <p className="text-lg">กรุณาเลือกพนักงานและวันที่เพื่อแสดงรายงาน</p>
            </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
            @page { 
                size: A4; 
                margin: 0; 
            }
            html, body {
                height: 100%;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: white;
            }
            
            /* Hide all direct children of body to reset the layout context */
            body * {
                visibility: hidden;
            }

            /* Show only the print section and its descendants */
            #print-section, #print-section * {
                visibility: visible;
            }

            /* Position the print section absolute top-left to overlay everything */
            #print-section {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 15mm; /* Restore padding for printer */
            }
            
            /* Hide custom scrollbars */
            ::-webkit-scrollbar {
                display: none;
            }
        }
      `}</style>
    </div>
  );
};