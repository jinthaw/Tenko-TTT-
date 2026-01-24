
import React, { useMemo, useState } from 'react';
import { TenkoRecord } from '../../types';
import { Card, Badge, Button } from '../../components/UI';
import * as XLSX from 'xlsx';

interface Props {
  view: string;
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TenkoDashboard: React.FC<Props> = ({ view, records, onSelectRecord, onDelete }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'ng'>('all');
  const [showNGModal, setShowNGModal] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const calculateResult = (targetTime: string, refMinutes: number) => {
      const d = new Date(targetTime);
      const m = d.getHours() * 60 + d.getMinutes();
      return Math.abs(m - refMinutes) > 120 ? 'NG' : 'OK';
  };

  const getFixStartInfo = (targetRecord: TenkoRecord) => {
    const driverApproved = records
      .filter(r => r.driver_id === targetRecord.driver_id && r.checkin_timestamp && r.checkin_status === 'approved')
      .sort((a, b) => new Date(a.checkin_timestamp!).getTime() - new Date(b.checkin_timestamp!).getTime());

    const targetDate = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp || targetRecord.date;
    const targetMonday = getMonday(targetDate);
    
    const weekRecords = driverApproved.filter(r => getMonday(r.checkin_timestamp!) === targetMonday);
    const mondayRecord = weekRecords.find(r => new Date(r.checkin_timestamp!).getDay() === 1);
    const referenceRecord = mondayRecord || (weekRecords.length > 0 ? weekRecords[0] : null);

    if (!referenceRecord) return { status: 'Baseline', time: '--:--' };

    const refDate = new Date(referenceRecord.checkin_timestamp!);
    const refMinutes = refDate.getHours() * 60 + refDate.getMinutes();
    const displayTime = refDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

    // If target is the reference record itself
    if (targetRecord.__backendId === referenceRecord.__backendId) {
        return { status: 'Baseline', time: displayTime };
    }

    const checkTimeStr = targetRecord.checkin_timestamp || targetRecord.checkin_real_timestamp;
    if (!checkTimeStr) return { status: 'OK', time: displayTime };

    const result = calculateResult(checkTimeStr, refMinutes);
    return { status: result, time: displayTime };
  };

  const { pendingCheckin, activeDrivers, pendingCheckout, completed, ngRecordsToday } = useMemo(() => {
    const baseRecords = records;
    const todayRecords = records.filter(r => r.date === today);
    const ngToday = todayRecords.filter(r => getFixStartInfo(r).status === 'NG');

    let filtered = baseRecords;
    if (filterMode === 'ng') {
        filtered = baseRecords.filter(r => getFixStartInfo(r).status === 'NG');
    }

    return {
        pendingCheckin: filtered.filter(r => r.checkin_status === 'pending'),
        activeDrivers: filtered.filter(r => r.checkin_status === 'approved' && !r.checkout_status),
        pendingCheckout: filtered.filter(r => r.checkout_status === 'pending'),
        completed: baseRecords.filter(r => r.checkin_status === 'approved' && r.checkout_status === 'approved'),
        ngRecordsToday: ngToday
    };
  }, [records, filterMode, today]);

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
    const info = getFixStartInfo(record);
    if (info.status === 'Baseline') return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-500 border border-blue-200">Baseline</span>;

    return (
      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
        info.status === 'NG' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'
      }`}>
        {info.status} (Ref: {info.time})
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
      <Card 
        className={`${stats.totalNGCount > 0 ? 'bg-red-600 shadow-red-200' : 'bg-blue-900 shadow-blue-900/20'} text-white border-none cursor-pointer hover:scale-105 transition-transform`}
        onClick={() => setShowNGModal(true)}
      >
        <div className="flex justify-between items-start">
            <h3 className="text-white/80 mb-1 text-sm">NG Fix Start</h3>
            <i className="fas fa-list-ul text-xs opacity-50"></i>
        </div>
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
          <div key={r.__backendId} className="group relative flex items-center gap-2">
            <div 
                onClick={() => onSelectRecord(r.__backendId)} 
                className="flex-1 flex justify-between p-3 bg-white hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100 transition-all hover:border-blue-200"
            >
                <div>
                  <p className="font-semibold text-slate-700 flex items-center flex-wrap gap-1">
                    {r.driver_name}
                    {getFixStartBadge(r)}
                  </p>
                  <p className="text-[10px] text-slate-400">ID: {r.driver_id} • {new Date(r.date).toLocaleDateString('th-TH')}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className="text-sm font-bold text-slate-600">{getSafeTime(title.includes('หลังเลิกงาน') ? r.checkout_real_timestamp : r.checkin_real_timestamp)}</p>
                  <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                </div>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(r.__backendId); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                title="ลบรายการ"
            >
                <i className="fas fa-trash-alt"></i>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
            <i className={`fas ${filterMode === 'ng' ? 'fa-shield-heart' : 'fa-check-circle'} text-4xl mb-2`}></i>
            <p className="text-sm">{filterMode === 'ng' ? 'ไม่พบรายการที่ติด NG' : 'ไม่มีรายการค้าง'}</p>
          </div>
        )}
      </div>
    </Card>
  );

  if (view === 'dashboard') {
    return (
      <div className="pb-10 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                <i className="fas fa-tachometer-alt text-blue-600"></i> แผงควบคุมเจ้าหน้าที่
            </h1>
            
            <div className="flex bg-slate-200 p-1 rounded-lg shadow-inner w-full sm:w-auto">
                <button 
                    onClick={() => setFilterMode('all')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    พนักงานทั้งหมด
                </button>
                <button 
                    onClick={() => setFilterMode('ng')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${filterMode === 'ng' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'}`}
                >
                    <i className="fas fa-exclamation-triangle"></i>
                    เฉพาะคนติด NG
                </button>
            </div>
        </div>

        {renderStats()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
          {renderQueueList('รอตรวจก่อนเริ่มงาน', 'fa-clock', pendingCheckin, 'amber')}
          {renderQueueList('พนักงานกำลังปฏิบัติงาน', 'fa-truck-moving', activeDrivers, 'blue')}
          {renderQueueList('รอตรวจหลังเลิกงาน', 'fa-flag-checkered', pendingCheckout, 'purple')}
        </div>

        {/* NG Modal for Dashboard */}
        {showNGModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                    <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> รายชื่อพนักงานที่ติดสถานะ NG (เดือนนี้)
                        </h3>
                        <button onClick={() => setShowNGModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-800 font-bold border-b border-red-100 sticky top-0">
                                <tr>
                                    <th className="p-3">วันที่</th>
                                    <th className="p-3">ชื่อพนักงาน</th>
                                    <th className="p-3">เวลาเริ่มงาน</th>
                                    <th className="p-3">เวลาอ้างอิง (Ref)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records
                                    .filter(r => {
                                        const d = new Date(r.date);
                                        return d.getMonth() === new Date().getMonth() && getFixStartInfo(r).status === 'NG';
                                    })
                                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(r => {
                                        const info = getFixStartInfo(r);
                                        return (
                                            <tr key={r.__backendId} className="hover:bg-red-50/30 cursor-pointer" onClick={() => { onSelectRecord(r.__backendId); setShowNGModal(false); }}>
                                                <td className="p-3 font-medium">{new Date(r.date).toLocaleDateString('th-TH')}</td>
                                                <td className="p-3 font-bold">{r.driver_name} ({r.driver_id})</td>
                                                <td className="p-3 text-red-600 font-bold">{getSafeTime(r.checkin_timestamp)}</td>
                                                <td className="p-3 text-slate-500">{info.time}</td>
                                            </tr>
                                        );
                                    })
                                }
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button onClick={() => setShowNGModal(false)} variant="secondary">ปิดหน้าต่าง</Button>
                    </div>
                </Card>
            </div>
        )}

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .animate-fade-in { animation: fadeIn 0.4s ease-out; }
          .animate-scale-up { animation: scaleUp 0.2s ease-out; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </div>
    );
  }

  if (view === 'queue-checkin') return <div className="animate-fade-in h-[600px]">{renderQueueList('รอตรวจก่อนเริ่มงาน', 'fa-clock', pendingCheckin, 'amber')}</div>;
  if (view === 'queue-checkout') return <div className="animate-fade-in h-[600px]">{renderQueueList('รอตรวจหลังเลิกงาน', 'fa-flag-checkered', pendingCheckout, 'purple')}</div>;

  return null;
};
