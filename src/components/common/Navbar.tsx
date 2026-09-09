import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { 
  Bell, 
  LogOut, 
  User, 
  MapPin, 
  Radio, 
  ShieldCheck, 
  Briefcase, 
  Home,
  LogIn
} from 'lucide-react';
import { BrandMark } from './BrandMark';

interface Props {
  onNavigateLanding?: () => void;
  onNavigateLogin?: () => void;
}

export const Navbar: React.FC<Props> = ({ onNavigateLanding, onNavigateLogin }) => {
  const { user, logout } = useAuth();
  const { isConnected, notifications, unreadCount, markAsRead } = useRealtime();
  const [showNotifications, setShowNotifications] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Operations Admin
          </span>
        );
      case 'AGENT':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full">
            <Briefcase className="w-3.5 h-3.5" /> Task Agent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full">
            <User className="w-3.5 h-3.5" /> Customer
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div 
            onClick={onNavigateLanding}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <BrandMark compact />
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 sm:inline-block">Local help</span>
          </div>

          {/* Right Action / Status Area */}
          <div className="flex items-center gap-3">
            {/* Realtime Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-100/80 border border-slate-200 text-slate-700">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="flex items-center gap-1 font-semibold">
                <Radio className="w-3.5 h-3.5 text-slate-500" />
                {isConnected ? 'Live updates on' : 'Connecting...'}
              </span>
            </div>

            {/* If unauthenticated, show Home and Sign In buttons */}
            {!user ? (
              <div className="flex items-center gap-2">
                {onNavigateLanding && (
                  <button
                    onClick={onNavigateLanding}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Home</span>
                  </button>
                )}
                {onNavigateLogin && (
                  <button
                    onClick={onNavigateLogin}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Notifications Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-800">Notifications</span>
                        <span className="text-xs text-slate-400">{notifications.length} total</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs">
                            No notifications yet. Realtime events appear here.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => markAsRead(notif.id)}
                              className={`p-3 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                                notif.is_read ? 'opacity-70' : 'bg-indigo-50/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-xs text-slate-900">{notif.title}</span>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Badge & Details */}
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                  <div className="hidden lg:block text-right">
                    <div className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{getRoleBadge(user.role)}</div>
                  </div>

                  <div className="relative group">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/20 shadow-xs"
                    />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${user.is_available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>

                  <button
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
