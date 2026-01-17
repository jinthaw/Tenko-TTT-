import React, { useState, useEffect } from 'react';
import { Button, Card, Input } from '../components/UI';
import { StorageService } from '../services/storage';
import { SYSTEM_VERSION, DEFAULT_SCRIPT_URL } from '../constants';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Script URL State
  const [hasScript, setHasScript] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');
  const [initLoading, setInitLoading] = useState(false);

  useEffect(() => {
    // Check if we have a default hardcoded URL or a saved local URL
    const localUrl = localStorage.getItem('TENKO_SCRIPT_URL');
    
    if (DEFAULT_SCRIPT_URL) {
        setHasScript(true);
        // We use the constant as the URL, no need to show input
        setScriptUrl(DEFAULT_SCRIPT_URL);
    } else {
        setScriptUrl(localUrl || '');
        setHasScript(!!localUrl);
    }
  }, []);

  const handleSaveConfig = () => {
      if (!scriptUrl.includes('script.google.com')) {
          alert('URL ไม่ถูกต้อง (ต้องเป็น https://script.google.com/...)');
          return;
      }
      localStorage.setItem('TENKO_SCRIPT_URL', scriptUrl);
      window.location.reload();
  };

  const handleInitialize = async () => {
      if(!confirm('คุณต้องการอัปโหลดรายชื่อพนักงานเริ่มต้น (Default) ขึ้น Google Sheet หรือไม่?')) return;
      
      setInitLoading(true);
      try {
          // If using manual config, save it first
          if (!DEFAULT_SCRIPT_URL) {
             localStorage.setItem('TENKO_SCRIPT_URL', scriptUrl);
          }
          
          const count = await StorageService.initializeDefaultUsers();
          alert(`อัปโหลดสำเร็จ ${count} รายชื่อ! สามารถเข้าสู่ระบบได้แล้ว`);
      } catch (e) {
          alert('เกิดข้อผิดพลาด: ' + e);
      } finally {
          setInitLoading(false);
      }
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
        const users = await StorageService.getUsers();
        const user = users.find(u => u.id === username);

        if (user) {
          if (user.role === 'driver' && password === '123') {
            onLogin(user);
            return;
          } 
          if (user.role === 'tenko' && password === '123') {
            onLogin(user);
            return;
          }
        }
        
        setError('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    } catch (e) {
        setError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (Offline Mode Only?)');
    } finally {
        setLoading(false);
    }
  };

  if (showConfig) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
              <Card className="w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4">ตั้งค่า Server (App Script)</h2>
                  <div className="space-y-4">
                      {DEFAULT_SCRIPT_URL ? (
                          <div className="p-3 bg-green-50 text-green-800 rounded border border-green-200">
                              <p className="font-bold"><i className="fas fa-check-circle"></i> ตั้งค่าใน Code แล้ว</p>
                              <p className="text-xs mt-1 break-all opacity-70">{DEFAULT_SCRIPT_URL}</p>
                          </div>
                      ) : (
                          <>
                            <div className="p-3 bg-blue-50 text-xs text-blue-800 rounded">
                                <p className="font-bold">วิธีติดตั้ง:</p>
                                <ol className="list-decimal ml-4 space-y-1 mt-1">
                                    <li>เปิด Google Sheet {'>'} Apps Script</li>
                                    <li>Deploy {'>'} Web App {'>'} Anyone</li>
                                    <li>นำ URL มาวางช่องด้านล่าง</li>
                                </ol>
                            </div>
                            <Input 
                                label="Web App URL" 
                                placeholder="https://script.google.com/..." 
                                value={scriptUrl} 
                                onChange={e => setScriptUrl(e.target.value)} 
                            />
                          </>
                      )}
                      
                      {scriptUrl && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                              <p className="text-sm font-bold text-amber-800 mb-2">แก้ปัญหา Login ไม่ได้:</p>
                              <Button 
                                onClick={handleInitialize} 
                                isLoading={initLoading} 
                                variant="secondary" 
                                className="w-full text-xs"
                                disabled={!scriptUrl}
                              >
                                  <i className="fas fa-cloud-upload-alt"></i> อัปโหลดรายชื่อเริ่มต้นขึ้น Sheet
                              </Button>
                          </div>
                      )}

                      <div className="flex gap-2 pt-2">
                          {!DEFAULT_SCRIPT_URL && <Button onClick={handleSaveConfig} className="w-full">บันทึก & รีโหลด</Button>}
                          <Button variant="secondary" onClick={() => setShowConfig(false)} className="w-full">ปิดหน้าต่าง</Button>
                      </div>
                  </div>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
            <i className="fas fa-truck-fast text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Tenko TTT by ACT</h1>
          <p className="text-slate-500">ระบบตรวจสอบความพร้อม (Fast Sync)</p>
        </div>

        <div className="space-y-5">
          {/* Server Status Section - Simplified */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
               <div className="flex items-center gap-2 text-sm px-2">
                   {hasScript ? (
                       <>
                         <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                         <span className="text-green-700 font-bold text-xs">Connected</span>
                       </>
                   ) : (
                       <>
                         <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                         <span className="text-red-700 text-xs">No Server</span>
                       </>
                   )}
               </div>
               <button onClick={() => setShowConfig(true)} className="text-slate-400 hover:text-blue-600 p-2">
                   <i className="fas fa-cog"></i>
               </button>
          </div>

          <div className="border-t border-slate-200 my-4"></div>

          <Input 
            label="รหัสพนักงาน" 
            placeholder="กรอกรหัสพนักงาน" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="text-lg"
          />
          
          <div className="relative">
            <Input 
              label="รหัสผ่าน" 
              type={showPassword ? "text" : "password"} 
              placeholder="กรอกรหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10 text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              className="absolute right-3 top-[38px] text-slate-400 hover:text-blue-600 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-pulse">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <Button onClick={handleLogin} isLoading={loading} className="w-full py-3 text-lg shadow-lg" disabled={!hasScript && loading}>
            <i className="fas fa-sign-in-alt"></i> เข้าสู่ระบบ
          </Button>

          <div className="text-center mt-6">
             <p className="text-xs text-slate-400 font-mono">{SYSTEM_VERSION}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};