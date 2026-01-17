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
    hearing_aid: 'ไม่มี'
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastCheckout, setLastCheckout] = useState<string | null>(null);

  useEffect(() => {
    // Find last checkout time (Async)
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

  const updateForm = (key: keyof TenkoRecord, value: any) => {
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

    setSubmitting(true);
    try {
        await StorageService.create({
            driver_id: user.id,
            driver_name: user.name,
            date: new Date().toISOString().split('T')[0],
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
    field: keyof TenkoRecord, 
    detailField?: keyof TenkoRecord, 
    triggerValue: string = 'มี',
    choices: string[] = ['มี', 'ไม่มี']
  ) => (
    <div className="mb-4 last:mb-0">
      <label className="block text-slate-700 font-medium mb-2">{label}</label>
      <div className="flex gap-2 mb-2 flex-wrap">
        {choices.map(opt => (
          <OptionButton 
            key={opt}
            selected={form[field] === opt} 
            onClick={() => updateForm(field, opt)}
          >
            {opt}
          </OptionButton>
        ))}
      </div>
      {form[field] === triggerValue && detailField && (
        <Input 
          placeholder="ระบุรายละเอียด" 
          value={(form[detailField] as string) || ''}
          onChange={e => updateForm(detailField, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="bg-white sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-slate-800">เท็งโกะก่อนเริ่มงาน</h2>
        </div>
        <Button variant="secondary" onClick={onBack} size="sm">ย้อนกลับ</Button>
      </div>

      <div className="max-w-3xl mx-auto p-6 pb-24">
        <Card className="mb-4 bg-slate-100 border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <i className="fas fa-clock text-slate-500"></i> เวลาเลิกงานล่าสุด
            </h3>
            <p className="text-2xl font-bold text-slate-800">{lastCheckout || 'ไม่มีประวัติ'}</p>
        </Card>

        {renderSection('อาการทั่วไป', 'fa-heartbeat', (
            <>
                {renderQuestion('1. มีอาการเหนื่อยล้า?', 'tired', 'tired_detail')}
                {renderQuestion('2. มีอาการเจ็บป่วย?', 'sick', 'sick_detail', 'มี')}
                {form.sick === 'มี' && (
                    <div className="pl-4 border-l-2 border-slate-200 mb-4 space-y-3">
                         {renderQuestion('ไปพบแพทย์หรือไม่?', 'seen_doctor', 'seen_doctor_detail', 'มี')}
                    </div>
                )}
                {renderQuestion('3. มีอาการง่วงนอน?', 'drowsy', 'drowsy_detail')}
                {renderQuestion('4. มีอาการบาดเจ็บ?', 'injury', 'injury_detail')}
                {renderQuestion('5. ทานยาที่ส่งผลต่อการขับขี่?', 'medication', 'medication_name', 'ทาน', ['ทาน', 'ไม่ทาน'])}
                {renderQuestion('6. สภาพร่างกาย?', 'body_condition', 'body_condition_detail', 'ไม่ปกติ', ['ปกติ', 'ไม่ปกติ'])}
            </>
        ))}

        {renderSection('การนอนหลับ', 'fa-bed', (
            <>
                <h4 className="font-bold text-slate-700 mb-2">7. การนอนปกติ</h4>
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
                
                <hr className="my-4"/>

                <h4 className="font-bold text-slate-700 mb-2">8. การนอนเพิ่ม</h4>
                {renderQuestion('มีการนอนเพิ่มหรือไม่?', 'extra_sleep', undefined, 'นอนเพิ่ม', ['นอนเพิ่ม', 'ไม่นอนเพิ่ม'])}
                
                {form.extra_sleep === 'นอนเพิ่ม' && (
                    <div className="bg-blue-50 p-4 rounded-lg">
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
            </>
        ))}

        {renderSection('สภาพแวดล้อมและประสาทสัมผัส', 'fa-eye', (
             <>
                {renderQuestion('เรื่องกังวลใจ?', 'worry_detail', 'worry_text')}
                {renderQuestion('สถานที่พักผ่อน?', 'rest_location', 'rest_location_detail', 'นอกบ้าน', ['บ้าน', 'นอกบ้าน'])}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        {renderQuestion('ปัญหาสายตา?', 'vision_problem', 'vision_detail')}
                        {renderQuestion('สวมแว่นตา?', 'glasses', 'glasses_detail')}
                    </div>
                    <div>
                        {renderQuestion('ปัญหาการได้ยิน?', 'hearing_problem', 'hearing_detail')}
                        {renderQuestion('เครื่องช่วยฟัง?', 'hearing_aid', 'hearing_aid_detail')}
                    </div>
                </div>
             </>
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