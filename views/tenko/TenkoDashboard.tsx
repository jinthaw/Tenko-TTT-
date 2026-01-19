import React, { useMemo } from 'react';
import { TenkoRecord } from '../../types';
import { Card, Badge, Button } from '../../components/UI';
import * as XLSX from 'xlsx';

interface Props {
  view: string;
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const TenkoDashboard: React.FC<Props> = ({ view, records, onSelectRecord, onDelete }) => {
  const pendingCheckin = records.filter(r => r.checkin_status === 'pending');
  const activeDrivers = records.filter(r => r.checkin_status === 'approved' && !r.checkout_status);
  const pendingCheckout = records.filter(r => r.checkout_status === 'pending');
  const completed = records.filter(r => r.checkin_status === 'approved' && r.checkout_status === 'approved');
  const today = new Date().toISOString().split('T')[0];

  // Helper: Get Monday of the week
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  // Centralized Logic for Fix Start Time calculation
  const getFixStartInfo = (targetRecord: TenkoRecord) => {
    const driverApproved = records
      .filter(r => r.driver_id === targetRecord.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
      .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const targetDate = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp || targetRecord.date;
    const targetMonday = getMonday(targetDate);
    
    const weekRecords = driverApproved.filter(r => getMonday(r.checkin_timestamp!) === targetMonday);
    
    const mondayRecord = weekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    const referenceRecord = mondayRecord || weekRecords[0];

    if (!referenceRecord) return { status: 'New', time: '--:--' };

    const refDate = new Date(referenceRecord.checkin_timestamp!);
    const refMinutes = refDate.getHours() * 60 + refDate.getMinutes();
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    const checkTimeStr = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp;
    if (!checkTimeStr) return { status: 'OK', time: displayTime };

    const checkDate = new Date(checkTimeStr);
    const checkMinutes = checkDate.getHours() * 60 + checkDate.getMinutes();
    // Fix: Using refMinutes instead of the undefined refTotalMinutes
    const isNG = Math.abs(checkMinutes - refMinutes) > 120;

    return { status: isNG ? 'NG' : 'OK', time: displayTime };
  };
  
  // Added for calculation inside loop where refTotalMinutes might be missing context
  const calculateResult = (targetTime: string, refMinutes: number) => {
      const d = new Date(targetTime);
      const m = d.getHours() * 60 + d.getMinutes();
      return Math.abs(m - refMinutes) > 120 ? 'NG' : 'OK';
  };

  // Pre-calculate Stats for the Month
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthApproved = records.filter(r => {
      if (!r.checkin_timestamp || r.checkin_status !== 'approved') return false;
      const d = new Date(r.checkin_timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const ngDrivers = new Set();
    let totalNGCount = 0;

    monthApproved.forEach(r => {
      const info = getFixStartInfo(r);
      if (info.status === 'NG') {
        totalNGCount++;
        ngDrivers.add(r.driver_id);
      }
    });

    return { totalNGCount, uniqueNGDrivers: ngDrivers.size };
  }, [records]);

  const getSafeTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '-'; }
  };

  const getFixStartBadge = (record: TenkoRecord) => {
    // Only care about checking records that have a check-in time
    const timeToCheck = record.checkin_timestamp || record.checkin_real_timestamp;
    if (!timeToCheck) return null;

    // We need to fetch the weekly reference for this driver
    const driverApproved = records
      .filter(r => r.driver_id === record.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
      .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const targetMonday = getMonday(timeToCheck);
    const weekRecords = driverApproved.filter(r => getMonday(r.checkin_timestamp!) === targetMonday);
    const mondayRecord = weekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    const referenceRecord = mondayRecord || weekRecords[0];

    if (!referenceRecord) return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">First Entry</span>;

    const refDate = new Date(referenceRecord.checkin_timestamp!);
    const refMinutes = refDate.getHours() * 60 + refDate.getMinutes();
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const result = calculateResult(timeToCheck, refMinutes);

    return (
      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
        result === 'NG' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'
      }`}>
        {result === 'NG' ? 'NG' : 'OK'} (Ref: {displayTime})
      </span>
    );
  };

  const renderStats = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
      <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none shadow-amber-200">
        <h3 className="text-amber-100 mb-1 text-sm">รอตรวจก่อนงาน</h3>
        <div className="text-3xl font-bold">{pendingCheckin.length}</div>
      </Card>
      <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-none shadow-blue-200">
        <h3 className="text-blue-100 mb-1 text-sm">กำลังปฏิบัติงาน</h3>
        <div className="text-3xl font-bold">{activeDrivers.length}</div>
      </Card>
      <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-none shadow-purple-200">
        <h3 className="text-purple-100 mb-1 text-sm">รอตรวจหลังงาน</h3>
        <div className="text-3xl font-bold">{pendingCheckout.length}</div>
      </Card>
      <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none shadow-emerald-200">
        <h3 className="text-emerald-100 mb-1 text-sm">เสร็จสิ้นแล้ว</h3>
        <div className="text-3xl font-bold">{completed.length}</div>
      </Card>
      <Card className={`${stats.totalNGCount > 0 ? 'bg-red-600 shadow-red-200' : 'bg-blue-900 shadow-blue-900/20'} text-white border-none`}>
        <h3 className="text-white/80 mb-1 text-sm">NG Fix Start</h3>
        <div className="text-3xl font-bold">{stats.totalNGCount} <span className="text-xs font-normal opacity-70">ครั้ง</span></div>
        <p className="text-[10px] mt-1 text-white/60">พนักงาน {stats.uniqueNGDrivers} ท่าน (เดือนนี้)</p>
      </Card>
      <Card className="bg-white border-l-4 border-blue-500">
        <h3 className="text-slate-500 mb-1 text-sm">รายการวันนี้</h3>
        <div className="text-3xl font-bold text-slate-800">{records.filter(r => r.date === today).length}</div>
      </Card>
    </div>
  );

  const renderQueueList = (title: string, icon: string, items: TenkoRecord[], color: string) => (
    <Card className={`flex flex-col h-full bg-white border-t-4 border-${color}-500 shadow-lg`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-bold text-${color}-700 text-lg flex items-center gap-2`}>
          <i className={`fas ${icon}`}></i> {title}
        </h3>
        <span className={`bg-${color}-100 text-${color}-800 text-xs px-2.5 py-1 rounded-full font-bold`}>{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {items.map(r => (
          <div key={r.__backendId} onClick={() => onSelectRecord(r.__backendId)} className="flex justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100 transition-all hover:border-blue-200 group">
            <div>
              <p className="font-semibold text-slate-700 flex items-center flex-wrap gap-1">
                {r.driver_name}
                {title.includes('ก่อนงาน') && getFixStartBadge(r)}
              </p>
              <p className="text-[10px] text-slate-400">ID: {r.driver_id} • {new Date(r.date).toLocaleDateString('th-TH')}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <p className="text-sm font-bold text-slate-600">{getSafeTime(title.includes('หลังงาน') ? r.checkout_timestamp || r.checkout_real_timestamp : r.checkin_timestamp || r.checkin_real_timestamp)}</p>
              <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
            <i className="fas fa-check-circle text-4xl mb-2"></i>
            <p className="text-sm">ไม่มีรายการค้าง</p>
          </div>
        )}
      </div>
    </Card>
  );

  if (view === 'dashboard') {
    return (
      <div className="pb-10 animate-fade-in">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <i className="fas fa-tachometer-alt text-blue-600"></i> แผงควบคุมเจ้าหน้าที่
        </h1>
        {renderStats()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
          {renderQueueList('รอตรวจก่อนเริ่มงาน', 'fa-clock', pendingCheckin, 'amber')}
          {renderQueueList('พนักงานกำลังปฏิบัติงาน', 'fa-truck-moving', activeDrivers, 'blue')}
          {renderQueueList('รอตรวจหลังเลิกงาน', 'fa-flag-checkered', pendingCheckout, 'purple')}
        </div>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .animate-fade-in { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  return null;
};