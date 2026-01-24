
import React from 'react';
import { User, TenkoRecord } from '../../types';
import { Button, Card, Badge } from '../../components/UI';

interface Props {
  user: User;
  records: TenkoRecord[];
  onBack: () => void;
  fixStartTime: string;
  displayTime: string;
}

export const DriverHistory: React.FC<Props> = ({ user, records, onBack, fixStartTime, displayTime }) => {
  const myRecords = records
    .filter(r => r.driver_id === user.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentMonth = new Date();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  // ป้องกันปัญหา Timezone โดยการสร้าง Date จาก string YYYY-MM-DD โดยตรง
  const parseSafeDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const getDayStatus = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = myRecords.find(r => r.date === dateStr);
    
    if (!record) return 'none';
    if (record.checkin_status === 'approved' && record.checkout_status === 'approved') return 'complete';
    if (record.checkin_status === 'approved') return 'working';
    return 'pending';
  };

  const getStatusBadge = (r: TenkoRecord) => {
      if (r.checkin_status === 'approved' && r.checkout_status === 'approved') return <Badge type="approved">เสร็จสมบูรณ์</Badge>;
      if (r.checkin_status === 'approved') return <Badge type="pending">กำลังปฏิบัติงาน</Badge>;
      return <Badge type="danger">รอตรวจสอบ</Badge>;
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto pb-10">
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
                 <p className="text-3xl font-bold text-blue-600">{myRecords.filter(r => parseSafeDate(r.date).getMonth() === currentMonth.getMonth()).length}</p>
                 <p className="text-xs text-slate-400">รายการ</p>
             </Card>
             <Card className="bg-white border-l-4 border-purple-500">
                 <p className="text-sm text-slate-500">ทั้งหมด</p>
                 <p className="text-3xl font-bold text-purple-600">{myRecords.length}</p>
                 <p className="text-xs text-slate-400">รายการ</p>
             </Card>
             <Card className={`bg-white border-l-4 ${fixStartTime === 'NG' ? 'border-red-500' : 'border-emerald-500'}`}>
                 <p className="text-sm text-slate-500">Fix Start Time สัปดาห์นี้</p>
                 <p className={`text-3xl font-bold ${fixStartTime === 'NG' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fixStartTime === 'Ref' ? 'Baseline' : `"${fixStartTime}"`}
                 </p>
                 <div className="flex justify-between items-center mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Ref Time: {displayTime}</p>
                 </div>
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
                            h-10 flex items-center justify-center rounded-lg text-sm font-medium border
                            ${status === 'complete' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                              status === 'working' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                              'bg-slate-50 text-slate-300 border-slate-100'}
                        `}>
                            {i+1}
                        </div>
                    );
                })}
            </div>
        </Card>

        <div className="space-y-4">
            <h3 className="font-bold text-slate-700">รายการล่าสุด (10 รายการ)</h3>
            {myRecords.slice(0, 10).map(record => (
                <Card key={record.__backendId} className="hover:bg-slate-50 transition-colors border border-slate-100">
                    <div className="flex justify-between items-start mb-3 border-b pb-2">
                        <div>
                            <p className="font-bold text-slate-800">
                                {parseSafeDate(record.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                            </p>
                            <p className="text-[10px] text-slate-400">Record ID: {record.__backendId.substring(0, 8)}</p>
                        </div>
                        {getStatusBadge(record)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <p className="font-bold text-blue-800 text-xs mb-1 uppercase tracking-wider">ก่อนเริ่มงาน (Check-in)</p>
                            <div className="space-y-1">
                                <p className="flex justify-between"><span>เวลาอนุมัติ:</span> <span className="font-bold">{record.checkin_timestamp ? new Date(record.checkin_timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '-'} น.</span></p>
                                <p className="flex justify-between"><span>ผู้ตรวจ:</span> <span className="text-slate-600">{record.checkin_tenko_name || '-'}</span></p>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg border ${record.checkout_status === 'approved' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                            <p className="font-bold text-emerald-800 text-xs mb-1 uppercase tracking-wider">หลังเลิกงาน (Check-out)</p>
                            <div className="space-y-1">
                                <p className="flex justify-between items-center">
                                    <span>วัน/เวลาเลิกงาน:</span> 
                                    <span className="font-bold text-right">
                                        {record.checkout_timestamp 
                                            ? new Date(record.checkout_timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                                            : '-'}
                                    </span>
                                </p>
                                <p className="flex justify-between"><span>ผู้ตรวจ:</span> <span className="text-slate-600">{record.checkout_tenko_name || '-'}</span></p>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      </div>
    </div>
  );
};
