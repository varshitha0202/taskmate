import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  User, 
  Briefcase,
  Compass
} from 'lucide-react';
import { BrandMark } from '../../components/common/BrandMark';

interface Props {
  onNavigateRegister: () => void;
  onNavigateLanding?: () => void;
}

const DEMO_ACCOUNTS = [
  {
    role: 'CUSTOMER',
    label: 'Customer (Rahul)',
    email: 'customer@taskmate.com',
    pass: 'TaskMate@123',
    desc: 'Hitech City • Post & track tasks',
    icon: <User className="w-3.5 h-3.5 text-indigo-600" />,
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    role: 'AGENT',
    label: 'Agent A (Vikram)',
    email: 'agent.a@taskmate.com',
    pass: 'TaskMate@123',
    desc: '1.8 km away • Rating 4.9',
    icon: <Briefcase className="w-3.5 h-3.5 text-emerald-600" />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    role: 'AGENT',
    label: 'Agent B (Priya)',
    email: 'agent.b@taskmate.com',
    pass: 'TaskMate@123',
    desc: '3.5 km away • Rating 4.7',
    icon: <Briefcase className="w-3.5 h-3.5 text-teal-600" />,
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    role: 'AGENT',
    label: 'Agent C (Arjun)',
    email: 'agent.c@taskmate.com',
    pass: 'TaskMate@123',
    desc: '6.2 km away • Rating 4.8',
    icon: <Briefcase className="w-3.5 h-3.5 text-sky-600" />,
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    role: 'ADMIN',
    label: 'Admin (Operations)',
    email: 'admin@taskmate.com',
    pass: 'TaskMate@123',
    desc: 'Full visibility & audit log',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />,
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

export const LoginPage: React.FC<Props> = ({ onNavigateRegister, onNavigateLanding }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    if (!loginEmail || !loginPass) {
      setError('Please fill in both email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(loginEmail, loginPass);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demo: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(demo.email);
    setPassword(demo.pass);
    handleLogin(undefined, demo.email, demo.pass);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
      <div className="max-w-xl w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Card */}
        <div className="text-center">
          {onNavigateLanding && (
            <button
              type="button"
              onClick={onNavigateLanding}
              className="mb-4 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              ← Back to TaskMate Homepage
            </button>
          )}
          <div className="mb-4 flex justify-center"><BrandMark /></div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-xs text-slate-500 mt-1">
            Book trusted local help without the hassle.
          </p>
        </div>

        {/* 1-Click Multi-Device Demo Switcher */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Compass className="w-4 h-4 text-indigo-600" />
              <span>Instant Multi-Device Demonstration Logins:</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              REAL BACKEND AUTH
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            Click any demo profile to instantly authenticate. Open another laptop or browser window to test the live multi-user workflow!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => handleQuickLogin(demo)}
                className="p-3 text-left rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 transition-all group flex items-start justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    {demo.icon}
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {demo.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{demo.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Standard Credentials Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Or sign in manually</h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@taskmate.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500">Don't have an account yet? </span>
            <button
              onClick={onNavigateRegister}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Register as Customer or Agent
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
