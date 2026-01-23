
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { User, TenkoRecord } from '../../types';
import { Card, Button, Input, OptionButton, Badge } from '../../components/UI';

export const StaffManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'driver' });
  const [loading, setLoading] = useState(false);
  
  // Layout State for Tab switching
  const [activeTab, setActiveTab] = useState<'users' | 'cleanup'>('users');

  // --- Cleanup Tool State ---
  const [cleanupSearch, setCleanupSearch] = useState('');
  const [cleanupRecords, setCleanupRecords] = useState<TenkoRecord[]>([]);
  const [searching, setSearching] = useState(false);

  const loadUsers = async () => {
      const data = await StorageService.getUsers();
      setUsers(data);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async () => {
    if (!editingUser.id || !editingUser.name) return alert('กรุณากรอกข้อมูลให้ครบ');
    setLoading(true);
    await StorageService.saveUser(editingUser as User);
    await loadUsers();
    setLoading(false);
    setIsModalOpen(false);
    setEditingUser({ role: 'driver' });
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('ต้องการลบผู้ใช้นี้?')) {
        await StorageService.deleteUser(id);
        loadUsers();
    }
  };

  const openEdit = (user: User) => {
      setEditingUser(user);
      setIsModalOpen(true);
  };

  const openAdd = () => {
      setEditingUser({ role: 'driver', id: '', name: '' });
      setIsModalOpen(true);
  };

  // --- Cleanup Functions ---
  const handleSearchRecords = async () => {
      const query = cleanupSearch.trim();
      if (!query) return;
      
      setSearching(true);
      try {
          // Force a fresh fetch from the storage/server
          const allRecords = await StorageService.getAll();
          
          const matches = allRecords
            .filter(r => {
                const rId = String(r.driver_id).toLowerCase().trim();
                const rName = r.driver_name.toLowerCase();
                const sQuery = query.toLowerCase();
                return rId === sQuery || rName.includes(sQuery);
            })
            .sort((a,b) => {
                // Priority to pending records
                if (a.checkin_status === 'pending' && b.checkin_status !== 'pending') return -1;
                if (a.checkin_status !== 'pending' && b.checkin_status === 'pending') return 1;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
          
          setCleanupRecords(matches);
          if (matches.length === 0) {
              alert('ไม่พบข้อมูลของพนักงานท่านนี้');
          }
      } catch (e) {
          alert('เกิดข้อผิดพลาดในการดึงข้อมูล');
      } finally {
          setSearching(false);
      }
  };

  const handleForceDeleteRecord = async (recordId: string) => {
      if (confirm('ยืนยันลบรายการนี้ถาวร?\n(พนักงานจะสามารถส่งข้อมูลใหม่ได้ทันที และข้อมูลเดิมจะหายไปจากทั้งเครื่องนี้และ Google Sheet)')) {
          setSearching(true);
          try {
              const result = await StorageService.delete(recordId);
              if (result.isOk) {
                  // Update UI immediately by filtering out the deleted record
                  setCleanupRecords(prev => prev.filter(r => r.__backendId !== recordId));
                  alert('ลบข้อมูลเรียบร้อยแล้ว');
              }
          } catch (e) {
              alert('ล้มเหลวในการลบข้อมูล: ' + e);
          } finally {
              setSearching(false);
          }
      }
  };

  const handleClearLocalCache = () => {
      if (confirm('คำเตือน: การ "ล้างแคชเครื่องนี้" จะลบข้อมูลที่พักไว้ในเครื่องนี้ทั้งหมด\n\nใช้สำหรับแก้ปัญหาข้อมูลค้าง/ซ้ำ ที่เกิดจากการใช้งานขณะเน็ตหลุด\n\nคุณแน่ใจหรือไม่?')) {
          StorageService.clearLocalCache();
          alert('ล้างแคชเรียบร้อย กรุณารีเฟรชหน้าเว็บ');
          window.location.reload();
      }
  };

  const renderList = (role: 'driver' | 'tenko', title: string, icon: string, color: string) => (
    <Card className="h-full flex flex-col shadow-md border-t-4 border-t-transparent hover:border-t-blue-500 transition-all">
        <div className="flex justify-between items-center mb-4 shrink-0 border-b pb-3">
            <h3 className={`font-bold flex items-center gap-2 text-${color}-600 text-lg`}>
                <i className={`fas ${icon}`}></i> {title}
            </h3>
            <Button size="sm" onClick={openAdd} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm">
                <i className="fas fa-plus"></i> เพิ่ม
            </Button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
            {users.filter(u => u.role === role).map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-${color}-100 text-${color}-600 rounded-full flex items-center justify-center font-bold text-lg`}>{u.name[0]}</div>
                        <div>
                            <p className="font-bold text-slate-800 leading-tight">{u.name}</p>
                            <p className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded inline-block border mt-1">{u.id}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center"><i className="fas fa-edit"></i></button>
                        <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"><i className="fas fa-trash"></i></button>
                    </div>
                </div>
            ))}
            {users.filter(u => u.role === role).length === 0 && (
                <div className="text-center text-slate-400 py-10 italic">
                    <p>ไม่มีข้อมูลพนักงาน</p>
                </div>
            )}
        </div>
    </Card>
  );

  return (
    <div className="h-full flex flex-col pb-4 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">จัดการระบบ (Settings)</h2>
                <p className="text-slate-500 text-sm hidden md:block">จัดการรายชื่อผู้ใช้และล้างประวัติที่ผิดปกติ</p>
            </div>
            
            <div className="flex bg-slate-200 p-1.5 rounded-xl w-full lg:w-auto shadow-inner">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'users' ? 'bg-white text-blue-700 shadow-md scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    <i className="fas fa-users"></i> พนักงาน
                </button>
                <button 
                    onClick={() => setActiveTab('cleanup')}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'cleanup' ? 'bg-red-500 text-white shadow-md scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    <i className="fas fa-broom"></i> ล้างข้อมูลค้าง
                </button>
            </div>
        </div>
        
        <div className="flex-1 min-h-0">
            {activeTab === 'users' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full pb-2 animate-slide-up">
                    {renderList('driver', 'พนักงานขับรถ', 'fa-truck', 'blue')}
                    {renderList('tenko', 'เจ้าหน้าที่ Tenko', 'fa-user-shield', 'emerald')}
                </div>
            ) : (
                <div className="h-full pb-2 animate-slide-up">
                     <Card className="bg-white border border-red-100 flex-1 flex flex-col h-full shadow-lg overflow-hidden">
                        <div className="bg-red-50 p-6 border-b border-red-100 shrink-0">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                                        <i className="fas fa-shield-virus"></i> แก้ปัญหาข้อมูลตกค้าง
                                    </h3>
                                    <p className="text-red-700 text-sm mt-1">ใช้ในกรณีพนักงานส่งซ้ำ หรือข้อมูลไม่ซิงค์เนื่องจากเน็ตหลุด</p>
                                </div>
                                <Button onClick={handleClearLocalCache} variant="danger" className="shadow-lg px-6 py-3">
                                    <i className="fas fa-trash-restore"></i> ล้างแคชเครื่องนี้
                                </Button>
                            </div>
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col min-h-0 bg-slate-50">
                            <div className="flex gap-2 mb-6 shrink-0">
                                <div className="relative flex-1">
                                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    <input 
                                        className="pl-11 pr-4 py-3 rounded-xl border-2 border-slate-200 w-full focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 shadow-sm text-lg"
                                        placeholder="ระบุรหัสพนักงาน (เช่น 342)"
                                        value={cleanupSearch}
                                        onChange={e => setCleanupSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchRecords()}
                                    />
                                </div>
                                <Button onClick={handleSearchRecords} isLoading={searching} variant="danger" className="px-8 shadow-md">
                                    ค้นหา
                                </Button>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col shadow-sm">
                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    รายการที่พบ (เรียงตามลำดับความสำคัญ)
                                </div>
                                <div className="overflow-y-auto p-4 space-y-3 flex-1 custom-scrollbar">
                                    {cleanupRecords.length > 0 ? (
                                        cleanupRecords.map(r => (
                                            <div key={r.__backendId} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-xl transition-all shadow-sm gap-4 ${r.checkin_status === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-lg text-slate-800">{r.driver_name}</span>
                                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono border border-slate-200">{r.driver_id}</span>
                                                    </div>
                                                    <div className="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-6 gap-y-1">
                                                        <span className="flex items-center gap-1.5"><i className="fas fa-calendar text-slate-400"></i> {r.date}</span>
                                                        <span className="flex items-center gap-1.5"><i className="fas fa-clock text-slate-400"></i> In: {r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH') : (r.checkin_real_timestamp ? new Date(r.checkin_real_timestamp).toLocaleTimeString('th-TH') : '-')}</span>
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <Badge type={r.checkin_status === 'approved' ? 'approved' : 'pending'}>
                                                            Check-in: {r.checkin_status === 'pending' ? 'รออนุมัติ' : r.checkin_status || 'Wait'}
                                                        </Badge>
                                                        <Badge type={r.checkout_status === 'approved' ? 'approved' : r.checkout_status === 'pending' ? 'pending' : 'neutral'}>
                                                            Check-out: {r.checkout_status === 'pending' ? 'รออนุมัติ' : r.checkout_status || '-'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="danger" onClick={() => handleForceDeleteRecord(r.__backendId)} className="w-full sm:w-auto shadow-sm" isLoading={searching}>
                                                    <i className="fas fa-trash-alt"></i> บังคับลบ
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10 opacity-50">
                                            <i className="fas fa-search text-5xl mb-4"></i>
                                            <p className="text-lg">{searching ? 'กำลังค้นหา...' : 'กรอกรหัสพนักงาน (เช่น 342) แล้วกดค้นหา'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                <Card className="w-full max-w-md shadow-2xl animate-scale-up">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <i className="fas fa-user-edit text-blue-600"></i>
                        {editingUser.id && users.find(u => u.id === editingUser.id) ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                    </h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-600">ตำแหน่งงาน</label>
                            <div className="flex gap-2">
                                <OptionButton selected={editingUser.role === 'driver'} onClick={() => setEditingUser(p => ({...p, role: 'driver'}))}>
                                    <i className="fas fa-truck mr-1.5"></i> Driver
                                </OptionButton>
                                <OptionButton selected={editingUser.role === 'tenko'} onClick={() => setEditingUser(p => ({...p, role: 'tenko'}))}>
                                    <i className="fas fa-user-shield mr-1.5"></i> Tenko
                                </OptionButton>
                            </div>
                        </div>
                        <Input label="รหัสพนักงาน (Employee ID)" value={editingUser.id || ''} onChange={e => setEditingUser(p => ({...p, id: e.target.value}))} placeholder="เช่น 655" />
                        <Input label="ชื่อ-นามสกุล (Full Name)" value={editingUser.name || ''} onChange={e => setEditingUser(p => ({...p, name: e.target.value}))} placeholder="เช่น นายมานะ รักงาน" />
                        
                        <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                            <Button onClick={handleSave} isLoading={loading} className="flex-1 py-3">
                                <i className="fas fa-check"></i> บันทึก
                            </Button>
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 py-3">
                                ยกเลิก
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
        
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            
            .animate-fade-in { animation: fadeIn 0.3s ease-out; }
            .animate-slide-up { animation: slideUp 0.4s ease-out; }
            .animate-scale-up { animation: scaleUp 0.2s ease-out; }
            
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `}</style>
    </div>
  );
};
