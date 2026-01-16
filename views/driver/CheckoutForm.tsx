import React, { useState } from 'react';
import { User, TenkoRecord } from '../../types';
import { Button, Card, OptionButton, Input } from '../../components/UI';
import { StorageService } from '../../services/storage';

interface Props {
  user: User;
  record: TenkoRecord;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export const CheckoutForm: React.FC<Props> = ({ record, onBack, onSubmitSuccess }) => {
  const [form, setForm] = useState<Partial<TenkoRecord>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (key: keyof TenkoRecord, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.vehicle_handover || !form.body_condition_checkout || !form.route_risk) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      StorageService.update({
        ...record,
        ...form,
        checkout_timestamp: new Date().toISOString(),
        checkout_status: 'pending'
      });
      setSubmitting(false);
      onSubmitSuccess();
    }, 800);
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="bg-white sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">เท็งโกะหลังเลิกงาน</h2>
        <Button variant="secondary" onClick={onBack}>ย้อนกลับ</Button>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6 pb-24">
        <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <i className="fas fa-truck text-blue-500"></i> การส่งมอบรถสินค้า
            </h3>
            <div className="flex gap-3 mb-3">
                <OptionButton selected={form.vehicle_handover === 'ปกติ'} onClick={() => updateForm('vehicle_handover', 'ปกติ')}>ปกติ</OptionButton>
                <OptionButton selected={form.vehicle_handover === 'ไม่ปกติ'} onClick={() => updateForm('vehicle_handover', 'ไม่ปกติ')}>ไม่ปกติ</OptionButton>
            </div>
            {form.vehicle_handover === 'ไม่ปกติ' && (
                <Input 
                  placeholder="ระบุรายละเอียดความผิดปกติ" 
                  value={form.vehicle_detail || ''}
                  onChange={e => updateForm('vehicle_detail', e.target.value)}
                />
            )}
        </Card>

        <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <i className="fas fa-heartbeat text-red-500"></i> สภาพร่างกาย
            </h3>
            <div className="flex gap-3 mb-3">
                <OptionButton selected={form.body_condition_checkout === 'ปกติ'} onClick={() => updateForm('body_condition_checkout', 'ปกติ')}>ปกติ</OptionButton>
                <OptionButton selected={form.body_condition_checkout === 'ไม่ปกติ'} onClick={() => updateForm('body_condition_checkout', 'ไม่ปกติ')}>ไม่ปกติ</OptionButton>
            </div>
            {form.body_condition_checkout === 'ไม่ปกติ' && (
                <Input 
                  placeholder="ระบุอาการ" 
                  value={form.body_detail_checkout || ''}
                  onChange={e => updateForm('body_detail_checkout', e.target.value)}
                />
            )}
        </Card>

        <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <i className="fas fa-route text-orange-500"></i> จุดเสี่ยงระหว่างเส้นทาง
            </h3>
            <div className="flex gap-3 mb-3">
                <OptionButton selected={form.route_risk === 'ปกติ'} onClick={() => updateForm('route_risk', 'ปกติ')}>ปกติ</OptionButton>
                <OptionButton selected={form.route_risk === 'พบจุดเสี่ยง'} onClick={() => updateForm('route_risk', 'พบจุดเสี่ยง')}>พบจุดเสี่ยง</OptionButton>
            </div>
            {form.route_risk === 'พบจุดเสี่ยง' && (
                <Input 
                  placeholder="ระบุจุดเสี่ยงและรายละเอียด" 
                  value={form.route_detail || ''}
                  onChange={e => updateForm('route_detail', e.target.value)}
                />
            )}
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-20">
            <Button onClick={handleSubmit} isLoading={submitting} className="w-full max-w-md py-3 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                <i className="fas fa-check-double"></i> ส่งรายงาน
            </Button>
        </div>
      </div>
    </div>
  );
};