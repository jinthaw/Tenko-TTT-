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
    
    checkin_timestamp: record.checkin_timestamp || new Date().toISOString(),
    checkout_timestamp: record.checkout_timestamp || new Date().toISOString()
  });

  const [fixStartStatus, setFixStartStatus] = useState<string>('N/A');
  const [lastCheckout, setLastCheckout] = useState<string>('-');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
        const allRecords = await StorageService.getAll();
        
        // --- ส่วนที่ 1: หาวันเลิกงานล่าสุด ---
        const previousRecords = allRecords
            .filter(r => r.driver_id === record.driver_id && r.checkout_timestamp && r.__backendId !== record.__backendId)
            .sort((a, b) => new Date(b.checkout_timestamp!).getTime() - new Date(a.checkout_timestamp!).getTime());
        if (previousRecords.length > 0) {
            setLastCheckout(new Date(previousRecords[0].checkout_timestamp!).toLocaleString('th-TH'));
        }

        // --- ส่วนที่ 2: Logic Fix Start Time ใหม่ (นับตามสัปดาห์) ---
        const driverRecords = allRecords
            .filter(r => r.driver_id === record.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
            .sort((a, b) => new Date(b.checkin_timestamp!).getTime() - new Date(a.checkin_timestamp!).getTime());

        if (driverRecords.length === 0) {
            setFixStartStatus('OK (First Record)');
            return;
        }

        // ฟังก์ชันหา "วันจันทร์" ของสัปดาห์นั้นๆ
        const getMonday = (dateStr: string) => {
            const d = new Date(dateStr);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff)).toISOString().split('T')[0];
        };

        // ตรวจสอบข้อมูลของ "สัปดาห์ปัจจุบัน" (สัปดาห์ของรายการที่กำลังตรวจอยู่)
        const currentRecordMonday = getMonday(form.checkin_timestamp!);
        const currentWeekRecords = driverRecords.filter(r => getMonday(r.checkin_timestamp!) === currentRecordMonday);

        // หาเวลาอ้างอิงของสัปดาห์นี้ (วันจันทร์ หรือ วันแรกที่มาทำงาน)
        const mondayRecord = currentWeekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
        const referenceRecord = mondayRecord || (currentWeekRecords.length > 0 ? currentWeekRecords[currentWeekRecords.length - 1] : null);

        if (!referenceRecord) {
            // ถ้าเป็นสัปดาห์ใหม่เอี่ยมและยังไม่มีประวัติที่ approved เลย ให้ถือว่า OK
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

        // ตรวจสอบรายการที่กำลังเปิดดูอยู่ (form.checkin_timestamp) เทียบกับค่าอ้างอิง
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
    const updateData: Partial<TenkoRecord> = { ...form };

    if (type === 'checkin') {
      updateData.checkin_status = 'approved';
      updateData.checkin_tenko_id = user.id;
      updateData.checkin_tenko_name = user.name;
    } else if (type === 'checkout') {
      updateData.checkout_status = 'approved';
      updateData.checkout_tenko_id = user.id;
      updateData.checkout_tenko_name = user.name;
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
          await StorageService.delete(record.__backendId);
          onSuccess();
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
    <Card className="h-fit">
        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex justify-between">
            <span><i className="fas fa-user-circle"></i> ข้อมูลพนักงาน</span>
            <span className="text-sm font-normal text-slate-500">{record.driver_name} ({record.driver_id})</span>
        </h3>
        
        <div className="space-y-4 text-sm pr-2">
            <div className="bg-slate-50 p-3 rounded border space-y-2">
                <p><strong>เลิกงานล่าสุด:</strong> {lastCheckout}</p>
                <p><strong>Fix Start Time:</strong> <Badge type={fixStartStatus.includes('OK') ? 'approved' : 'danger'}>{fixStartStatus}</Badge></p>
                
                <div className="border-t border-slate-200 pt-2 mt-2">
                    <p className="flex justify-between items-center">
                        <span className="font-bold text-blue-700">เข้างาน:</span>
                        <span>{record.checkin_timestamp ? new Date(record.checkin_timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
                    </p>
                    {(type === 'checkout' || type === 'view') && (
                        <p className="flex justify-between items-center mt-1">
                            <span className="font-bold text-purple-700">เลิกงาน:</span>
                            <span>{record.checkout_timestamp ? new Date(record.checkout_timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <p><strong>เหนื่อยล้า:</strong> {record.tired} {record.tired_detail && `(${record.tired_detail})`}</p>
                <p><strong>เจ็บป่วย:</strong> {record.sick} {record.sick === 'มี' && `(หาหมอ: ${record.seen_doctor})`}</p>
                <p><strong>ง่วงนอน:</strong> {record.drowsy}</p>
                <p><strong>บาดเจ็บ:</strong> {record.injury}</p>
                <p><strong>ยา:</strong> {record.medication} {record.medication_name}</p>
                <p><strong>สายตา/การได้ยิน:</strong> {record.vision_problem}/{record.hearing_problem}</p>
            </div>

            <div className="p-3 bg-blue-50 rounded border border-blue-100">
                <h4 className="font-bold mb-1">การนอน</h4>
                <p>ปกติ: {record.sleep_start} - {record.sleep_end} ({record.sleep_hours} ชม.) - <span className={record.sleep_hours! < 6 ? 'text-red-600 font-bold' : 'text-green-600'}>{record.sleep_quality}</span></p>
                {record.extra_sleep === 'นอนเพิ่ม' && (
                    <p>เพิ่ม: {record.extra_sleep_start} - {record.extra_sleep_end} ({record.extra_sleep_hours} ชม.) - <span className={record.extra_sleep_hours! < 4.5 ? 'text-red-600 font-bold' : 'text-green-600'}>{record.extra_sleep_quality}</span></p>
                )}
            </div>

            {(type === 'checkout' || type === 'view') && (
                <div className="p-3 bg-purple-50 rounded border border-purple-100 mt-2">
                    <h4 className="font-bold text-purple-800 mb-2 border-b border-purple-200 pb-1 flex items-center gap-2">
                        <i className="fas fa-clipboard-list"></i> รายงานหลังเลิกงาน
                    </h4>
                    <div className="space-y-3">
                        <div className="flex flex-col">
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-700">การส่งมอบรถ:</span>
                                <span className={record.vehicle_handover === 'ปกติ' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                    {record.vehicle_handover || '-'}
                                </span>
                            </div>
                            {record.vehicle_detail && <div className="text-slate-600 text-xs mt-1 bg-white p-2 rounded border border-purple-100"><i className="fas fa-exclamation-circle text-red-400"></i> {record.vehicle_detail}</div>}
                        </div>
                        
                        <div className="flex flex-col">
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-700">สภาพร่างกาย:</span>
                                <span className={record.body_condition_checkout === 'ปกติ' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                    {record.body_condition_checkout || '-'}
                                </span>
                            </div>
                            {record.body_detail_checkout && <div className="text-slate-600 text-xs mt-1 bg-white p-2 rounded border border-purple-100"><i className="fas fa-exclamation-circle text-red-400"></i> {record.body_detail_checkout}</div>}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-700">จุดเสี่ยง:</span>
                                <span className={record.route_risk === 'ปกติ' ? 'text-green-600 font-bold' : 'text-orange-600 font-bold'}>
                                    {record.route_risk || '-'}
                                </span>
                            </div>
                            {record.route_detail && <div className="text-slate-600 text-xs mt-1 bg-white p-2 rounded border border-purple-100"><i className="fas fa-map-marker-alt text-orange-400"></i> {record.route_detail}</div>}
                        </div>
                    </div>
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

        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-4">
            <label className="block text-sm font-bold mb-1 text-yellow-800">
                <i className="fas fa-clock"></i> เวลาที่บันทึก
            </label>
            <input 
                type="datetime-local" 
                className="w-full p-2 border rounded bg-white text-sm"
                value={formatDateForInput(type === 'checkout' ? form.checkout_timestamp : form.checkin_timestamp)}
                onChange={e => handleDateChange(e.target.value, type === 'checkout' ? 'checkout_timestamp' : 'checkin_timestamp')}
            />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderDriverDataSection()}
        {renderTenkoInputSection()}
      </div>
    </div>
  );
};