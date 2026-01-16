import React, { useState } from 'react';
import { Login } from './views/Login';
import { DriverApp } from './views/driver/DriverApp';
import { TenkoApp } from './views/tenko/TenkoApp';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (user.role === 'driver') {
    return <DriverApp user={user} onLogout={() => setUser(null)} />;
  }

  if (user.role === 'tenko') {
    return <TenkoApp user={user} onLogout={() => setUser(null)} />;
  }

  return <div>Unknown role</div>;
}

export default App;