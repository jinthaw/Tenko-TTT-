
import React, { useState, useEffect } from 'react';
import { User, TenkoRecord } from '../../types';
import { Card, Button, Badge } from '../../components/UI';
import { StorageService } from '../../services/storage';
import { CheckinForm } from './CheckinForm';
import { CheckoutForm } from './CheckoutForm';
import { DriverHistory } from './DriverHistory';
import { SYSTEM_VERSION } from '../../constants';

interface DriverAppProps {
  user: User;
  onLogout: () => void;
}

export const DriverApp: React.FC<DriverAppProps> = ({ user, onLogout }) => {
  const [view, setView] = useState<'home' | 'checkin' | 'checkout' | 'history'>('home');
  const [records, setRecords] = useState<TenkoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'error'>('online');

  const fetchData = async () => {
      try {
          await StorageService.syncPendingData();
          const data = await StorageService.getAll();
          setRecords(data);
          setPendingCount(StorageService.getPendingCount());
          setConnectionStatus(StorageService.getConnectionStatus());
      } catch(e) {
          console.error(e);
          setConnectionStatus('offline');
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getTodayStr = () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const today = getTodayStr();
  const myRecords = records
    .filter(r => r.driver_id === user.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  const activeRecord = myRecords[0]; 
  const isCurrentSession = activeRecord && (
      activeRecord.date === today || 
      (!activeRecord.checkout_status && (new Date().getTime() - new Date(activeRecord.checkin_real_timestamp || activeRecord.date).getTime()) < 24 * 60 * 60 * 1000)
  );

  const currentRecord = isCurrentSession ? activeRecord : null;

  const checkFixStartTime = () => {
    // Look for all records of the week (including pending/current) to find the baseline
    const getMonday = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    };

    const thisWeekMonday = getMonday(today);
    const thisWeekRecords = myRecords.filter(r => getMonday(r.date) === thisWeekMonday);
    
    // Reference is the earliest approved record, OR if none, the earliest record of the week
    const approvedThisWeek = thisWeekRecords
        .filter(r => r.checkin_status === 'approved')
        .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const referenceRecord = approvedThisWeek.length > 0 
        ? approvedThisWeek[0] 
        : (thisWeekRecords.length > 0 ? thisWeekRecords[thisWeekRecords.length - 1] : null);

    if (!referenceRecord) return { status: 'New', time: '--:--' };

    const refTimeSource = referenceRecord.checkin_timestamp || referenceRecord.checkin_real_timestamp;
    const refDate = new Date(refTimeSource!);
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // If we only have 1 record this week, it's the "Baseline" (Reference)
    if (thisWeekRecords.length === 1 && (!currentRecord || currentRecord.checkin_status !== 'approved')) {
        return { status: 'Ref', time: displayTime };
    }

    // Comparison logic
    if (currentRecord && currentRecord.checkin_timestamp) {
        const refTotalMinutes = refDate.getHours() * 60 + refDate.getMinutes();
        const checkDate = new Date(currentRecord.checkin_timestamp);
        const checkTime = checkDate.getHours() * 60 + checkDate.getMinutes();
        if (Math.abs(checkTime - refTotalMinutes) > 120) return { status: 'NG', time: displayTime };
    }

    return { status: 'OK', time: displayTime };
  };

  const canStartCheckin = () => {
     if (currentRecord) {
         if (currentRecord.checkin_status === 'approved' && currentRecord.checkout_status === 'approved') return { allowed: true };
         return { allowed: false, message: "คุณมีรายการที่ยังทำไม่จบ" };
     }
     return { allowed: true };
  };

  const checkinStatus = canStartCheckin();
  const fixData = checkFixStartTime();

  const handleDataUpdate = () => {
      setIsLoading(true);
      fetchData().then(() => {
          setView('home');
          setIsLoading(false);
      });
  };

  if (view === 'checkin') return <CheckinForm user={user} onBack={() => setView('home')} onSubmitSuccess={handleDataUpdate} />;
  if (view === 'checkout') return <CheckoutForm user={user} record={currentRecord!} onBack={() => setView('home')} onSubmitSuccess={handleDataUpdate} />;
  if (view === 'history') return <DriverHistory user={user} records={records} onBack={() => setView('home')} fixStartTime={fixData.status} displayTime={fixData.time} />;

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden animate-fade-in">
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 md:p-6 shadow-lg shrink-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <i className="fas fa-user-circle"></i> {user.name}
            </h1>
            <div className="flex items-center gap-3 text-sm opacity-80 mt-1">
                <span>รหัส: {user.id}</span>
                <Badge type={fixData.status === 'OK' || fixData.status === 'Ref' ? 'approved' : 'danger'}>
                    Fix Start: {fixData.status === 'Ref' ? 'Baseline' : fixData.status}
                </Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
              <Button variant="secondary" size="sm" onClick={onLogout} className="border-white text-white hover:bg-white/20 px-3 h-8">
                  <i className="fas fa-sign-out-alt"></i> ออก
              </Button>
              <div className="text-[10px] font-bold opacity-60">{connectionStatus === 'online' ? '● Online' : '○ Offline'}</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 w-full flex-1 overflow-y-auto">
        <div className="space-y-4 md:space-y-6">
            {currentRecord && currentRecord.checkin_status === 'pending' && (
                <Card className="bg-amber-50 border-amber-500 py-4 px-6 border-l-4 shadow-sm animate-pulse">
                    <div className="flex items-center gap-4 text-amber-800">
                        <i className="fas fa-hourglass-half text-2xl"></i>
                        <div>
                            <h3 className="font-bold">ส่งข้อมูลแล้ว รอเจ้าหน้าที่ตรวจสอบ</h3>
                            <p className="text-sm opacity-90">กรุณาแจ้งชื่อพนักงานให้เจ้าหน้าที่ Tenko ทราบ</p>
                        </div>
                    </div>
                </Card>
            )}

            {currentRecord && currentRecord.checkin_status === 'approved' && !currentRecord.checkout_status && (
                <Card className="bg-emerald-50 border-emerald-600 py-5 px-6 border-l-4 shadow-md">
                    <div className="flex items-center gap-4 text-emerald-900">
                        <div className="bg-emerald-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h3 className="font-black text-lg">ตรวจผ่านแล้ว - เริ่มงานได้</h3>
                                <Badge type="approved">ACTIVE</Badge>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs font-bold text-emerald-800/70">
                                <p><i className="fas fa-clock mr-1.5"></i> ตรวจเมื่อ: {new Date(currentRecord.checkin_timestamp!).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</p>
                                <p><i className="fas fa-user-shield mr-1.5"></i> ผู้ตรวจ: {currentRecord.checkin_tenko_name || '-'}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card onClick={() => checkinStatus.allowed ? setView('checkin') : alert(checkinStatus.message)} className={`flex flex-col items-center justify-center p-6 hover:border-blue-400 transition-all ${!checkinStatus.allowed ? 'opacity-50 grayscale' : 'border-blue-100'}`}>
                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 text-2xl"><i className="fas fa-clipboard-check"></i></div>
                    <h3 className="font-bold text-slate-800">ก่อนเริ่มงาน</h3>
                    {!checkinStatus.allowed && <p className="text-red-500 text-[10px] mt-1 font-bold">{checkinStatus.message}</p>}
                </Card>

                <Card onClick={() => (currentRecord?.checkin_status === 'approved' && !currentRecord.checkout_status) ? setView('checkout') : alert('ยังไม่สามารถเลิกงานได้')} className={`flex flex-col items-center justify-center p-6 hover:border-emerald-400 transition-all ${(!currentRecord || currentRecord.checkin_status !== 'approved' || currentRecord.checkout_status) ? 'opacity-50 grayscale' : 'border-emerald-100'}`}>
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 text-2xl"><i className="fas fa-flag-checkered"></i></div>
                    <h3 className="font-bold text-slate-800">หลังเลิกงาน</h3>
                </Card>

                <Card onClick={() => setView('history')} className="flex flex-col items-center justify-center p-6 hover:border-purple-400 border-purple-50 transition-all">
                    <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3 text-2xl"><i className="fas fa-history"></i></div>
                    <h3 className="font-bold text-slate-800">รายงานของฉัน</h3>
                </Card>
            </div>

            <div className="mt-8 text-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500 mb-1">เวลาอ้างอิง Fix Start Time สัปดาห์นี้</p>
                <p className="text-3xl font-black text-blue-600 tracking-tight">{fixData.time}</p>
                <div className="flex justify-center gap-2 mt-2">
                    {fixData.status === 'Ref' ? (
                        <span className="text-[11px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                            <i className="fas fa-star mr-1"></i> เป็นวันแรก (ใช้เป็นเวลาอ้างอิง)
                        </span>
                    ) : (
                        <Badge type={fixData.status === 'OK' ? 'approved' : 'danger'}>สถานะ: {fixData.status}</Badge>
                    )}
                </div>
            </div>
        </div>
      </main>
      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
