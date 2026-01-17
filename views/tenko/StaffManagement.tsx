import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { User, TenkoRecord } from '../../types';
import { Card, Button, Input, OptionButton, Badge } from '../../components/UI';

export const StaffManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'driver' });
  const [loading, setLoading] = useState(false);
  
  // Layout State
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
      if (!cleanupSearch) return;
      setSearching(true);
      try {
          const allRecords = await StorageService.getAll();
          const matches = allRecords
            .filter(r => r.driver_id.includes(cleanupSearch) || r.driver_name.includes(cleanupSearch))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setCleanupRecords(matches);
      } catch (e) {
          alert('เกิดข้อผิดพลาดในการดึงข้อมูล');
      } finally {
          setSearching(false);
      }
  };

  const handleForceDeleteRecord = async (recordId: string) => {
      if (confirm('คุณต้องการ "ลบ" รายการนี้ออกจากระบบทันทีใช่หรือไม่?\n(การกระทำนี้ไม่สามารถกู้คืนได้)')) {
          await StorageService.delete(recordId);
          handleSearchRecords(); 
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
            <Button size="sm" onClick={openAdd} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm"><i className="fas fa-plus"></i> เพิ่ม</Button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {users.filter(u => u.role === role).map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-${color}-100 text-${color}-600 rounded-full flex items-center justify-center font-bold text-lg`}>{u.name[0]}</div>
                        <div>
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded inline-block border">{u.id}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center"><i className="fas fa-edit"></i></button>
                        <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"><i className="fas fa-trash"></i></button>
                    </div>
                </div>
            ))}
            {users.filter(u => u.role === role).length === 0 && (
                <div className="text-center text-slate-400 py-10">
                    <p>ไม่มีข้อมูล</p>
                </div>
            )}
        </div>
    </Card>
  );

  return (
    <div className="h-full flex flex-col pb-4">
        {/* Header with Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-4">
            <h2 className="text-2xl font-bold text-slate-800">จัดการข้อมูล (Admin Tools)</h2>
            
            <div className="flex bg-slate-200 p-1 rounded-lg self-end md:self-auto shadow-inner">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'users' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    <i className="fas fa-users"></i> รายชื่อพนักงาน
                </button>
                <button 
                    onClick={() => setActiveTab('cleanup')}
                    className={`px-6 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'cleanup' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    <i className="fas fa-broom"></i> ล้างข้อมูล
                </button>
            </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 min-h-0 relative">
            {activeTab === 'users' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full pb-2 animate-fade-in">
                    {renderList('driver', 'พนักงานขับรถ', 'fa-truck', 'blue')}
                    {renderList('tenko', 'เจ้าหน้าที่ Tenko', 'fa-user-shield', 'emerald')}
                </div>
            ) : (
                <div className="h-full pb-2 flex flex-col animate-fade-in">
                     <Card className="bg-red-50 border-2 border-red-200 flex-1 flex flex-col min-h-0 shadow-lg">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0 border-b border-red-200 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                                    <i className="fas fa-tools"></i> เครื่องมือแก้ปัญหาข้อมูล (Troubleshooting)
                                </h3>
                                <p className="text-red-700 text-sm mt-1">ใช้สำหรับค้นหาและลบรายการที่ค้าง/ซ้ำ หรือรีเซ็ตข้อมูลในเครื่องนี้</p>
                            </div>
                            <Button onClick={handleClearLocalCache} variant="secondary" className="border-red-400 text-red-600 hover:bg-red-100 whitespace-nowrap bg-white shadow-sm">
                                <i className="fas fa-trash-restore"></i> ล้างแคชเครื่องนี้ (Reset App)
                            </Button>
                        </div>
                        
                        <div className="flex gap-2 mb-4 shrink-0">
                            <input 
                                className="px-4 py-3 rounded-lg border border-red-300 w-full focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 shadow-sm"
                                placeholder="ค้นหาด้วยรหัสพนักงาน (เช่น 655)"
                                value={cleanupSearch}
                                onChange={e => setCleanupSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchRecords()}
                                autoFocus
                            />
                            <Button onClick={handleSearchRecords} isLoading={searching} variant="danger" className="whitespace-nowrap px-8 text-lg shadow-md">
                                <i className="fas fa-search"></i> ค้นหา
                            </Button>
                        </div>

                        <div className="bg-white rounded-xl border border-red-100 flex-1 overflow-hidden flex flex-col shadow-inner">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                ผลการค้นหา
                            </div>
                            <div className="overflow-y-auto p-2 space-y-2 flex-1">
                                {cleanupRecords.length > 0 ? (
                                    cleanupRecords.map(r => (
                                        <div key={r.__backendId} className="flex justify-between items-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-lg text-slate-800">{r.driver_name}</span>
                                                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono">{r.driver_id}</span>
                                                </div>
                                                <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                                    <span><i className="fas fa-calendar w-4"></i> {r.date}</span>
                                                    <span><i className="fas fa-clock w-4"></i> {r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH') : '-'}</span>
                                                    <span className="text-xs text-slate-400">ID: {r.__backendId.substring(0,8)}...</span>
                                                </div>
                                                <div className="mt-2 flex gap-2">
                                                    <Badge type={r.checkin_status === 'approved' ? 'approved' : 'pending'}>
                                                        In: {r.checkin_status || 'Wait'}
                                                    </Badge>
                                                    <Badge type={r.checkout_status === 'approved' ? 'approved' : r.checkout_status === 'pending' ? 'pending' : 'neutral'}>
                                                        Out: {r.checkout_status || '-'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="danger" onClick={() => handleForceDeleteRecord(r.__backendId)} className="shrink-0 ml-4">
                                                <i className="fas fa-trash-alt"></i> ลบ
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-10">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                                            <i className="fas fa-search text-3xl"></i>
                                        </div>
                                        <p>{searching ? 'กำลังค้นหา...' : 'กรอกรหัสพนักงานแล้วกดค้นหา เพื่อจัดการข้อมูล'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md shadow-2xl animate-fade-in-up">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <i className="fas fa-user-edit text-blue-500"></i>
                        {editingUser.id && users.find(u => u.id === editingUser.id) ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                    </h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">ตำแหน่ง</label>
                            <div className="flex gap-2">
                                <OptionButton selected={editingUser.role === 'driver'} onClick={() => setEditingUser(p => ({...p, role: 'driver'}))}>
                                    <i className="fas fa-truck mr-1"></i> Driver
                                </OptionButton>
                                <OptionButton selected={editingUser.role === 'tenko'} onClick={() => setEditingUser(p => ({...p, role: 'tenko'}))}>
                                    <i className="fas fa-user-shield mr-1"></i> Tenko
                                </OptionButton>
                            </div>
                        </div>
                        <Input label="รหัสพนักงาน (ID)" value={editingUser.id || ''} onChange={e => setEditingUser(p => ({...p, id: e.target.value}))} placeholder="เช่น 655" />
                        <Input label="ชื่อ-นามสกุล" value={editingUser.name || ''} onChange={e => setEditingUser(p => ({...p, name: e.target.value}))} placeholder="เช่น นายสมชาย ใจดี" />
                        <div className="flex gap-3 mt-8 pt-4 border-t">
                            <Button onClick={handleSave} isLoading={loading} className="flex-1">บันทึก</Button>
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">ยกเลิก</Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
    </div>
  );
};