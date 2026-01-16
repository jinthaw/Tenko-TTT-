import React from 'react';
import { TenkoRecord } from '../../types';
import { Card, Badge, Button } from '../../components/UI';

interface Props {
  records: TenkoRecord[];
  onSelectRecord: (id: string) => void;
  onDelete: () => void;
}

export const TenkoHistory: React.FC<Props> = ({ records, onSelectRecord, onDelete }) => {
  // Only completed records
  const completed = records.filter(r => r.checkin_status === 'approved' && r.checkout_status === 'approved');
  
  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fas fa-check-double text-emerald-600"></i> รายการเสร็จสิ้น ({completed.length})
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map(record => (
                <Card key={record.__backendId} className="hover:shadow-md transition-all cursor-pointer border border-slate-200" onClick={() => onSelectRecord(record.__backendId)}>
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 text-lg">{record.driver_name}</h4>
                        <Badge type="approved">Completed</Badge>
                    </div>
                    <div className="text-sm space-y-2 text-slate-600">
                        <p className="flex items-center gap-2"><i className="fas fa-calendar w-4"></i> {new Date(record.date).toLocaleDateString('th-TH')}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded">
                            <div>
                                <p className="font-bold text-blue-600">เข้างาน</p>
                                <p>{new Date(record.checkin_timestamp!).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="truncate">โดย: {record.checkin_tenko_name}</p>
                            </div>
                            <div>
                                <p className="font-bold text-orange-600">เลิกงาน</p>
                                <p>{new Date(record.checkout_timestamp!).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="truncate">โดย: {record.checkout_tenko_name}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    </div>
  );
};