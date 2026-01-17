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
          
          // Use the definitive status from StorageService which tracks DB interactions
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
    const interval = setInterval(fetchData, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = records.find(r => r.driver_id === user.id && r.date === today);

  const getLatestCheckoutTime = () => {
    const driverRecords = records
      .filter(r => r.driver_id === user.id && r.checkout_timestamp)
      .sort((a, b) => new Date(b.checkout_timestamp!).getTime() - new Date(a.checkout_timestamp!).getTime());
    
    return driverRecords.length > 0 ? new Date(driverRecords[0].checkout_timestamp!) : null;
  };

  const checkFixStartTime = () => {
    const driverRecords = records
      .filter(r => r.driver_id === user.id && r.checkin_timestamp && r.checkin_status === 'approved')
      .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    if (driverRecords.length === 0) return 'OK';

    const mondayRecords = driverRecords.filter(r => new Date(r.checkin_timestamp!).getDay() === 1);
    if (mondayRecords.length === 0) return 'OK';

    const firstMonday = new Date(mondayRecords[0].checkin_timestamp!);
    const firstMondayTime = firstMonday.getHours() * 60 + firstMonday.getMinutes();

    for (let record of driverRecords) {
      const checkDate = new Date(record.checkin_timestamp!);
      const checkTime = checkDate.getHours() * 60 + checkDate.getMinutes();
      const diff = Math.abs(checkTime - firstMondayTime);
      if (diff > 120) return 'NG';
    }
    return 'OK';
  };

  const canStartCheckin = () => {
     // Rule: 8 hours after last checkout
     const latestCheckout = getLatestCheckoutTime();
     if (!latestCheckout) return { allowed: true };
     
     const diffHours = (new Date().getTime() - latestCheckout.getTime()) / (1000 * 60 * 60);
     if (diffHours < 8) {
         return { 
             allowed: false, 
             message: `ต้องรอพักผ่อนให้ครบ 8 ชั่วโมง (อีก ${(8 - diffHours).toFixed(1)} ชม.)` 
         };
     }
     
     if (todayRecord) {
         if (todayRecord.checkin_status === 'approved' && todayRecord.checkout_status === 'approved') {
             return { allowed: true, message: "เริ่มรอบใหม่ได้" };
         }
         return { allowed: false, message: "คุณทำรายการวันนี้ไปแล้ว" };
     }
     
     return { allowed: true };
  };

  const checkinStatus = canStartCheckin();
  const fixStartTime = checkFixStartTime();

  const handleDataUpdate = () => {
      setIsLoading(true);
      fetchData().then(() => {
          setView('home');
          setIsLoading(false);
      });
  };

  const renderConnectionBadge = () => {
      if (connectionStatus === 'error') {
          return (
              <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                  <i className="fas fa-database"></i> DB Error
              </div>
          );
      }
      if (connectionStatus === 'offline' || pendingCount > 0) {
          return (
              <div className="flex items-center gap-2 bg-amber-400 text-black px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-sm">
                  <i className="fas fa-wifi-slash"></i> Offline ({pendingCount})
              </div>
          );
      }
      return (
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold">
              <i className="fas fa-wifi"></i> Online
          </div>
      );
  };

  if (view === 'checkin') return <CheckinForm user={user} onBack={() => setView('home')} onSubmitSuccess={handleDataUpdate} />;
  if (view === 'checkout') return <CheckoutForm user={user} record={todayRecord!} onBack={() => setView('home')} onSubmitSuccess={handleDataUpdate} />;
  if (view === 'history') return <DriverHistory user={user} records={records} onBack={() => setView('home')} fixStartTime={fixStartTime} />;

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 md:p-6 shadow-lg shrink-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <i className="fas fa-user-circle"></i> {user.name}
            </h1>
            <div className="flex items-center gap-2 text-sm opacity-80 mt-1">
                <span>รหัส: {user.id}</span>
                <span className="hidden md:inline">|</span>
                <Badge type={fixStartTime === 'OK' ? 'approved' : 'danger'}>FixTime: {fixStartTime}</Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
              <Button variant="secondary" size="sm" onClick={onLogout} className="border-white text-white hover:bg-white/20 hover:text-white px-3 py-1">
                <i className="fas fa-sign-out-alt"></i> ออก
              </Button>
              {renderConnectionBadge()}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 w-full flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center">
                <i className="fas fa-circle-notch fa-spin text-blue-500 text-3xl"></i>
                <p className="mt-2 text-slate-500">กำลังโหลดข้อมูล...</p>
            </div>
        ) : (
            <div className="space-y-4 md:space-y-6">
                {/* Status Messages */}
                {todayRecord && todayRecord.checkin_status !== 'approved' && todayRecord.checkin_status !== null && (
                    <Card className="bg-amber-50 border-amber-200 py-3 px-4 shrink-0">
                        <div className="flex items-center gap-3 text-amber-800">
                            <i className="fas fa-clock text-xl"></i>
                            <div>
                                <h3 className="font-bold text-sm md:text-base">รอตรวจสอบเท็งโกะ</h3>
                                <p className="text-xs opacity-80">กรุณารอเจ้าหน้าที่ตรวจสอบ</p>
                            </div>
                        </div>
                    </Card>
                )}

                {todayRecord && todayRecord.checkin_status === 'approved' && todayRecord.checkout_status === null && (
                    <Card className="bg-emerald-50 border-emerald-200 py-3 px-4 shrink-0">
                        <div className="flex items-center gap-3 text-emerald-800">
                            <i className="fas fa-check-circle text-xl"></i>
                            <div>
                                <h3 className="font-bold text-sm md:text-base">พร้อมปฏิบัติงาน</h3>
                                <p className="text-xs opacity-80">อย่าลืมทำรายการหลังเลิกงาน</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Main Menu Grid - Responsive for Portrait/Landscape Mobile & Tablet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 auto-rows-fr">
                    <Card 
                        onClick={() => {
                            if (checkinStatus.allowed) setView('checkin');
                            else alert(checkinStatus.message);
                        }} 
                        className={`flex flex-col items-center justify-center p-6 md:p-10 hover:border-blue-300 relative overflow-hidden group transition-all min-h-[160px] ${!checkinStatus.allowed ? 'opacity-60 grayscale' : ''}`}
                    >
                        <div className="absolute top-0 right-0 p-2 md:p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <i className="fas fa-clipboard-check text-8xl text-blue-500"></i>
                        </div>
                        <div className="relative z-10 text-center">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 mx-auto text-2xl md:text-3xl shadow-sm">
                                <i className="fas fa-clipboard-check"></i>
                            </div>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800">เท็งโกะก่อนเริ่มงาน</h3>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">ตรวจสอบสุขภาพก่อนขับขี่</p>
                            {!checkinStatus.allowed && <p className="text-red-500 text-[10px] md:text-xs mt-1 font-bold">{checkinStatus.message}</p>}
                        </div>
                    </Card>

                    <Card 
                        onClick={() => {
                            if (todayRecord && todayRecord.checkin_status === 'approved' && !todayRecord.checkout_status) setView('checkout');
                            else if (!todayRecord) alert('กรุณาทำเท็งโกะก่อนเริ่มงานก่อน');
                            else if (todayRecord.checkout_status) alert('ทำรายการเสร็จสิ้นแล้วสำหรับรอบนี้');
                            else alert('รอการอนุมัติเท็งโกะก่อนเริ่มงาน');
                        }}
                        className={`flex flex-col items-center justify-center p-6 md:p-10 hover:border-emerald-300 relative overflow-hidden group transition-all min-h-[160px] ${!todayRecord || todayRecord.checkin_status !== 'approved' || todayRecord.checkout_status ? 'opacity-60 grayscale' : ''}`}
                    >
                        <div className="absolute top-0 right-0 p-2 md:p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <i className="fas fa-flag-checkered text-8xl text-emerald-500"></i>
                        </div>
                        <div className="relative z-10 text-center">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 mx-auto text-2xl md:text-3xl shadow-sm">
                                <i className="fas fa-flag-checkered"></i>
                            </div>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800">เท็งโกะหลังเลิกงาน</h3>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">รายงานผลหลังปฏิบัติงาน</p>
                        </div>
                    </Card>

                    <Card 
                        onClick={() => setView('history')}
                        className="flex flex-col items-center justify-center p-6 md:p-10 hover:border-purple-300 relative overflow-hidden group transition-all min-h-[160px]"
                    >
                        <div className="absolute top-0 right-0 p-2 md:p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <i className="fas fa-history text-8xl text-purple-500"></i>
                        </div>
                        <div className="relative z-10 text-center">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3 mx-auto text-2xl md:text-3xl shadow-sm">
                                <i className="fas fa-history"></i>
                            </div>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800">ประวัติการทำงาน</h3>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">ตรวจสอบสถิติย้อนหลัง</p>
                        </div>
                    </Card>
                </div>
            </div>
        )}
      </main>

      <footer className="p-3 text-center text-slate-400 text-[10px] md:text-xs font-mono shrink-0 bg-slate-50 border-t border-slate-200">
        {SYSTEM_VERSION}
      </footer>
    </div>
  );
};