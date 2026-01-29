
import React, { useState, useEffect } from 'react';
import { TenkoRecord, User } from '../../types';
import { Button, Card, Input, OptionButton, Badge } from '../../components/UI';
import { StorageService } from '../../services/storage';

interface Props {
  record: TenkoRecord;
  user: User;
  type: 'checkin' | 'checkout' | 'view';
  onBack: () => void;
  onSuccess: () => void;
}

const InfoRow = ({ label, value, detail, alert }: { label: string, value?: string, detail?: string, alert?: boolean }) => (
    <div className={`flex flex-col mb-2 pb-2 border-b border-slate-50 last:border-0 ${alert ? 'bg-red-50 p-1.5 rounded' : ''}`}>
        <div className="flex justify-between text-sm items-start gap-2">
            <span className="font-semibold text-slate-600 shrink-0">{label}:</span>
            <span className={`font-bold text-right break-words ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value || '-'}</span>
        </div>
        {detail && <div className="text-xs bg-white/50 p-1.5 rounded mt-1 border border-slate-100 text-slate-600 italic"><i className="fas fa-info-circle text-slate-400"></i> {detail}</div>}
    </div>
);

export const ApprovalView: React.FC<Props> = ({ record, user, type, onBack, onSuccess }) => {
  const [form, setForm] = useState<Partial<TenkoRecord>>({
    temperature: record.temperature,
    blood_pressure_high: record.blood_pressure_high,
    blood_pressure_low: record.blood_pressure_low,
    alcohol_checkin: record.alcohol_checkin ?? 0,
    alcohol_checkout: record.alcohol_checkout ?? 0,
    phone_usage_compliant: record.phone_usage_compliant || 'ตรงตามที่แจ้ง',
    can_work: record.can_work || 'ได้',
    driving_violation: record.driving_violation || 'ไม่มี',
    
    // Driver fields (for when Tenko fills them)
    vehicle_handover: record.vehicle_handover || 'ปกติ',
    vehicle_detail: record.vehicle_detail || '',
    body_condition_checkout: record.body_condition_checkout || 'ปกติ',
    body_detail_checkout: record.body_detail_checkout || '',
    route_risk: record.route_risk || 'ปกติ',
    route_detail: record.route_detail || '',

    checkin_timestamp: record.checkin_timestamp || new Date().toISOString(),
    checkout_timestamp: record.checkout_timestamp || new Date().toISOString()
  });

  const [fixStartStatus, setFixStartStatus] = useState<string>('N/A');
  const [lastCheckout, setLastCheckout] = useState<string>('-');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
        const allRecords = await StorageService.getAll();
        
        const previousRecords = allRecords
            .filter(r => r.driver_id === record.driver_id && r.checkout_timestamp && r.__backendId !== record.__backendId)
            .sort((a, b) => new Date(b.checkout_timestamp!).getTime() - new Date(a.checkout_timestamp!).getTime());
        if (previousRecords.length > 0) {
            setLastCheckout(new Date(previousRecords[0].checkout_timestamp!).toLocaleString('th-TH'));
        }

        const driverRecords = allRecords
            .filter(r => r.driver_id === record.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
            .sort((a, b) => new Date(b.checkin_timestamp!).getTime() - new Date(a.checkin_timestamp!).getTime());

        if (driverRecords.length === 0) {
            setFixStartStatus('OK (First Record)');
            return;
        }

        const getMonday = (dateStr: string) => {
            const d = new Date(dateStr);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff)).toISOString().split('T')[0];
        };

        const currentRecordMonday = getMonday(form.checkin_timestamp!);
        const currentWeekRecords = driverRecords.filter(r => getMonday(r.checkin_timestamp!) === currentRecordMonday);

        const mondayRecord = currentWeekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
        const referenceRecord = mondayRecord || (currentWeekRecords.length > 0 ? currentWeekRecords[currentWeekRecords.length - 1] : null);

        if (!referenceRecord) {
            setFixStartStatus('OK');
            return;
        }

        const refDate = new Date(referenceRecord.checkin_timestamp!);
        const refTotalMinutes = refDate.getHours() * 60 + refDate.getMinutes();
        const displayTime = refDate.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });

        const currentCheckTime = new Date(form.checkin_timestamp!);
        const currentMinutes = currentCheckTime.getHours() * 60 + currentCheckTime.getMinutes();
        const diff = Math.abs(currentMinutes - refTotalMinutes);

        if (diff > 120) {
            setFixStartStatus(`NG (Ref: ${displayTime})`);
        } else {
            setFixStartStatus(`OK (Ref: ${displayTime})`);
        }
    };
    loadHistory();
  }, [record.driver_id, form.checkin_timestamp, record.__backendId]);


  const updateForm = (k: keyof TenkoRecord, v: any) => setForm(p => ({ ...p, [k]: v }));

  const isTempBad = (t?: number) => t && t > 37.5;
  const isBPHighBad = (bp?: number) => bp && (bp < 90 || bp > 160);
  const isBPLowBad = (bp?: number) => bp && (bp < 60 || bp > 100);
  const isAlcoholBad = (a?: number) => a !== undefined && a !== 0;

  const handleApprove = async () => {
    if (isAlcoholBad(form.alcohol_checkin) && !form.alcohol_checkin_reason) return alert('กรุณาระบุเหตุผลค่าแอลกอฮอล์');
    if (form.can_work === 'ไม่ได้' && !form.cannot_work_reason) return alert('กรุณาระบุสาเหตุที่วิ่งงานไม่ได้');

    setSubmitting(true);
    
    // Copy all form data to updateData
    const updateData: Partial<TenkoRecord> = { ...form };

    if (type === 'checkin') {
      updateData.checkin_status = 'approved';
      updateData.checkin_tenko_id = user.id;
      updateData.checkin_tenko_name = user.name;
      // Prevent saving checkout timestamp during initial checkin approval
      delete updateData.checkout_timestamp;
      delete updateData.alcohol_checkout;
      
    } else if (type === 'checkout') {
      updateData.checkout_status = 'approved';
      updateData.checkout_tenko_id = user.id;
      updateData.checkout_tenko_name = user.name;
      
      // If forcing checkout (driver didn't send data), use the selected time as the driver's time too
      // This allows "Back-dating" or manual time entry by Tenko
      if (!record.checkout_real_timestamp) {
          updateData.checkout_real_timestamp = form.checkout_timestamp;
      }
    }

    try {
        await StorageService.update({ ...record, ...updateData });
        onSuccess();
    } catch(e) {
        alert('เกิดข้อผิดพลาด');
    } finally {
        setSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
      if(confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?\n\nการลบจะทำให้ข้อมูลหายไป และพนักงานขับรถสามารถส่งรายการเข้ามาใหม่ได้')) {
          setSubmitting(true);
          try {
              const res = await StorageService.delete(record.__backendId);
              if (res.isOk) {
                  onSuccess();
              } else {
                  alert('ไม่สามารถลบข้อมูลที่ Server ได้ (อาจเกิดจากปัญหาการเชื่อมต่อ)\nกรุณาลองใหม่อีกครั้ง');
              }
          } catch (e) {
              alert('ล้มเหลวในการลบข้อมูล');
          } finally {
              setSubmitting(false);
          }
      }
  }

  const formatDateForInput = (isoString?: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const tzOffset = date.getTimezoneOffset() * 60000; 
      const localDate = new Date(date.getTime() - tzOffset);
      return localDate.toISOString().slice(0, 16);
  };

  const handleDateChange = (val: string, field: 'checkin_timestamp' | 'checkout_timestamp') => {
      if (!val) return;
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
          updateForm(field, date.toISOString());
      }
  };

  const renderDriverDataSection = () => (
    <Card className="h-fit overflow-y-auto max-h-[85vh]">
        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex justify-between items-center sticky top-0 bg-white z-10">
            <span className="flex items-center gap-2"><i className="fas fa-user-circle text-blue-600"></i> ข้อมูลพนักงาน</span>
            <div className="text-right">
                <div className="text-sm font-bold">{record.driver_name}</div>
                <div className="text-xs text-slate-400">ID: {record.driver_id}</div>
            </div>
        </h3>
        
        <div className="space-y-4 text-sm pr-1">
            {/* Context Info */}
            <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">เวลาเลิกงานล่าสุด:</span>
                    <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border shadow-sm">{lastCheckout}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Fix Start Time:</span>
                    <Badge type={fixStartStatus.includes('OK') || fixStartStatus.includes('First') ? 'approved' : 'danger'}>{fixStartStatus}</Badge>
                </div>
            </div>

            {/* 1. Health & Condition (Pre-work) */}
            <div className="border rounded-lg p-3 relative pt-4 mt-2">
                <div className="absolute -top-3 left-2 bg-white px-2 text-xs font-bold text-slate-500 border rounded-full">1. สุขภาพ & ร่างกาย (ก่อนงาน)</div>
                <div className="grid grid-cols-2 gap-x-4 mt-1">
                    <InfoRow label="เหนื่อยล้า" value={record.tired} detail={record.tired_detail} alert={record.tired === 'มี'} />
                    <InfoRow label="เจ็บป่วย" value={record.sick} detail={record.sick === 'มี' ? `(หาหมอ: ${record.seen_doctor}) ${record.sick_detail || ''}` : ''} alert={record.sick === 'มี'} />
                    <InfoRow label="ง่วงนอน" value={record.drowsy} detail={record.drowsy_detail} alert={record.drowsy === 'มี'} />
                    <InfoRow label="บาดเจ็บ" value={record.injury} detail={record.injury_detail} alert={record.injury === 'มี'} />
                    <InfoRow label="ทานยา" value={record.medication} detail={record.medication_name} alert={record.medication === 'ทาน'} />
                    <InfoRow label="สภาพร่างกาย" value={record.body_condition} detail={record.body_condition_detail} alert={record.body_condition === 'ไม่ปกติ'} />
                </div>
            </div>

            {/* 2. Sleep */}
            <div className="border rounded-lg p-3 relative bg-blue-50/30 border-blue-100 pt-4 mt-3">
                <div className="absolute -top-3 left-2 bg-white px-2 text-xs font-bold text-blue-500 border border-blue-100 rounded-full">2. การพักผ่อน</div>
                <div className="space-y-2 mt-1">
                     <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">นอนปกติ:</span>
                        <span className="font-bold">{record.sleep_start} - {record.sleep_end}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">รวมชั่วโมง:</span>
                        <span className={`font-bold ${(record.sleep_hours || 0) < 6 ? 'text-red-600' : 'text-green-600'}`}>{record.sleep_hours} ชม. ({record.sleep_quality})</span>
                     </div>
                     {record.extra_sleep === 'นอนเพิ่ม' && (
                         <div className="mt-2 pt-2 border-t border-blue-100">
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">นอนเพิ่ม:</span>
                                <span className="font-bold text-slate-700">{record.extra_sleep_start} - {record.extra_sleep_end}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">รวมเพิ่ม:</span>
                                <span className={`font-bold ${(record.extra_sleep_hours || 0) < 4.5 ? 'text-red-500' : 'text-green-600'}`}>{record.extra_sleep_hours} ชม. ({record.extra_sleep_quality})</span>
                             </div>
                         </div>
                     )}
                </div>
            </div>

            {/* 3. Environment & Senses */}
            <div className="border rounded-lg p-3 relative pt-4 mt-3">
                <div className="absolute -top-3 left-2 bg-white px-2 text-xs font-bold text-slate-500 border rounded-full">3. สภาพแวดล้อม & ประสาทสัมผัส</div>
                <div className="grid grid-cols-2 gap-x-4 mt-1">
                    <InfoRow label="เรื่องกังวล" value={record.worry_detail} detail={record.worry_text} alert={record.worry_detail === 'มี'} />
                    <InfoRow label="สถานที่พัก" value={record.rest_location} detail={record.rest_location_detail} />
                    <InfoRow label="สายตา" value={record.vision_problem} detail={record.vision_detail} alert={record.vision_problem === 'มี'} />
                    <InfoRow label="แว่นตา" value={record.glasses} detail={record.glasses_detail} />
                    <InfoRow label="การได้ยิน" value={record.hearing_problem} detail={record.hearing_detail} alert={record.hearing_problem === 'มี'} />
                    <InfoRow label="เครื่องช่วย" value={record.hearing_aid} detail={record.hearing_aid_detail} />
                </div>
            </div>

            {/* 4. Post-work (Only if relevant) */}
            {(type === 'checkout' || type === 'view' || record.checkout_status) && (
                 <div className="border rounded-lg p-3 relative bg-purple-50/30 border-purple-100 mt-4 pt-4">
                    <div className="absolute -top-3 left-2 bg-white px-2 text-xs font-bold text-purple-600 border border-purple-100 rounded-full">4. รายงานหลังเลิกงาน</div>
                    
                    {!record.checkout_real_timestamp && type === 'checkout' ? (
                        <div className="space-y-4 bg-white p-3 rounded-lg border border-purple-200 mt-2">
                            <p className="text-xs text-amber-600 font-bold mb-2 flex items-center gap-1"><i className="fas fa-info-circle"></i> พนักงานไม่ได้ส่งข้อมูลมา เจ้าหน้าที่สามารถกรอกแทนได้</p>
                            
                            <div>
                                <label className="block text-xs font-bold mb-1">4.1 การส่งมอบรถสินค้า</label>
                                <div className="flex gap-2 mb-2">
                                    <OptionButton selected={form.vehicle_handover === 'ปกติ'} onClick={() => updateForm('vehicle_handover', 'ปกติ')}>ปกติ</OptionButton>
                                    <OptionButton selected={form.vehicle_handover === 'ไม่ปกติ'} onClick={() => updateForm('vehicle_handover', 'ไม่ปกติ')}>ไม่ปกติ</OptionButton>
                                </div>
                                {form.vehicle_handover === 'ไม่ปกติ' && <Input placeholder="ระบุรายละเอียด" value={form.vehicle_detail} onChange={e => updateForm('vehicle_detail', e.target.value)} />}
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1">4.2 สภาพร่างกายหลังงาน</label>
                                <div className="flex gap-2 mb-2">
                                    <OptionButton selected={form.body_condition_checkout === 'ปกติ'} onClick={() => updateForm('body_condition_checkout', 'ปกติ')}>ปกติ</OptionButton>
                                    <OptionButton selected={form.body_condition_checkout === 'ไม่ปกติ'} onClick={() => updateForm('body_condition_checkout', 'ไม่ปกติ')}>ไม่ปกติ</OptionButton>
                                </div>
                                {form.body_condition_checkout === 'ไม่ปกติ' && <Input placeholder="ระบุรายละเอียด" value={form.body_detail_checkout} onChange={e => updateForm('body_detail_checkout', e.target.value)} />}
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1">4.3 จุดเสี่ยงในเส้นทางและมาตรฐานSOP</label>
                                <div className="flex gap-2 mb-2">
                                    <OptionButton selected={form.route_risk === 'ปกติ'} onClick={() => updateForm('route_risk', 'ปกติ')}>ปกติ</OptionButton>
                                    <OptionButton selected={form.route_risk === 'พบจุดเสี่ยง'} onClick={() => updateForm('route_risk', 'พบจุดเสี่ยง')}>พบจุดเสี่ยง</OptionButton>
                                </div>
                                {form.route_risk === 'พบจุดเสี่ยง' && <Input placeholder="ระบุรายละเอียด" value={form.route_detail} onChange={e => updateForm('route_detail', e.target.value)} />}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 mt-1">
                             <InfoRow label="ส่งมอบรถ" value={record.vehicle_handover} detail={record.vehicle_detail} alert={record.vehicle_handover === 'ไม่ปกติ'} />
                             <InfoRow label="ร่างกาย(หลัง)" value={record.body_condition_checkout} detail={record.body_detail_checkout} alert={record.body_condition_checkout === 'ไม่ปกติ'} />
                             <InfoRow label="จุดเสี่ยงและมาตรฐานSOP" value={record.route_risk} detail={record.route_detail} alert={record.route_risk === 'พบจุดเสี่ยง'} />
                        </div>
                    )}
                </div>
            )}
        </div>
    </Card>
  );

  const renderTenkoInputSection = () => (
    <Card className="h-fit border-l-4 border-blue-500">
        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
            <i className="fas fa-user-shield"></i> ส่วนบันทึกของ Tenko
        </h3>
        
        {(type === 'checkin' || type === 'view') && (
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-3"><i className="fas fa-stethoscope"></i> ข้อมูลสัญญาณชีพ (กรอกต่อเนื่อง)</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <Input 
                                label="1. อุณหภูมิ (°C)" 
                                type="number" step="0.1"
                                placeholder="36.5"
                                autoFocus
                                value={form.temperature || ''} 
                                onChange={e => updateForm('temperature', parseFloat(e.target.value))}
                                className={isTempBad(form.temperature) ? 'border-red-500 bg-red-50 text-red-700' : ''} 
                            />
                            <Input 
                                label="3. ความดันตัวบน (Sys)" 
                                type="number" 
                                placeholder="120"
                                value={form.blood_pressure_high || ''} 
                                onChange={e => updateForm('blood_pressure_high', parseFloat(e.target.value))} 
                                className={isBPHighBad(form.blood_pressure_high) ? 'border-red-500 bg-red-50' : ''} 
                            />
                        </div>
                        <div className="space-y-4">
                            <Input 
                                label="2. แอลกอฮอล์ (mg%)" 
                                type="number" 
                                placeholder="0"
                                value={form.alcohol_checkin} 
                                onChange={e => updateForm('alcohol_checkin', parseFloat(e.target.value))}
                                className={isAlcoholBad(form.alcohol_checkin) ? 'border-red-500 bg-red-50 text-red-700' : ''} 
                            />
                            <Input 
                                label="4. ความดันตัวล่าง (Dia)" 
                                type="number" 
                                placeholder="80"
                                value={form.blood_pressure_low || ''} 
                                onChange={e => updateForm('blood_pressure_low', parseFloat(e.target.value))} 
                                className={isBPLowBad(form.blood_pressure_low) ? 'border-red-500 bg-red-50' : ''} 
                            />
                        </div>
                    </div>
                    {isAlcoholBad(form.alcohol_checkin) && (
                         <Input className="mt-3" placeholder="ระบุเหตุผลค่าแอลกอฮอล์" value={form.alcohol_checkin_reason || ''} onChange={e => updateForm('alcohol_checkin_reason', e.target.value)} />
                    )}
                </div>

                <div className="p-3 border rounded-lg bg-slate-50">
                    <label className="font-bold block mb-2 text-sm text-slate-700">การใช้โทรศัพท์</label>
                    <div className="flex gap-2">
                        <OptionButton selected={form.phone_usage_compliant === 'ตรงตามที่แจ้ง'} onClick={() => updateForm('phone_usage_compliant', 'ตรงตามที่แจ้ง')}>ตรงตามที่แจ้ง</OptionButton>
                        <OptionButton selected={form.phone_usage_compliant === 'ไม่ตรงตามที่แจ้ง'} onClick={() => updateForm('phone_usage_compliant', 'ไม่ตรงตามที่แจ้ง')}>ไม่ตรงตามที่แจ้ง</OptionButton>
                    </div>
                    {form.phone_usage_compliant === 'ไม่ตรงตามที่แจ้ง' && (
                        <div className="space-y-2 mt-2">
                             <Input placeholder="ระบุสาเหตุ" value={form.phone_usage_reason || ''} onChange={e => updateForm('phone_usage_reason', e.target.value)} />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                    <label className="font-bold text-slate-700">อนุญาตให้ปฏิบัติงาน?</label>
                    <div className="flex gap-2">
                        <OptionButton selected={form.can_work === 'ได้'} onClick={() => updateForm('can_work', 'ได้')}>ได้</OptionButton>
                        <OptionButton selected={form.can_work === 'ไม่ได้'} onClick={() => updateForm('can_work', 'ไม่ได้')}>ไม่ได้</OptionButton>
                    </div>
                </div>
                {form.can_work === 'ไม่ได้' && (
                        <Input placeholder="ระบุสาเหตุที่ไม่อนุญาต" value={form.cannot_work_reason || ''} onChange={e => updateForm('cannot_work_reason', e.target.value)} />
                )}
            </div>
        )}

        {(type === 'checkout' || type === 'view') && (
            <div className="space-y-4 mt-6 border-t pt-4">
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <h4 className="font-bold text-purple-800 mb-3">ตรวจสอบหลังเลิกงาน</h4>
                    <div className="grid grid-cols-2 gap-4">
                         <Input 
                            label="แอลกอฮอล์ (ต้อง 0)" 
                            type="number" 
                            autoFocus
                            value={form.alcohol_checkout} 
                            onChange={e => updateForm('alcohol_checkout', parseFloat(e.target.value))}
                            className={isAlcoholBad(form.alcohol_checkout) ? 'border-red-500 bg-red-50 text-red-700' : ''} 
                         />
                         {isAlcoholBad(form.alcohol_checkout) && (
                             <Input label="เหตุผล" placeholder="ระบุเหตุผล" value={form.alcohol_checkout_reason || ''} onChange={e => updateForm('alcohol_checkout_reason', e.target.value)} />
                         )}
                    </div>
                     
                     <div className="mt-4">
                        <label className="block text-sm font-semibold mb-2">ข้อละเมิดการขับขี่?</label>
                        <div className="flex gap-2">
                            <OptionButton selected={form.driving_violation === 'ไม่มี'} onClick={() => updateForm('driving_violation', 'ไม่มี')}>ไม่มี</OptionButton>
                            <OptionButton selected={form.driving_violation === 'มี'} onClick={() => updateForm('driving_violation', 'มี')}>มี</OptionButton>
                        </div>
                        {form.driving_violation === 'มี' && <Input className="mt-2" placeholder="ระบุรายละเอียด" value={form.violation_detail || ''} onChange={e => updateForm('violation_detail', e.target.value)} />}
                    </div>
                </div>
            </div>
        )}

        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-4 space-y-3">
            <div>
                <label className="block text-sm font-bold mb-1 text-yellow-800">
                    <i className="fas fa-clock"></i> เวลาเข้างาน (Check-in)
                </label>
                <input 
                    type="datetime-local" 
                    className="w-full p-2 border rounded bg-white text-sm"
                    value={formatDateForInput(form.checkin_timestamp)}
                    onChange={e => handleDateChange(e.target.value, 'checkin_timestamp')}
                />
            </div>

            {(type === 'checkout' || type === 'view' || record.checkout_status) && (
                 <div className="pt-2 border-t border-yellow-200">
                    <label className="block text-sm font-bold mb-1 text-yellow-800">
                        <i className="fas fa-clock"></i> เวลาเลิกงาน (Check-out)
                    </label>
                    <input 
                        type="datetime-local" 
                        className="w-full p-2 border rounded bg-white text-sm"
                        value={formatDateForInput(form.checkout_timestamp)}
                        onChange={e => handleDateChange(e.target.value, 'checkout_timestamp')}
                    />
                </div>
            )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
            <Button onClick={handleApprove} isLoading={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 py-3 text-lg">
                <i className="fas fa-save"></i> บันทึกข้อมูล (Save)
            </Button>
            
            <Button onClick={handleDelete} isLoading={submitting} variant="danger" className="w-full bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-500">
                <i className="fas fa-trash-alt"></i> ลบข้อมูล (เพื่อให้ส่งใหม่)
            </Button>
        </div>
    </Card>
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10 flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">
          {type === 'checkin' ? 'คิวตรวจสอบ (ก่อนงาน)' : type === 'checkout' ? 'คิวตรวจสอบ (หลังงาน)' : 'แก้ไขข้อมูล'}
        </h2>
        <Button variant="secondary" onClick={onBack}>ย้อนกลับ</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {renderDriverDataSection()}
        {renderTenkoInputSection()}
      </div>
    </div>
  );
};
