import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { User, TenkoRecord } from '../../types';
import { Card, Button, Input, OptionButton, Badge } from '../../components/UI';

export const StaffManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'driver' });
  const [loading, setLoading] = useState(false);

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
          // Force fetch fresh data
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
          handleSearchRecords(); // Refresh list
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
    <Card className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className={`font-bold flex items-center gap-2 text-${color}-600`}>
                <i className={`fas ${icon}`}></i> {title}
            </h3>
            <Button size="sm" onClick={openAdd} className="bg-slate-800 hover:bg-slate-900 text-white"><i className="fas fa-plus"></i> เพิ่ม</Button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {users.filter(u => u.role === role).map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:border-blue-300">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-${color}-500 text-white rounded-full flex items-center justify-center font-bold`}>{u.name[0]}</div>
                        <div>
                            <p className="font-semibold">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.id}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700"><i className="fas fa-edit"></i></button>
                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash"></i></button>
                    </div>
                </div>
            ))}
        </div>
    </Card>
  );

  return (
    <div className="space-y-6 h-full flex flex-col pb-10">
        <h2 className="text-2xl font-bold text-slate-800 shrink-0">จัดการข้อมูล (Admin Tools)</h2>
        
        {/* User Management Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px] shrink-0">
            {renderList('driver', 'พนักงานขับรถ', 'fa-truck', 'blue')}
            {renderList('tenko', 'เจ้าหน้าที่ Tenko', 'fa-user-shield', 'emerald')}
        </div>

        {/* Data Cleanup Section */}
        <Card className="bg-red-50 border-2 border-red-200 flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                        <i className="fas fa-broom"></i> แก้ไขข้อมูล / ล้างข้อมูลตกค้าง
                    </h3>
                    <p className="text-red-600 text-sm">ค้นหาและลบรายการที่ค้างในระบบ หรือรายการซ้ำ</p>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <Button onClick={handleClearLocalCache} variant="secondary" className="border-red-400 text-red-600 hover:bg-red-100 whitespace-nowrap text-sm">
                        <i className="fas fa-trash-restore"></i> ล้างแคชเครื่องนี้ (Reset App)
                    </Button>
                </div>
            </div>
            
            <div className="flex gap-2 mb-4">
                 <input 
                    className="px-4 py-2 rounded border border-red-300 w-full focus:outline-none focus:border-red-500"
                    placeholder="ค้นหา: รหัสพนักงาน (เช่น 655)"
                    value={cleanupSearch}
                    onChange={e => setCleanupSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchRecords()}
                />
                <Button onClick={handleSearchRecords} isLoading={searching} variant="danger" className="whitespace-nowrap px-6">
                    <i className="fas fa-search"></i> ค้นหา
                </Button>
            </div>

            <div className="bg-white rounded border border-red-100 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto p-2 space-y-2">
                    {cleanupRecords.length > 0 ? (
                        cleanupRecords.map(r => (
                            <div key={r.__backendId} className="flex justify-between items-center p-3 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800">{r.driver_name}</span>
                                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{r.driver_id}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1 flex gap-4">
                                        <span><i className="fas fa-calendar"></i> {r.date}</span>
                                        <span><i className="fas fa-clock"></i> {r.checkin_timestamp ? new Date(r.checkin_timestamp).toLocaleTimeString('th-TH') : '-'}</span>
                                    </div>
                                    <div className="mt-1 flex gap-2">
                                         <Badge type={r.checkin_status === 'approved' ? 'approved' : 'pending'}>
                                             Checkin: {r.checkin_status || 'Wait'}
                                         </Badge>
                                         <Badge type={r.checkout_status === 'approved' ? 'approved' : r.checkout_status === 'pending' ? 'pending' : 'neutral'}>
                                             Checkout: {r.checkout_status || '-'}
                                         </Badge>
                                    </div>
                                </div>
                                <Button size="sm" variant="danger" onClick={() => handleForceDeleteRecord(r.__backendId)}>
                                    <i className="fas fa-trash-alt"></i> ลบรายการนี้
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <i className="fas fa-search text-3xl mb-2"></i>
                            <p>{searching ? 'กำลังค้นหา...' : 'กรอกรหัสพนักงานแล้วกดค้นหา เพื่อจัดการข้อมูล'}</p>
                        </div>
                    )}
                </div>
            </div>
        </Card>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md">
                    <h3 className="text-xl font-bold mb-4">{editingUser.id && users.find(u => u.id === editingUser.id) ? 'แก้ไขข้อมูล' : 'เพิ่มพนักงานใหม่'}</h3>
                    <div className="space-y-4">
                        <div className="flex gap-2 mb-2">
                            <OptionButton selected={editingUser.role === 'driver'} onClick={() => setEditingUser(p => ({...p, role: 'driver'}))}>Driver</OptionButton>
                            <OptionButton selected={editingUser.role === 'tenko'} onClick={() => setEditingUser(p => ({...p, role: 'tenko'}))}>Tenko</OptionButton>
                        </div>
                        <Input label="รหัสพนักงาน (ID)" value={editingUser.id || ''} onChange={e => setEditingUser(p => ({...p, id: e.target.value}))} />
                        <Input label="ชื่อ-นามสกุล" value={editingUser.name || ''} onChange={e => setEditingUser(p => ({...p, name: e.target.value}))} />
                        <div className="flex gap-2 mt-6">
                            <Button onClick={handleSave} isLoading={loading} className="w-full">บันทึก</Button>
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full">ยกเลิก</Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
    </div>
  );
};