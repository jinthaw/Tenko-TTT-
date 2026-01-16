import React, { useState } from 'react';
import { Button, Card, Input } from '../components/UI';
import { StorageService } from '../services/storage';
import { SYSTEM_VERSION } from '../constants';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    const users = StorageService.getUsers();
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
            <i className="fas fa-clipboard-check text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Tenko TTT</h1>
          <p className="text-slate-500">ACT Transport System</p>
        </div>

        <div className="space-y-5">
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

          <Button onClick={handleLogin} className="w-full py-3 text-lg shadow-lg">
            <i className="fas fa-sign-in-alt"></i> เข้าสู่ระบบ
          </Button>

          <div className="text-center mt-6">
             <p className="text-xs text-slate-400 font-mono">System v{SYSTEM_VERSION}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};