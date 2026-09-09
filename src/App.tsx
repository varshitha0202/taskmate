import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { AgentDashboard } from './pages/agent/AgentDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [unauthView, setUnauthView] = useState<'LANDING' | 'LOGIN' | 'REGISTER'>('LOGIN');

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">TaskMate</div>
          <div className="text-xs text-slate-400 mt-0.5">Initializing Realtime Workspace...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar onNavigateLanding={() => setUnauthView('LANDING')} onNavigateLogin={() => setUnauthView('LOGIN')} />
        <div className="flex-1">
          {unauthView === 'LANDING' && (
            <LandingPage
              onPostTask={() => setUnauthView('LOGIN')}
              onBecomeAgent={() => setUnauthView('LOGIN')}
              onLogin={() => setUnauthView('LOGIN')}
            />
          )}
          {unauthView === 'LOGIN' && (
            <LoginPage 
              onNavigateRegister={() => setUnauthView('REGISTER')} 
              onNavigateLanding={() => setUnauthView('LANDING')}
            />
          )}
          {unauthView === 'REGISTER' && (
            <RegisterPage 
              onNavigateLogin={() => setUnauthView('LOGIN')} 
            />
          )}
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onNavigateLanding={() => {}} onNavigateLogin={() => {}} />
      <main className="flex-1 pb-12">
        {user.role === 'CUSTOMER' && <CustomerDashboard />}
        {user.role === 'AGENT' && <AgentDashboard />}
        {user.role === 'ADMIN' && <AdminDashboard />}
      </main>
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <AppContent />
      </RealtimeProvider>
    </AuthProvider>
  );
};

export default App;
