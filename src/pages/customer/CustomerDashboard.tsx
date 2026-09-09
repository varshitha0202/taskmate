import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { api } from '../../services/api';
import { Task, TaskCategory, CustomerWallet, WalletTransaction, CustomerRecommendation } from '../../types';
import { CreateTaskModal } from '../../components/customer/CreateTaskModal';
import { ReviewModal } from '../../components/customer/ReviewModal';
import { TaskDetailModal } from '../../components/common/TaskDetailModal';
import { TaskStatusBadge } from '../../components/common/TaskStatusBadge';
import { LiveTrackingMap } from '../../components/common/LiveTrackingMap';
import { ReportDisputeModal } from '../../components/common/ReportDisputeModal';
import { CustomerWalletModal } from '../../components/customer/CustomerWalletModal';
import { AICustomerAssistantDrawer } from '../../components/customer/AICustomerAssistantDrawer';
import { CustomerAccountView, AccountView } from '../../components/customer/CustomerAccountView';
import { 
  Plus, 
  MapPin, 
  Navigation, 
  Phone, 
  Star, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  Sparkles,
  ShieldCheck,
  FileText,
  Truck,
  ShoppingBag,
  BookOpen,
  Wrench,
  Home,
  Laptop,
  PlusCircle,
  Radio,
  Clock,
  ShieldAlert,
  Compass,
  ArrowRight,
  Wallet,
  Gift,
  Award,
  Bot,
  RotateCcw,
  Zap,
  UserCircle,
  CalendarDays,
  HelpCircle,
  Home as HomeIcon
} from 'lucide-react';

const CATEGORY_CARDS: { id: TaskCategory; name: string; description: string; icon: any; color: string }[] = [
  { id: 'documents', name: 'Documents', description: 'Send or collect items.', icon: FileText, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'delivery', name: 'Delivery', description: 'Move something nearby.', icon: Truck, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'shopping', name: 'Shopping', description: 'Get your list done.', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'repair', name: 'Repairs', description: 'Fix an everyday problem.', icon: Wrench, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'home_help', name: 'Home help', description: 'A hand around the house.', icon: Home, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'digital', name: 'Digital help', description: 'Get help with tech.', icon: Laptop, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'errand', name: 'Errands', description: 'Tick something off your list.', icon: BookOpen, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'other', name: 'Other help', description: 'Tell us what you need.', icon: PlusCircle, color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const distanceBetween = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const earthRadius = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return (earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

export const CustomerDashboard: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { lastEvent, notifications } = useRealtime();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [recommendations, setRecommendations] = useState<CustomerRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAssistantDrawer, setShowAssistantDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | undefined>(undefined);
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [isRebooking, setIsRebooking] = useState(false);
  const [customerView, setCustomerView] = useState<AccountView | 'HOME'>('HOME');

  // Live coordinates for assigned helper
  const [liveAgentCoords, setLiveAgentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [tasksRes, walletRes, recsRes] = await Promise.all([
        api.getTasks(),
        api.getWallet(),
        api.getCustomerRecommendations(),
      ]);
      setTasks(tasksRes.tasks || []);
      setWallet(walletRes.wallet || null);
      setWalletTransactions(walletRes.transactions || []);
      setRecommendations(recsRes.recommendations || null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Reactive updates on WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'AGENT_LOCATION_UPDATED') {
      const { agentId, latitude, longitude, taskId } = lastEvent.payload;
      if (activeTask && (activeTask.assigned_agent_id === agentId || activeTask.id === taskId)) {
        setLiveAgentCoords({ lat: latitude, lng: longitude });
      }
    } else {
      fetchDashboardData();
    }
  }, [lastEvent, fetchDashboardData]);

  const handleOpenCategory = (catId: TaskCategory) => {
    setSelectedCategory(catId);
    setShowCreateModal(true);
  };

  const handleConfirmCompletion = async (task: Task) => {
    try {
      await api.confirmTaskCompletion(task.id);
      fetchDashboardData();
      if (task.assigned_agent_id) {
        setReviewTask(task);
      }
    } catch (err) {
      console.error('Failed to confirm task:', err);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to cancel this task?')) return;
    try {
      await api.cancelTask(taskId);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const handleSmartRebook = async (task: Task) => {
    setIsRebooking(true);
    try {
      await api.smartRebookTask(task.id, 'Priority AI Smart Rebooking');
      fetchDashboardData();
    } catch (err) {
      console.error('Smart rebook failed:', err);
    } finally {
      setIsRebooking(false);
    }
  };

  // Identify active task spotlight (including UNSUCCESSFUL_REQUEST for compensation receipt)
  const activeTask = tasks.find((t) =>
    ['POSTED', 'MATCHING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNING', 'UNSUCCESSFUL_REQUEST'].includes(t.status)
  );

  const recentTasks = tasks.filter((t) => t.id !== activeTask?.id);

  // Sync initial agent coordinates if available
  useEffect(() => {
    const lastSharedAt = activeTask?.agent_location_at ? new Date(activeTask.agent_location_at).getTime() : 0;
    const isRecentLocation = lastSharedAt > 0 && Date.now() - lastSharedAt <= 10 * 60 * 1000;
    if (isRecentLocation && activeTask?.agent_live_lat !== undefined && activeTask?.agent_live_lng !== undefined) {
      setLiveAgentCoords({
        lat: activeTask.agent_live_lat,
        lng: activeTask.agent_live_lng,
      });
    } else {
      setLiveAgentCoords(null);
    }
  }, [activeTask]);

  return (
    <div className="tm-page space-y-8 relative">
      <nav className="customer-nav sticky top-20 z-30 -mx-1 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur-md sm:static sm:mx-0 sm:w-fit">
        {[
          { id: 'HOME' as const, label: 'Home', icon: HomeIcon },
          { id: 'BOOKINGS' as const, label: 'Bookings', icon: CalendarDays },
          { id: 'POINTS' as const, label: 'Points', icon: Award },
          { id: 'HELP' as const, label: 'Help', icon: HelpCircle },
          { id: 'PROFILE' as const, label: 'Profile', icon: UserCircle },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = customerView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCustomerView(item.id)}
              className={`flex min-w-[74px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors sm:min-w-0 ${
                isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {customerView !== 'HOME' && user ? (
        <CustomerAccountView
          view={customerView}
          user={user}
          wallet={wallet}
          transactions={walletTransactions}
          tasks={tasks}
          notifications={notifications}
          onUpdateProfile={updateProfile}
          onViewBooking={(taskId) => setInspectTaskId(taskId)}
          onOpenAssistant={() => setShowAssistantDrawer(true)}
          onLogout={logout}
        />
      ) : null}

      {customerView === 'HOME' && <>
      
      {/* Consumer Hero Banner */}
      <div className="tm-gradient-panel relative overflow-hidden rounded-[2rem] p-6 text-white shadow-xl sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[#f6c267]/20" />
        <div className="pointer-events-none absolute -bottom-24 right-20 h-52 w-52 rounded-full border-[18px] border-white/10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-teal-100 backdrop-blur-xs">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user?.address || 'Hitech City, Hyderabad'}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              What do you need help with today?
            </h1>
            <p className="max-w-xl text-xs leading-relaxed text-slate-100/85 sm:text-sm">
              Book a trusted local service provider in just a few simple steps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            <button
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-xs font-bold text-white shadow-md backdrop-blur-xs transition-all hover:bg-white/20"
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>My balance (₹{wallet?.refund_balance || 0})</span>
            </button>

            <button
              onClick={() => {
                setSelectedCategory(undefined);
                setShowCreateModal(true);
              }}
              className="px-7 py-3.5 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-indigo-500/25 hover:scale-102 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Book a Service</span>
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOMER PRIORITY POINTS & REWARDS BAR */}
      {wallet && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  {wallet.priority_tier}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-600 font-semibold">
                  Points can help with future bookings
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{wallet.reward_points}</span>
                <span className="text-xs text-slate-500 font-medium">My Points</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Your priority</span>
              <span className="text-xs font-semibold text-emerald-600">{wallet.priority_tier}</span>
            </div>
            <button
              onClick={() => setShowWalletModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>View points & balance</span>
            </button>
          </div>
        </div>
      )}

      {/* QUICK CATEGORY SELECTOR CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Popular services
          </h2>
          <span className="text-xs text-slate-400">Choose a service to get started</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORY_CARDS.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleOpenCategory(cat.id)}
                className="group flex min-h-[154px] flex-col items-center justify-center gap-2 rounded-3xl border bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-teal-400 hover:shadow-lg"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${cat.color} transition-transform group-hover:scale-110`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="w-full truncate text-sm font-extrabold text-slate-800 transition-colors group-hover:text-teal-700">
                  {cat.name}
                </span>
                <span className="text-[11px] leading-tight text-slate-500">{cat.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE TASK SPOTLIGHT / LIVE TRACKING */}
      {activeTask && (
        <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 relative overflow-hidden space-y-6 ${
          activeTask.status === 'UNSUCCESSFUL_REQUEST' ? 'border-rose-400' : 'border-indigo-500'
        }`}>
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs font-extrabold uppercase tracking-widest ${
                  activeTask.status === 'UNSUCCESSFUL_REQUEST' ? 'text-rose-600' : 'text-indigo-600'
                }`}>
                  {activeTask.status === 'UNSUCCESSFUL_REQUEST'
                    ? 'We could not find a provider'
                    : activeTask.status === 'REASSIGNING'
                      ? 'Finding another provider...'
                      : 'Current booking'}
                </span>
                {activeTask.status !== 'UNSUCCESSFUL_REQUEST' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {activeTask.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  {activeTask.pickup_location}
                </span>
                <span>•</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹{activeTask.budget}</span>
                <span>•</span>
                <span className="font-semibold capitalize">{activeTask.category}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TaskStatusBadge status={activeTask.status} size="lg" />
              <button
                onClick={() => setInspectTaskId(activeTask.id)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="View booking details"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Booking details</span>
              </button>
              <button
                onClick={() => setReportTaskId(activeTask.id)}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Trust & Safety Help"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* UNSUCCESSFUL SERVICE REQUEST COMPENSATION BANNER */}
          {activeTask.status === 'UNSUCCESSFUL_REQUEST' && (
            <div className="p-6 bg-gradient-to-br from-rose-50/90 to-amber-50/80 rounded-2xl border border-rose-200 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-rose-950">
                    Unsuccessful Request — Fair Compensation Deposited
                  </h3>
                  <p className="text-xs text-rose-800/90 leading-relaxed">
                    Our AI dispatch engine checked available verified helpers within an expanded 25 km radius. No agent was available in time. As per our platform guarantee:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-white font-bold text-emerald-700 border border-emerald-200">
                      Full refund of ₹{activeTask.budget} to wallet
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white font-bold text-sky-700 border border-sky-200">
                      ₹50 inconvenience service credit
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white font-bold text-amber-700 border border-amber-200">
                      100 compensation points
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-rose-200/60">
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  View Wallet Balance & History →
                </button>

                <button
                  onClick={() => handleSmartRebook(activeTask)}
                  disabled={isRebooking}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRebooking ? 'animate-spin' : ''}`} />
                  <span>{isRebooking ? 'Rebooking...' : '1-Click AI Smart Rebook'}</span>
                </button>
              </div>
            </div>
          )}

          {/* AI MATCHING IN PROGRESS (When Searching or Reassigning) */}
          {['MATCHING', 'OFFERED', 'REASSIGNING'].includes(activeTask.status) && (
            <div className="p-6 bg-gradient-to-br from-indigo-50/90 to-sky-50/70 rounded-2xl border border-indigo-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-spin">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-extrabold text-indigo-950">
                    {activeTask.status === 'REASSIGNING'
                      ? 'Finding another provider...'
                      : 'Finding the best person for you'}
                  </h3>
                  <p className="text-xs text-indigo-700/80 mt-0.5">
                    We are checking nearby trusted providers and will update you as soon as someone accepts.
                  </p>
                </div>
              </div>

              {/* Progress Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-indigo-100">
                <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Task Posted</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Radius Checked ({activeTask.search_radius_km || 15} km)</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified Helpers Scored</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600 font-bold animate-pulse">
                  <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Awaiting Acceptance...</span>
                </div>
              </div>
            </div>
          )}

          {/* AI TRANSPARENT MATCHING EXPLANATION CARD (When Helper Assigned) */}
          {activeTask.ai_matching_explanation && activeTask.assigned_agent_id && (
            <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-2xl border border-indigo-100 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                    Why this provider was chosen
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Arrives in about {activeTask.estimated_arrival_minutes || 15} mins
                  </span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                  {activeTask.ai_matching_explanation}
                </p>
              </div>
            </div>
          )}

          {/* LIVE TRACKING MAP & ASSIGNED HELPER CARD */}
          {activeTask.assigned_agent_id && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Live booking updates
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {liveAgentCoords ? `${distanceBetween(liveAgentCoords, { lat: activeTask.pickup_latitude, lng: activeTask.pickup_longitude })} km away` : 'Waiting for provider location'}
                </span>
              </div>

              {/* Interactive OpenStreetMap */}
              <LiveTrackingMap
                pickupLocation={{
                  lat: activeTask.pickup_latitude,
                  lng: activeTask.pickup_longitude,
                  label: activeTask.pickup_location,
                }}
                destinationLocation={
                  activeTask.destination_latitude && activeTask.destination_longitude
                    ? {
                        lat: activeTask.destination_latitude,
                        lng: activeTask.destination_longitude,
                        label: activeTask.destination_location,
                      }
                    : undefined
                }
                agentLocation={liveAgentCoords || undefined}
                agentName={activeTask.agent_name || 'Agent'}
                agentAvatar={activeTask.agent_avatar}
                height="320px"
              />

              {/* Assigned Agent Details Bar */}
              <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/70 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={activeTask.agent_avatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}
                    alt="Agent"
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/20 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{activeTask.agent_name}</h4>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3 h-3" /> Trusted provider
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {activeTask.agent_rating?.toFixed(1) || '4.9'}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                          {activeTask.status === 'IN_PROGRESS' ? 'On the way' : 'Booking accepted'}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-700">
                        ~{activeTask.estimated_completion_minutes || 45} min total
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${activeTask.agent_phone || '+919876511111'}`}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Contact Agent</span>
                  </a>

                  {activeTask.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleConfirmCompletion(activeTask)}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm service</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stepper Progress Bar */}
          {activeTask.status !== 'UNSUCCESSFUL_REQUEST' && (
            <div className="pt-2 border-t border-slate-100">
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold">
                {[
                    { key: 'POSTED', label: 'Booking requested' },
                    { key: 'MATCHING', label: 'Finding provider' },
                    { key: 'ACCEPTED', label: 'Provider assigned' },
                    { key: 'IN_PROGRESS', label: 'Service in progress' },
                    { key: 'COMPLETED', label: 'Service completed' },
                ].map((step) => {
                  const statusOrder = ['POSTED', 'MATCHING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CONFIRMED'];
                  const currentIdx = statusOrder.indexOf(activeTask.status);
                  const stepIdx = statusOrder.indexOf(step.key);
                  const isPassed = currentIdx >= stepIdx;

                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          isPassed ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isPassed ? <CheckCircle2 className="w-4 h-4" /> : '•'}
                      </div>
                      <span className={`mt-1.5 text-[10px] sm:text-xs truncate ${isPassed ? 'text-indigo-900 font-bold' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancel button if not completed */}
          {['POSTED', 'MATCHING', 'OFFERED', 'REASSIGNING'].includes(activeTask.status) && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleCancelTask(activeTask.id)}
                className="text-rose-600 hover:text-rose-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Request</span>
              </button>
            </div>
          )}

        </div>
      )}

      {/* AI PERSONALIZED RECOMMENDATIONS */}
      {recommendations && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recommended for you</h3>
                <p className="text-xs text-slate-500">Services based on your booking history</p>
              </div>
            </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              For you
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recommendations.recommendedCategories.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                onClick={() => handleOpenCategory(rec.id as TaskCategory)}
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">{rec.name}</span>
                  <span className="text-[11px] text-slate-500 mt-1 block">{rec.reason}</span>
                </div>
                <div className="mt-3 flex items-center text-xs font-bold text-indigo-600 gap-1">
                  <span>Book Now</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECENT TASK HISTORY */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent bookings</h3>
            <p className="text-xs text-slate-500">Your past services and booking activity</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
            {tasks.length} Total
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            You have not booked a service yet. Start with your first booking.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTasks.map((t) => (
              <div key={t.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 p-2 rounded-2xl transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TaskStatusBadge status={t.status} size="sm" />
                    <span className="text-xs font-bold text-slate-900">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {t.pickup_location.split(',')[0]}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-emerald-600">₹{t.budget}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInspectTaskId(t.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    View Details
                  </button>
                  {t.status === 'UNSUCCESSFUL_REQUEST' && (
                    <button
                      onClick={() => handleSmartRebook(t)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      Rebook
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </>}

      {/* FLOATING AI ASSISTANT TRIGGER BUTTON */}
      <button
        onClick={() => setShowAssistantDrawer(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs rounded-2xl shadow-2xl shadow-indigo-500/40 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
        title="Open TaskMate Assistant"
      >
        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <span>Help me</span>
      </button>

      {/* MODALS & DRAWERS */}
      {showCreateModal && (
        <CreateTaskModal
          initialCategory={selectedCategory}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchDashboardData();
          }}
        />
      )}

      {showWalletModal && (
        <CustomerWalletModal
          wallet={wallet}
          transactions={walletTransactions}
          onClose={() => setShowWalletModal(false)}
        />
      )}

      {inspectTaskId && (
        <TaskDetailModal
          taskId={inspectTaskId}
          onClose={() => setInspectTaskId(null)}
        />
      )}

      {reportTaskId && (
        <ReportDisputeModal
          taskId={reportTaskId}
          onClose={() => setReportTaskId(null)}
          onReported={() => {
            setReportTaskId(null);
            fetchDashboardData();
          }}
        />
      )}

      {reviewTask && (
        <ReviewModal
          taskId={reviewTask.id}
          agentName={reviewTask.agent_name || 'Agent'}
          onClose={() => setReviewTask(null)}
          onReviewed={() => {
            setReviewTask(null);
            fetchDashboardData();
          }}
        />
      )}

      <AICustomerAssistantDrawer
        isOpen={showAssistantDrawer}
        onClose={() => setShowAssistantDrawer(false)}
        onAction={(action) => {
          if (action === 'CREATE_TASK') setShowCreateModal(true);
          if (action === 'VIEW_WALLET') setShowWalletModal(true);
          if (action === 'CONTACT_SUPPORT') {
            const supportTask = activeTask || recentTasks[0];
            if (supportTask) setReportTaskId(supportTask.id);
          }
        }}
      />

    </div>
  );
};
