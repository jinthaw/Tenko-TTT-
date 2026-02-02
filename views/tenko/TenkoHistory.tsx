
import React, { useState, useMemo } from 'react';
import { TenkoRecord } from '../../types';
import { Card, Badge, Button, Input } from '../../components/UI';

interface Props {
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TenkoHistory: React.FC<Props> = ({ records, onSelectRecord, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM format

  // Only completed records
  const completed = useMemo(() => {
    return records.filter(r => r.checkin_status === 'approved' && r.checkout_status === 'approved');
  }, [records]);

  // ป้องกันปัญหา Timezone โดยการสร้าง Date จาก string YYYY-MM-DD โดยตรง
  const parseSafeDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const filtered = useMemo(() => {
      return completed.filter(r => {
          const matchName = r.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.driver_id.toLowerCase().includes(searchTerm.toLowerCase());
          
          // Use checkin_timestamp (Check-in Approval Date) for filtering
          // This ensures records are grouped by when they STARTED work/were approved to work
          let filterDate = r.date; 
          if (r.checkin_timestamp) {
              // Convert ISO timestamp to YYYY-MM-DD for comparison
              const d = new Date(r.checkin_timestamp);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              filterDate = `${y}-${m}-${day}`;
          }

          const matchMonth = selectedMonth ? filterDate.startsWith(selectedMonth) : true;
          return matchName && matchMonth;
      }).sort((a, b) => {
          // Sort by Check-in Approval Date
          const timeA = a.checkin_timestamp ? new Date(a.checkin_timestamp).getTime() : new Date(a.date).getTime();
          const timeB = b.checkin_timestamp ? new Date(b.checkin_timestamp).getTime() : new Date(b.date).getTime();
          return timeB - timeA;
      });
  }, [completed, searchTerm, selectedMonth]);

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <i className="fas fa-check-double text-emerald-600"></i> รายการเสร็จสิ้น ({filtered.length})
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input 
                        className="w-full pl-9 pr-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                        placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <input 
                    type="month"
                    className="p-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                />
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(record => {
                // Determine display date based on checkin_timestamp (Approval Date)
                const displayDate = record.checkin_timestamp ? new Date(record.checkin_timestamp) : parseSafeDate(record.date);
                
                return (
                <Card key={record.__backendId} className="hover:shadow-md transition-all cursor-pointer border border-slate-200 relative group" onClick={() => onSelectRecord(record.__backendId)}>
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 text-lg">{record.driver_name}</h4>
                        <Badge type="approved">Completed</Badge>
                    </div>
                    <div className="text-sm space-y-2 text-slate-600">
                        <p className="flex items-center gap-2 font-semibold text-blue-900 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                          <i className="fas fa-calendar-check w-4 text-blue-600"></i> 
                          {displayDate.toLocaleDateString('th-TH', { dateStyle: 'long' })}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded">
                            <div>
                                <p className="font-bold text-blue-600">เข้างาน</p>
                                <p>{record.checkin_timestamp ? new Date(record.checkin_timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                <p className="truncate">โดย: {record.checkin_tenko_name}</p>
                            </div>
                            <div>
                                <p className="font-bold text-orange-600">เลิกงาน (อนุมัติ)</p>
                                <p>{record.checkout_timestamp ? new Date(record.checkout_timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                <p className="truncate">โดย: {record.checkout_tenko_name}</p>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(record.__backendId); }}
                        className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                        title="ลบรายการ"
                    >
                        <i className="fas fa-trash-alt"></i>
                    </button>
                </Card>
            )})}
        </div>

        {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <i className="fas fa-search text-5xl mb-4 opacity-20"></i>
                <p>ไม่พบรายการที่ตรงตามเงื่อนไข</p>
            </div>
        )}
    </div>
  );
};
