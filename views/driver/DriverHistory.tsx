import React from 'react';
import { User, TenkoRecord } from '../../types';
import { Button, Card, Badge } from '../../components/UI';

interface Props {
  user: User;
  records: TenkoRecord[];
  onBack: () => void;
  fixStartTime: string;
}

export const DriverHistory: React.FC<Props> = ({ user, records, onBack, fixStartTime }) => {
  const myRecords = records
    .filter(r => r.driver_id === user.id && r.checkin_status === 'approved' && r.checkout_status === 'approved')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentMonth = new Date();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const getDayStatus = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = myRecords.find(r => r.date === dateStr);
    if (record) return 'complete';
    if (dateStr === new Date().toISOString().split('T')[0]) return 'today';
    return 'none';
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="bg-purple-600 text-white px-6 py-6 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold">รายงานของฉัน</h2>
                <p className="opacity-80">ประวัติการปฏิบัติงานและการตรวจสอบ</p>
            </div>
            <Button onClick={onBack} variant="secondary" className="border-white text-white hover:bg-white/20">ย้อนกลับ</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card className="bg-white border-l-4 border-blue-500">
                 <p className="text-sm text-slate-500">เดือนนี้</p>
                 <p className="text-3xl font-bold text-blue-600">{myRecords.filter(r => new Date(r.date).getMonth() === currentMonth.getMonth()).length}</p>
                 <p className="text-xs text-slate-400">ครั้ง</p>
             </Card>
             <Card className="bg-white border-l-4 border-purple-500">
                 <p className="text-sm text-slate-500">ทั้งหมด</p>
                 <p className="text-3xl font-bold text-purple-600">{myRecords.length}</p>
                 <p className="text-xs text-slate-400">ครั้ง</p>
             </Card>
             <Card className={`bg-white border-l-4 ${fixStartTime === 'OK' ? 'border-emerald-500' : 'border-red-500'}`}>
                 <p className="text-sm text-slate-500">Fix Start Time</p>
                 <p className={`text-3xl font-bold ${fixStartTime === 'OK' ? 'text-emerald-600' : 'text-red-600'}`}>{fixStartTime}</p>
                 <p className="text-xs text-slate-400">{fixStartTime === 'OK' ? 'ปกติ' : 'ผิดปกติ'}</p>
             </Card>
        </div>

        <Card>
            <h3 className="font-bold mb-4 text-slate-700">ปฏิทิน {currentMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}</h3>
            <div className="grid grid-cols-7 gap-1">
                {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>)}
                {Array.from({length: firstDay}).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({length: daysInMonth}).map((_, i) => {
                    const status = getDayStatus(i+1);
                    return (
                        <div key={i} className={`
                            h-10 flex items-center justify-center rounded-lg text-sm font-medium
                            ${status === 'complete' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                              status === 'today' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400'}
                        `}>
                            {i+1}
                        </div>
                    );
                })}
            </div>
        </Card>

        <div className="space-y-4">
            <h3 className="font-bold text-slate-700">รายการล่าสุด</h3>
            {myRecords.slice(0, 10).map(record => (
                <Card key={record.__backendId} className="hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="font-bold text-slate-800">
                                {new Date(record.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                            </p>
                            <p className="text-xs text-slate-500">ID: {record.__backendId.substring(0, 8)}</p>
                        </div>
                        <Badge type="approved">สมบูรณ์</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-2 bg-blue-50 rounded">
                            <p className="font-semibold text-blue-800 mb-1">ก่อนเริ่มงาน</p>
                            <p>เวลา: {record.checkin_timestamp ? new Date(record.checkin_timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '-'}</p>
                            <p>ผู้ตรวจ: {record.checkin_tenko_name}</p>
                            <p>แอลกอฮอล์: {record.alcohol_checkin}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded">
                            <p className="font-semibold text-emerald-800 mb-1">หลังเลิกงาน</p>
                            <p>เวลา: {record.checkout_timestamp ? new Date(record.checkout_timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '-'}</p>
                            <p>ผู้ตรวจ: {record.checkout_tenko_name}</p>
                            <p>แอลกอฮอล์: {record.alcohol_checkout}</p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      </div>
    </div>
  );
};