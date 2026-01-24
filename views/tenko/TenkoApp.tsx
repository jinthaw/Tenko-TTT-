
import React, { useState, useEffect } from 'react';
import { User, TenkoRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { TenkoDashboard } from './TenkoDashboard';
import { ApprovalView } from './ApprovalView';
import { StaffManagement } from './StaffManagement';
import { TenkoHistory } from './TenkoHistory';
import { TenkoAnalytics } from './TenkoAnalytics';
import { TenkoReportPrint } from './TenkoReportPrint';
import { SYSTEM_VERSION } from '../../constants';

interface Props {
  user: User;
  onLogout: () => void;
}

type View = 'dashboard' | 'queue-checkin' | 'queue-checkout' | 'completed' | 'analytics' | 'manage' | 'report';

export const TenkoApp: React.FC<Props> = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [records, setRecords] = useState<TenkoRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const loadData = async () => {
      try {
          const data = await StorageService.getAll();
          setRecords(data);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    loadData().then(() => {
        setSelectedRecordId(null);
    });
  };

  const handleDeleteRecord = async (id: string) => {
      if(confirm('คุณต้องการลบรายการนี้ทิ้งทันทีหรือไม่? (Driver ต้องส่งใหม่)')) {
          const res = await StorageService.delete(id);
          if (res.isOk) {
            handleUpdate();
          } else {
            alert('ไม่สามารถลบข้อมูลที่ Server ได้ กรุณาลองใหม่');
          }
      }
  };

  // Nav Item component
  const NavItem = ({ view, icon, label, mobile = false }: { view: View; icon: string; label: string; mobile?: boolean }) => {
      const isActive = currentView === view;
      const count = records.filter(r => view === 'queue-checkin' ? r.checkin_status === 'pending' : r.checkout_status === 'pending').length;
      
      if (mobile) {
          return (
            <button 
                onClick={() => { setCurrentView(view); setSelectedRecordId(null); }}
                className={`flex flex-col items-center justify-center p-2 flex-1 relative ${isActive ? 'text-blue-200' : 'text-slate-400'}`}
            >
                <i className={`fas ${icon} text-lg mb-0.5`}></i>
                <span className="text-[9px] leading-tight">{label.split(' ')[0]}</span>
                {(view === 'queue-checkin' || view === 'queue-checkout') && count > 0 && (
                    <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full font-bold border border-blue-900">
                        {count}
                    </span>
                )}
            </button>
          );
      }

      return (
        <div 
          onClick={() => { setCurrentView(view); setSelectedRecordId(null); }}
          className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${isActive ? 'bg-white/20 border-r-4 border-white' : 'hover:bg-white/10 border-r-4 border-transparent'}`}
        >
          <i className={`fas ${icon} w-6 text-center`}></i>
          <span className="font-medium">{label}</span>
          {(view === 'queue-checkin' || view === 'queue-checkout') && count > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
            </span>
          )}
        </div>
      );
  };

  const renderContent = () => {
    // CRITICAL: Handle selection first
    if (selectedRecordId) {
       const record = records.find(r => r.__backendId === selectedRecordId);
       if (!record) return <div>Record not found</div>;
       
       let approvalType: 'checkin' | 'checkout' | 'view' = 'view';
       if (record.checkin_status === 'pending') {
           approvalType = 'checkin';
       } else if (record.checkout_status === 'pending') {
           approvalType = 'checkout';
       } else if (record.checkin_status === 'approved' && !record.checkout_status) {
           // ADDED: Allow Tenko to force checkout for working drivers
           approvalType = 'checkout';
       }

       return (
         <ApprovalView 
            record={record} 
            user={user}
            type={approvalType}
            onBack={() => setSelectedRecordId(null)}
            onSuccess={handleUpdate}
         />
       );
    }

    switch (currentView) {
        case 'manage': return <StaffManagement />;
        case 'analytics': return <TenkoAnalytics records={records} onSelectRecord={setSelectedRecordId} />;
        case 'report': return <TenkoReportPrint records={records} />;
        case 'completed': return <TenkoHistory records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
        case 'queue-checkin': return <TenkoDashboard view="queue-checkin" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
        case 'queue-checkout': return <TenkoDashboard view="queue-checkout" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
        default: return <TenkoDashboard view="dashboard" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-blue-900 to-blue-700 text-white flex-col shadow-xl z-20 print:hidden h-full">
        <div className="p-6 border-b border-blue-500/30">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <i className="fas fa-user-shield"></i>
                </div>
                <div>
                    <h3 className="font-bold leading-tight">{user.name}</h3>
                    <p className="text-xs text-blue-200">เจ้าหน้าที่ Tenko</p>
                </div>
            </div>
        </div>
        <nav className="flex-1 py-4 space-y-1 text-sm overflow-y-auto">
            <NavItem view="dashboard" icon="fa-home" label="หน้าหลัก" />
            <NavItem view="queue-checkin" icon="fa-clipboard-check" label="คิว (ก่อนเริ่มงาน)" />
            <NavItem view="queue-checkout" icon="fa-flag-checkered" label="คิว (หลังเลิกงาน)" />
            <NavItem view="completed" icon="fa-check-double" label="รายการเสร็จสิ้น" />
            <NavItem view="analytics" icon="fa-chart-line" label="แดชบอร์ด/ปฏิทิน" />
            <NavItem view="report" icon="fa-print" label="พิมพ์รายงาน" />
            <NavItem view="manage" icon="fa-users-cog" label="ข้อมูลพนักงาน" />
        </nav>
        <div className="p-4 border-t border-blue-500/30">
            <button onClick={onLogout} className="w-full py-2 bg-blue-900/50 hover:bg-blue-800 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                <i className="fas fa-sign-out-alt"></i> ออกจากระบบ
            </button>
            <div className="mt-4 text-center text-xs text-blue-300/60 font-mono">
                {SYSTEM_VERSION}
            </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible pb-20 md:pb-8 w-full">
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm border border-slate-100">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    <i className="fas fa-user-shield text-xs"></i>
                </div>
                <span className="font-bold text-sm text-slate-700">{user.name}</span>
             </div>
             <button onClick={onLogout} className="text-slate-400 hover:text-red-500">
                 <i className="fas fa-sign-out-alt"></i>
             </button>
        </div>
        {renderContent()}
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-slate-400 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 flex justify-around items-center border-t border-slate-800 safe-area-pb">
            <NavItem view="dashboard" icon="fa-home" label="Home" mobile />
            <NavItem view="queue-checkin" icon="fa-clipboard-check" label="In" mobile />
            <NavItem view="queue-checkout" icon="fa-flag-checkered" label="Out" mobile />
            <NavItem view="completed" icon="fa-check-double" label="Done" mobile />
            <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
            <NavItem view="analytics" icon="fa-chart-line" label="Stats" mobile />
            <NavItem view="manage" icon="fa-cog" label="Admin" mobile />
      </nav>
    </div>
  );
};
