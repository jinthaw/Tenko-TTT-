
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

  // Utility to get YYYY-MM-DD in local time
  const getTodayStr = () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const today = getTodayStr();
  
  // LOGIC IMPROVEMENT: 
  // Instead of strictly today's date, let's look for the most recent record.
  // If the record from "today" (local) exists, use it.
  // Otherwise, if there is a record within the last 12 hours that is NOT checked out, use it (for midnight shifts).
  const myRecords = records
    .filter(r => r.driver_id === user.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  const activeRecord = myRecords[0]; // The very latest record

  // Check if activeRecord belongs to "today" or is still "open"
  const isCurrentSession = activeRecord && (
      activeRecord.date === today || 
      (!activeRecord.checkout_status && (new Date().getTime() - new Date(activeRecord.checkin_real_timestamp || activeRecord.date).getTime()) < 24 * 60 * 60 * 1000)
  );

  const currentRecord = isCurrentSession ? activeRecord : null;

  const getLatestCheckoutTime = () => {
    const closedRecords = myRecords
      .filter(r => r.checkout_timestamp)
      .sort((a, b) => new Date(b.checkout_timestamp!).getTime() - new Date(a.checkout_timestamp!).getTime());
    return closedRecords.length > 0 ? new Date(closedRecords[0].checkout_timestamp!) : null;
  };

  const checkFixStartTime = () => {
    const approvedRecords = myRecords
        .filter(r => r.checkin_timestamp && r.checkin_status === 'approved')
        .sort((a, b) => new Date(b.checkin_timestamp!).getTime() - new Date(a.checkin_timestamp!).getTime());

    if (approvedRecords.length === 0) return { status: 'OK', time: '--:--' };

    const getMonday = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    };

    const weeks: Record<string, TenkoRecord[]> = {};
    approvedRecords.forEach(record => {
        const mondayStr = getMonday(record.checkin_timestamp!);
        if (!weeks[mondayStr]) weeks[mondayStr] = [];
        weeks[mondayStr].push(record);
    });

    const latestMonday = Object.keys(weeks).sort().reverse()[0];
    const currentWeekRecords = weeks[latestMonday];

    const mondayRecord = currentWeekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    const referenceRecord = mondayRecord || currentWeekRecords[currentWeekRecords.length - 1];
    
    const refDate = new Date(referenceRecord.checkin_timestamp!);
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const refTotalMinutes = refDate.getHours() * 60 + refDate.getMinutes();

    let status = 'OK';
    for (let record of currentWeekRecords) {
        const checkDate = new Date(record.checkin_timestamp!);
        const checkTime = checkDate.getHours() * 60 + checkDate.getMinutes();
        if (Math.abs(checkTime - refTotalMinutes) > 120) {
            status = 'NG';
            break;
        }
    }

    return { status, time: displayTime };
  };

  const canStartCheckin = () => {
     const latestCheckout = getLatestCheckoutTime();
     if (!latestCheckout) return { allowed: true };
     const diffHours = (new Date().getTime() - latestCheckout.getTime()) / (1000 * 60 * 60);
     if (diffHours < 8) {
         return { 
             allowed: false, 
             message: `ต้องพักผ่อนให้ครบ 8 ชม. (อีก ${(8 - diffHours).toFixed(1)} ชม.)` 
         };
     }
     
     if (currentRecord) {
         if (currentRecord.checkin_status === 'approved' && currentRecord.checkout_status === 'approved') {
             return { allowed: true, message: "เริ่มรอบใหม่ได้" };
         }
         return { allowed: false, message: "คุณมีรายการที่ยังทำไม่จบในวันนี้" };
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

  const renderConnectionBadge = () => {
      if (connectionStatus === 'error') return <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm"><i className="fas fa-database"></i> DB Error</div>;
      if (connectionStatus === 'offline' || pendingCount > 0) return <div className="flex items-center gap-2 bg-amber-400 text-black px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-sm"><i className="fas fa-wifi-slash"></i> Offline ({pendingCount})</div>;
      return <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold"><i className="fas fa-wifi"></i> Online</div>;
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
                <div className="hidden md:flex flex-col items-start gap-1">
                    <Badge type={fixData.status === 'OK' ? 'approved' : 'danger'}>
                        Fix Start Time: {fixData.status}
                    </Badge>
                </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={fetchData} className="text-white hover:bg-white/10 px-2 h-8" isLoading={isLoading}>
                    <i className="fas fa-sync-alt"></i>
                </Button>
                <Button variant="secondary" size="sm" onClick={onLogout} className="border-white text-white hover:bg-white/20 hover:text-white px-3 h-8">
                    <i className="fas fa-sign-out-alt"></i> ออก
                </Button>
              </div>
              {renderConnectionBadge()}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 w-full flex-1 overflow-y-auto min-h-0">
        {isLoading && records.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
                <i className="fas fa-circle-notch fa-spin text-blue-500 text-3xl"></i>
                <p className="mt-2 text-slate-500">กำลังดึงข้อมูลล่าสุด...</p>
            </div>
        ) : (
            <div className="space-y-4 md:space-y-6">
                {currentRecord && currentRecord.checkin_status === 'pending' && (
                    <Card className="bg-amber-50 border-amber-200 py-4 px-6 border-l-4 border-l-amber-500 shadow-sm animate-pulse">
                        <div className="flex items-center gap-4 text-amber-800">
                            <i className="fas fa-hourglass-half text-2xl"></i>
                            <div>
                                <h3 className="font-bold">รอเจ้าหน้าที่ Tenko ตรวจสอบ (In)</h3>
                                <p className="text-sm opacity-90">กรุณาแสดงหน้าจอนี้ให้เจ้าหน้าที่ตรวจสัญญาณชีพ</p>
                            </div>
                        </div>
                    </Card>
                )}

                {currentRecord && currentRecord.checkin_status === 'approved' && currentRecord.checkout_status === 'pending' && (
                    <Card className="bg-purple-50 border-purple-200 py-4 px-6 border-l-4 border-l-purple-500 shadow-sm animate-pulse">
                        <div className="flex items-center gap-4 text-purple-800">
                            <i className="fas fa-hourglass-half text-2xl"></i>
                            <div>
                                <h3 className="font-bold">รอเจ้าหน้าที่ Tenko ตรวจสอบ (Out)</h3>
                                <p className="text-sm opacity-90">กรุณาแจ้งเจ้าหน้าที่เพื่อทำการตรวจแอลกอฮอล์ขาออก</p>
                            </div>
                        </div>
                    </Card>
                )}

                {currentRecord && currentRecord.checkin_status === 'approved' && !currentRecord.checkout_status && (
                    <Card className="bg-emerald-50 border-emerald-200 py-4 px-6 border-l-4 border-l-emerald-500 shadow-sm">
                        <div className="flex items-center gap-4 text-emerald-800">
                            <i className="fas fa-check-circle text-2xl"></i>
                            <div>
                                <h3 className="font-bold">พร้อมปฏิบัติงาน</h3>
                                <p className="text-sm opacity-90">เริ่มงานเมื่อ: {new Date(currentRecord.checkin_timestamp!).toLocaleTimeString('th-TH')}</p>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 auto-rows-fr">
                    <Card 
                        onClick={() => {
                            if (checkinStatus.allowed) setView('checkin');
                            else alert(checkinStatus.message);
                        }} 
                        className={`flex flex-col items-center justify-center p-6 md:p-8 hover:border-blue-400 relative overflow-hidden group transition-all min-h-[160px] shadow-sm ${!checkinStatus.allowed ? 'opacity-60 grayscale' : 'border-blue-100'}`}
                    >
                        <div className="relative z-10 text-center">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl shadow-inner group-hover:scale-110 transition-transform">
                                <i className="fas fa-clipboard-check"></i>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">ก่อนเริ่มงาน</h3>
                            <p className="text-slate-500 text-xs mt-1">Check-in</p>
                            {!checkinStatus.allowed && <p className="text-red-500 text-[10px] mt-2 font-bold px-2 py-1 bg-red-50 rounded">{checkinStatus.message}</p>}
                        </div>
                    </Card>

                    <Card 
                        onClick={() => {
                            if (currentRecord && currentRecord.checkin_status === 'approved' && !currentRecord.checkout_status) setView('checkout');
                            else if (!currentRecord) alert('กรุณาทำรายการ "ก่อนเริ่มงาน" ก่อน');
                            else if (currentRecord.checkout_status) alert('คุณทำรายการหลังเลิกงานไปแล้ว');
                            else alert('รอเจ้าหน้าที่อนุมัติรายการก่อนเริ่มงานก่อนครับ');
                        }}
                        className={`flex flex-col items-center justify-center p-6 md:p-8 hover:border-emerald-400 relative overflow-hidden group transition-all min-h-[160px] shadow-sm ${!currentRecord || currentRecord.checkin_status !== 'approved' || currentRecord.checkout_status ? 'opacity-60 grayscale' : 'border-emerald-100'}`}
                    >
                        <div className="relative z-10 text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl shadow-inner group-hover:scale-110 transition-transform">
                                <i className="fas fa-flag-checkered"></i>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">หลังเลิกงาน</h3>
                            <p className="text-slate-500 text-xs mt-1">Check-out</p>
                        </div>
                    </Card>

                    <Card 
                        onClick={() => setView('history')}
                        className="flex flex-col items-center justify-center p-6 md:p-8 hover:border-purple-400 relative overflow-hidden group transition-all min-h-[160px] shadow-sm border-purple-50"
                    >
                        <div className="relative z-10 text-center">
                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl shadow-inner group-hover:scale-110 transition-transform">
                                <i className="fas fa-history"></i>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">ประวัติงาน</h3>
                            <p className="text-slate-500 text-xs mt-1">สถิติย้อนหลัง</p>
                        </div>
                    </Card>
                </div>

                <div className="mt-8 text-center bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500">ข้อมูลอ้างอิง Fix Start Time สัปดาห์นี้</p>
                    <p className="text-xl font-bold text-blue-600">{fixData.time}</p>
                </div>
            </div>
        )}
      </main>

      <footer className="p-3 text-center text-slate-400 text-[10px] md:text-xs font-mono shrink-0 bg-white border-t border-slate-100">
        {SYSTEM_VERSION}
      </footer>
      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
