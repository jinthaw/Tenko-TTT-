import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { User } from '../../types';
import { Card, Button, Input, OptionButton } from '../../components/UI';

export const StaffManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'driver' });

  useEffect(() => {
    setUsers(StorageService.getUsers());
  }, []);

  const handleSave = () => {
    if (!editingUser.id || !editingUser.name) return alert('กรุณากรอกข้อมูลให้ครบ');
    StorageService.saveUser(editingUser as User);
    setUsers(StorageService.getUsers());
    setIsModalOpen(false);
    setEditingUser({ role: 'driver' });
  };

  const handleDelete = (id: string) => {
    if (confirm('ต้องการลบผู้ใช้นี้?')) {
        StorageService.deleteUser(id);
        setUsers(StorageService.getUsers());
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

  const renderList = (role: 'driver' | 'tenko', title: string, icon: string, color: string) => (
    <Card className="h-full">
        <div className="flex justify-between items-center mb-4">
            <h3 className={`font-bold flex items-center gap-2 text-${color}-600`}>
                <i className={`fas ${icon}`}></i> {title}
            </h3>
            <Button size="sm" onClick={openAdd} className="bg-slate-800 hover:bg-slate-900 text-white"><i className="fas fa-plus"></i> เพิ่ม</Button>
        </div>
        <div className="overflow-y-auto max-h-[500px] space-y-2">
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
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash"></i></button>
                    </div>
                </div>
            ))}
        </div>
    </Card>
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
        <h2 className="text-2xl font-bold text-slate-800">จัดการข้อมูลพนักงาน</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 grow overflow-hidden pb-6">
            {renderList('driver', 'พนักงานขับรถ', 'fa-truck', 'blue')}
            {renderList('tenko', 'เจ้าหน้าที่ Tenko', 'fa-user-shield', 'emerald')}
        </div>

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
                            <Button onClick={handleSave} className="w-full">บันทึก</Button>
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full">ยกเลิก</Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
    </div>
  );
};