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
          await StorageService.delete(id);
          handleUpdate();
      }
  };

  const SidebarItem = ({ view, icon, label }: { view: View; icon: string; label: string }) => (
    <div 
      onClick={() => { setCurrentView(view); setSelectedRecordId(null); }}
      className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${currentView === view ? 'bg-white/20 border-r-4 border-white' : 'hover:bg-white/10 border-r-4 border-transparent'}`}
    >
      <i className={`fas ${icon} w-6 text-center`}></i>
      <span className="font-medium">{label}</span>
      {view.includes('queue') && (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {records.filter(r => view === 'queue-checkin' ? r.checkin_status === 'pending' : r.checkout_status === 'pending').length}
        </span>
      )}
    </div>
  );

  const renderContent = () => {
    if (selectedRecordId) {
       const record = records.find(r => r.__backendId === selectedRecordId);
       if (!record) return <div>Record not found</div>;
       return (
         <ApprovalView 
            record={record} 
            user={user}
            type={currentView === 'queue-checkin' ? 'checkin' : currentView === 'queue-checkout' ? 'checkout' : 'view'}
            onBack={() => setSelectedRecordId(null)}
            onSuccess={handleUpdate}
         />
       );
    }

    switch (currentView) {
        case 'manage': return <StaffManagement />;
        case 'analytics': return <TenkoAnalytics records={records} />;
        case 'report': return <TenkoReportPrint records={records} />;
        case 'completed': return <TenkoHistory records={records} onSelectRecord={setSelectedRecordId} onDelete={handleUpdate} />;
        case 'queue-checkin': return <TenkoDashboard view="queue-checkin" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
        case 'queue-checkout': return <TenkoDashboard view="queue-checkout" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
        default: return <TenkoDashboard view="dashboard" records={records} onSelectRecord={setSelectedRecordId} onDelete={handleDeleteRecord} />;
    }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Sidebar hidden when printing */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-700 text-white flex flex-col shadow-xl z-20 print:hidden">
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
        <nav className="flex-1 py-4 space-y-1 text-sm">
            <SidebarItem view="dashboard" icon="fa-home" label="หน้าหลัก" />
            <SidebarItem view="queue-checkin" icon="fa-clipboard-check" label="คิว (ก่อนเริ่มงาน)" />
            <SidebarItem view="queue-checkout" icon="fa-flag-checkered" label="คิว (หลังเลิกงาน)" />
            <SidebarItem view="completed" icon="fa-check-double" label="รายการเสร็จสิ้น" />
            <SidebarItem view="analytics" icon="fa-chart-line" label="แดชบอร์ด/ปฏิทิน" />
            <SidebarItem view="report" icon="fa-print" label="พิมพ์รายงาน" />
            <SidebarItem view="manage" icon="fa-users-cog" label="ข้อมูลพนักงาน" />
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
      
      <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
        {renderContent()}
      </main>
    </div>
  );
};