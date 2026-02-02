
import React, { useState, useEffect } from 'react';
import { User, TenkoRecord } from '../../types';
import { Button, Card, OptionButton, Input } from '../../components/UI';
import { StorageService } from '../../services/storage';

interface Props {
  user: User;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export const CheckinForm: React.FC<Props> = ({ user, onBack, onSubmitSuccess }) => {
  const [form, setForm] = useState<Partial<TenkoRecord>>({
    tired: 'ไม่มี',
    sick: 'ไม่มี',
    drowsy: 'ไม่มี',
    injury: 'ไม่มี',
    medication: 'ไม่ทาน',
    body_condition: 'ปกติ',
    sleep_quality: 'หลับสนิท',
    extra_sleep: 'ไม่นอนเพิ่ม',
    worry_detail: 'ไม่มี',
    rest_location: 'บ้าน',
    vision_problem: 'ไม่มี',
    glasses: 'ไม่มี',
    hearing_problem: 'ไม่มี',
    hearing_aid: 'ไม่มี',
    seen_doctor: 'ไม่มี',
    sick_taking_med: 'ไม่ทาน'
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastCheckout, setLastCheckout] = useState<string | null>(null);

  useEffect(() => {
    const loadLastCheckout = async () => {
        const records = await StorageService.getAll();
        const myRecords = records
            .filter(r => r.driver_id === user.id && r.checkout_timestamp)
            .sort((a, b) => new Date(b.checkout_timestamp!).getTime() - new Date(a.checkout_timestamp!).getTime());
        
        if (myRecords.length > 0) {
            setLastCheckout(new Date(myRecords[0].checkout_timestamp!).toLocaleString('th-TH'));
        }
    };
    loadLastCheckout();
  }, [user.id]);

  const updateForm = (key: keyof TenkoRecord | string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const calculateHours = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    const s = new Date(`2000-01-01T${start}`);
    let e = new Date(`2000-01-01T${end}`);
    if (e < s) e.setDate(e.getDate() + 1);
    return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  };

  const handleSleepChange = (field: 'sleep' | 'extra_sleep', type: 'start' | 'end', val: string) => {
    if (field === 'sleep') {
        const start = type === 'start' ? val : form.sleep_start;
        const end = type === 'end' ? val : form.sleep_end;
        updateForm(type === 'start' ? 'sleep_start' : 'sleep_end', val);
        if (start && end) updateForm('sleep_hours', calculateHours(start, end));
    } else {
        const start = type === 'start' ? val : form.extra_sleep_start;
        const end = type === 'end' ? val : form.extra_sleep_end;
        updateForm(type === 'start' ? 'extra_sleep_start' : 'extra_sleep_end', val);
        if (start && end) updateForm('extra_sleep_hours', calculateHours(start, end));
    }
  };

  const handleSubmit = async () => {
    if (!form.sleep_hours) {
      alert('กรุณากรอกเวลาการนอนหลับ');
      return;
    }
    if (form.medication === 'ทาน' && !form.medication_name) {
      alert('กรุณาระบุชื่อยาที่มีผลต่อการขับขี่');
      return;
    }

    setSubmitting(true);
    try {
        await StorageService.create({
            driver_id: user.id,
            driver_name: user.name,
            // Date is omitted here to let StorageService use getLocalISODate()
            // which prevents UTC date shift issues for late night/early morning
            checkin_real_timestamp: new Date().toISOString(),
            checkin_status: 'pending',
            checkout_status: null,
            ...form
        });
        onSubmitSuccess();
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        setSubmitting(false);
    }
  };

  const renderSection = (title: string, icon: string, children: React.ReactNode) => (
    <Card className="mb-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-lg border-b pb-2">
            <i className={`fas ${icon} text-blue-500`}></i> {title}
        </h3>
        {children}
    </Card>
  );

  const renderQuestion = (
    label: string, 
    field: keyof TenkoRecord | string, 
    detailField?: keyof TenkoRecord | string, 
    triggerValue: string = 'มี',
    choices: string[] = ['มี', 'ไม่มี']
  ) => (
    <div className="mb-4 last:mb-0">
      <label className="block text-slate-700 font-medium mb-2">{label}</label>
      <div className="flex gap-2 mb-2 flex-wrap">
        {choices.map(opt => (
          <OptionButton 
            key={opt}
            selected={(form as any)[field] === opt} 
            onClick={() => updateForm(field, opt)}
          >
            {opt}
          </OptionButton>
        ))}
      </div>
      {(form as any)[field] === triggerValue && detailField && (
        <Input 
          placeholder="ระบุรายละเอียด" 
          value={((form as any)[detailField] as string) || ''}
          onChange={e => updateForm(detailField, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="bg-white sticky top-0 z-20 px-4 md:px-6 py-4 shadow-sm flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-slate-800">เท็งโกะก่อนเริ่มงาน</h2>
        </div>
        <Button variant="secondary" onClick={onBack} size="sm">ย้อนกลับ</Button>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        <Card className="mb-4 bg-slate-100 border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <i className="fas fa-clock text-slate-500"></i> เวลาเลิกงานล่าสุด
            </h3>
            <p className="text-2xl font-bold text-slate-800">{lastCheckout || 'ไม่มีประวัติ'}</p>
        </Card>

        {renderSection('อาการทั่วไป', 'fa-heartbeat', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {renderQuestion('1. มีอาการเหนื่อยล้า?', 'tired', 'tired_detail')}
                {renderQuestion('2. มีอาการง่วงนอน?', 'drowsy', 'drowsy_detail')}
                {renderQuestion('3. มีอาการบาดเจ็บ?', 'injury', 'injury_detail')}
                {renderQuestion('4. สภาพร่างกาย?', 'body_condition', 'body_condition_detail', 'ไม่ปกติ', ['ปกติ', 'ไม่ปกติ'])}
                <div className="md:col-span-2 mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    {renderQuestion('5. ทานยาที่มีผลต่อการขับขี่?', 'medication', 'medication_name', 'ทาน', ['ทาน', 'ไม่ทาน'])}
                </div>
            </div>
        ))}

        {renderSection('การนอนหลับ', 'fa-bed', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-8">
                <div>
                    <h4 className="font-bold text-slate-700 mb-2">6. การนอนปกติ</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Input type="time" label="เริ่มนอน" value={form.sleep_start || ''} onChange={e => handleSleepChange('sleep', 'start', e.target.value)} />
                        <Input type="time" label="ตื่น" value={form.sleep_end || ''} onChange={e => handleSleepChange('sleep', 'end', e.target.value)} />
                    </div>
                    <div className={`p-3 rounded-lg text-center font-bold text-lg mb-4 border-2 ${
                        (form.sleep_hours || 0) < 6 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
                    }`}>
                        รวม {form.sleep_hours?.toFixed(1) || 0} ชั่วโมง
                    </div>
                    {renderQuestion('คุณภาพการนอน', 'sleep_quality', 'sleep_quality_detail', 'ไม่สนิท', ['หลับสนิท', 'ไม่สนิท'])}
                </div>
                
                <div>
                    <hr className="md:hidden my-4"/>
                    <h4 className="font-bold text-slate-700 mb-2">7. การนอนเพิ่ม</h4>
                    {renderQuestion('มีการนอนเพิ่มหรือไม่?', 'extra_sleep', undefined, 'นอนเพิ่ม', ['นอนเพิ่ม', 'ไม่นอนเพิ่ม'])}
                    
                    {form.extra_sleep === 'นอนเพิ่ม' && (
                        <div className="bg-blue-50 p-4 rounded-lg mt-2">
                            <p className="text-sm text-blue-800 mb-2 font-bold"><i className="fas fa-info-circle"></i> การนอนเพิ่มควรมากกว่า 4.5 ชั่วโมง</p>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Input type="time" label="เริ่มนอนเพิ่ม" value={form.extra_sleep_start || ''} onChange={e => handleSleepChange('extra_sleep', 'start', e.target.value)} />
                                <Input type="time" label="ตื่นมาเพิ่ม" value={form.extra_sleep_end || ''} onChange={e => handleSleepChange('extra_sleep', 'end', e.target.value)} />
                            </div>
                            <div className={`p-3 rounded-lg text-center font-bold text-lg mb-4 border-2 ${
                                (form.extra_sleep_hours || 0) < 4.5 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
                            }`}>
                                รวม {form.extra_sleep_hours?.toFixed(1) || 0} ชั่วโมง
                            </div>
                            {renderQuestion('คุณภาพการนอนเพิ่ม', 'extra_sleep_quality', 'extra_sleep_quality_detail', 'ไม่สนิท', ['หลับสนิท', 'ไม่สนิท'])}
                        </div>
                    )}
                </div>
            </div>
        ))}

        {renderSection('อาการป่วย', 'fa-medkit', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-8">
                <div className={form.sick === 'มี' ? 'p-3 bg-red-50/50 rounded-lg border border-red-100' : ''}>
                    {renderQuestion('8. ชื่อโรค (ระบุหากมีอาการป่วย)', 'sick', 'sick_detail', 'มี')}
                </div>
                
                <div>
                    {renderQuestion('9. พบหมอ (ได้ไปพบแพทย์หรือไม่?)', 'seen_doctor')}
                </div>

                <div className="flex flex-col mb-4">
                    <label className="block text-slate-700 font-medium mb-2">10. ชื่อยา (ระบุยาที่แพทย์สั่ง)</label>
                    <Input 
                        placeholder="เช่น ยาแก้ไอ, ยาแก้แพ้"
                        value={form.seen_doctor_detail || ''}
                        onChange={e => updateForm('seen_doctor_detail', e.target.value)}
                    />
                </div>

                <div>
                    {renderQuestion('11. ทานยา (ทานยาตามที่แพทย์สั่งหรือไม่?)', 'sick_taking_med', undefined, 'ทาน', ['ทาน', 'ไม่ทาน'])}
                </div>
            </div>
        ))}

        {renderSection('สภาพแวดล้อมและประสาทสัมผัส', 'fa-eye', (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-8">
                {renderQuestion('เรื่องกังวลใจ?', 'worry_detail', 'worry_text')}
                {renderQuestion('สถานที่พักผ่อน?', 'rest_location', 'rest_location_detail', 'นอกบ้าน', ['บ้าน', 'นอกบ้าน'])}
                
                {renderQuestion('ปัญหาสายตา?', 'vision_problem', 'vision_detail')}
                {renderQuestion('สวมแว่นตา?', 'glasses', 'glasses_detail')}
                
                {renderQuestion('ปัญหาการได้ยิน?', 'hearing_problem', 'hearing_detail')}
                {renderQuestion('เครื่องช่วยฟัง?', 'hearing_aid', 'hearing_aid_detail')}
             </div>
        ))}
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-20">
            <Button onClick={handleSubmit} isLoading={submitting} className="w-full max-w-md py-3 text-lg">
                <i className="fas fa-paper-plane"></i> ส่งข้อมูลให้ Tenko
            </Button>
        </div>
      </div>
    </div>
  );
};
