import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { api } from '../../services/api';
import { Task, Profile, AdminStats, AgentVerification, FraudAlert } from '../../types';
import { TaskDetailModal } from '../../components/common/TaskDetailModal';
import { TaskStatusBadge } from '../../components/common/TaskStatusBadge';
import { LiveTrackingMap } from '../../components/common/LiveTrackingMap';
import { AgentVerificationModal } from '../../components/admin/AgentVerificationModal';
import { AIMatchingConfigModal } from '../../components/admin/AIMatchingConfigModal';
import { AIFraudRadarCard } from '../../components/admin/AIFraudRadarCard';
import { 
  Users, 
  Briefcase, 
  Activity, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  RotateCcw, 
  Eye, 
  MapPin, 
  Star, 
  Search, 
  Radio,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  ShieldAlert,
  Compass,
  Sliders,
  Sparkles,
  UserCheck
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { lastEvent } = useRealtime();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [verifications, setVerifications] = useState<AgentVerification[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);

  // Modals
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, tasksRes, agentsRes, verifRes, fraudRes] = await Promise.all([
        api.getAdminStats(),
        api.getTasks(),
        api.getAgents(),
        api.getAdminVerifications(),
        api.getFraudAlerts(),
      ]);

      setStats(statsRes.stats);
      setTasks(tasksRes.tasks || []);
      setAgents(agentsRes.agents || []);
      setVerifications(verifRes.verifications || []);
      setFraudAlerts(fraudRes.alerts || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  useEffect(() => {
    if (lastEvent) {
      fetchAdminData();
    }
  }, [lastEvent, fetchAdminData]);

  const handleResetDemo = async () => {
    if (!confirm('Reset demo database to original seed state? This restores clean demo accounts and resets tasks.')) {
      return;
    }
    setIsResetting(true);
    try {
      await api.resetDemoData();
      fetchAdminData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const pendingVerificationsCount = verifications.filter((v) => v.status === 'PENDING').length;

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'MATCHING' && !['POSTED', 'MATCHING', 'OFFERED', 'REASSIGNING'].includes(t.status)) return false;
      if (filterStatus === 'ACTIVE' && !['ACCEPTED', 'IN_PROGRESS'].includes(t.status)) return false;
      if (filterStatus === 'COMPLETED' && !['COMPLETED', 'CONFIRMED'].includes(t.status)) return false;
      if (filterStatus === 'UNSUCCESSFUL_REQUEST' && t.status !== 'UNSUCCESSFUL_REQUEST') return false;
      if (!['MATCHING', 'ACTIVE', 'COMPLETED', 'UNSUCCESSFUL_REQUEST'].includes(filterStatus) && t.status !== filterStatus) return false;
    }

    if (filterCategory !== 'ALL' && t.category !== filterCategory) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCustomer = t.customer_name?.toLowerCase().includes(q);
      const matchAgent = t.agent_name?.toLowerCase().includes(q);
      const matchLocation = t.pickup_location?.toLowerCase().includes(q);
      if (!matchTitle && !matchCustomer && !matchAgent && !matchLocation) return false;
    }

    return true;
  });

  return (
    <div className="tm-page space-y-8">
      
      {/* Top Operations Header */}
      <div className="tm-gradient-panel flex flex-col justify-between gap-6 rounded-[2rem] p-6 text-white shadow-xl sm:p-8 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Operations Command Center
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            TaskMate overview
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Review users, bookings, providers, and safety activity from one clear workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          {/* AI Verification Queue Button */}
          <button
            onClick={() => setShowVerificationModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-2 cursor-pointer relative"
          >
            <UserCheck className="w-4 h-4" />
            <span>AI Verification</span>
            {pendingVerificationsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce">
                {pendingVerificationsCount}
              </span>
            )}
          </button>

          {/* AI Matching & Policy Config */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-2xl border border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>AI Matching & Policy</span>
          </button>

          {/* Reset Demo Button */}
          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-2xl border border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Reset database to initial pristine demo state"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Resetting DB...' : 'Reset Demo'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="tm-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Booking value</span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">₹{stats.totalTaskValue}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Completed value</span>
          </div>

          <div className="tm-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Active bookings</span>
              <Activity className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-600">{stats.activeTasks}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Currently active</span>
          </div>

          <div className="tm-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Finding providers</span>
              <Search className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">{stats.matchingTasks}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Offers & reassignments</span>
          </div>

          <div className="tm-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Available providers</span>
              <Briefcase className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {stats.activeAgents} / {stats.totalAgents}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Verified agents online</span>
          </div>
        </div>
      )}

      {/* AI FRAUD RADAR OVERVIEW */}
      <AIFraudRadarCard
        alerts={fraudAlerts}
        onResolved={fetchAdminData}
      />

      {/* LIVE TASKS STREAM SECTION */}
      <div className="tm-card space-y-6 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900">Bookings</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click "Inspect Engine" on any task to inspect its full multi-agent reassignment chain
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks, helpers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 w-44"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="MATCHING">Matching / Offered / Reassigning</option>
              <option value="ACTIVE">Active (Accepted / In Progress)</option>
              <option value="COMPLETED">Completed / Confirmed</option>
              <option value="UNSUCCESSFUL_REQUEST">Unsuccessful / Compensated Requests</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No tasks match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Task Info</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Reward</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Helper</th>
                  <th className="py-3 px-4 text-right">Audit Engine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                      <div className="truncate">{t.title}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {t.customer_name || 'Customer'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {t.pickup_location}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      ₹{t.budget}
                    </td>
                    <td className="py-3.5 px-4">
                      <TaskStatusBadge status={t.status} size="sm" />
                      {t.status === 'UNSUCCESSFUL_REQUEST' && (
                        <div className="text-[10px] text-amber-700 font-bold mt-1">
                          Compensated: {t.compensation_status || 'COMPENSATED'} (Radius: {t.search_radius_km || 15}km)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {t.agent_name ? (
                        <span className="font-semibold text-indigo-700">{t.agent_name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Evaluating candidates</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setInspectTaskId(t.id)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Engine</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AGENT FLEET TELEMETRY & RATINGS */}
      <div className="tm-card space-y-6 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Service providers</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time status of all verified field agents</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
            {agents.length} Total Agents
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all shadow-2xs space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={agent.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}
                    alt={agent.name}
                    className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100"
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                      agent.is_available ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{agent.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center text-amber-500 font-bold">
                      <Star className="w-3 h-3 fill-amber-500 mr-0.5" />
                      {agent.rating?.toFixed(1) || '4.9'}
                    </span>
                    <span>•</span>
                    <span className="text-indigo-600 font-semibold">
                      {((agent.reliability_score || 0.98) * 100).toFixed(0)}% Rel.
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{agent.address || 'Hyderabad'}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Coordinates: {agent.latitude?.toFixed(4)}, {agent.longitude?.toFixed(4)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">
                  Active Tasks: <strong>{agent.active_task_count || 0}</strong>
                </span>
                <span className="text-slate-500">
                  Completed: <strong>{agent.total_completed_tasks || 0}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inspector Modal */}
      {inspectTaskId && (
        <TaskDetailModal
          taskId={inspectTaskId}
          onClose={() => setInspectTaskId(null)}
        />
      )}

      {/* Agent Verification Modal */}
      {showVerificationModal && (
        <AgentVerificationModal
          verifications={verifications}
          onClose={() => setShowVerificationModal(false)}
          onUpdated={fetchAdminData}
        />
      )}

      {/* AI Matching & Policy Config Modal */}
      {showConfigModal && (
        <AIMatchingConfigModal
          onClose={() => setShowConfigModal(false)}
          onSaved={fetchAdminData}
        />
      )}

    </div>
  );
};
