import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { api } from '../../services/api';
import { Task, TaskCategory, MultiTaskBundle } from '../../types';
import { TaskOfferModal } from '../../components/agent/TaskOfferModal';
import { TaskDetailModal } from '../../components/common/TaskDetailModal';
import { TaskStatusBadge } from '../../components/common/TaskStatusBadge';
import { LiveTrackingMap } from '../../components/common/LiveTrackingMap';
import { ReportDisputeModal } from '../../components/common/ReportDisputeModal';
import { MultiTaskBundleCard } from '../../components/agent/MultiTaskBundleCard';
import { RouteOptimizerModal } from '../../components/agent/RouteOptimizerModal';
import { AIAgentCopilotDrawer } from '../../components/agent/AIAgentCopilotDrawer';
import { 
  Power, 
  MapPin, 
  Navigation, 
  IndianRupee, 
  Star, 
  Play, 
  Camera, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone, 
  Eye,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Compass,
  Radio,
  XCircle,
  Filter,
  CheckCircle,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  Bot
} from 'lucide-react';

const DEMO_PRESETS = [
  { name: 'Hyderabad - Banjara Hills', lat: 17.4156, lng: 78.4350 },
  { name: 'Hyderabad - Madhapur Main Rd', lat: 17.4485, lng: 78.3908 },
  { name: 'Hyderabad - Kondapur Garden', lat: 17.4612, lng: 78.3582 },
  { name: 'Hyderabad - Hitech City Center', lat: 17.4435, lng: 78.3772 },
  { name: 'Hyderabad - Gachibowli Stadium', lat: 17.4399, lng: 78.3489 },
];

export const AgentDashboard: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { lastEvent } = useRealtime();

  const [activeOffer, setActiveOffer] = useState<any>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [nearbyTasks, setNearbyTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);

  // Section 34: Demo Location Mode vs Real GPS
  const [locationMode, setLocationMode] = useState<'GPS' | 'DEMO'>('DEMO');
  const [isSimulatingMovement, setIsSimulatingMovement] = useState(false);
  const [isTrackingGps, setIsTrackingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('GPS standby');
  const simulationTimerRef = useRef<any>(null);
  const gpsWatchRef = useRef<number | null>(null);

  // Section 12: Agent Cancellation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Vehicle breakdown / emergency delay');
  const [isCancelling, setIsCancelling] = useState(false);

  // Task Completion form state
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [proofUrl, setProofUrl] = useState('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Filter state for nearby tasks
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // AI Multi-Task batching & modals
  const [multiTaskOpportunities, setMultiTaskOpportunities] = useState<MultiTaskBundle[]>([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  const fetchAgentData = useCallback(async () => {
    try {
      // 1. Fetch active task offer
      const offerRes = await api.getActiveOffer();
      setActiveOffer(offerRes.offer);

      // 2. Fetch all tasks
      const tasksRes = await api.getTasks({ category: filterCategory !== 'ALL' ? filterCategory : undefined });
      const all = tasksRes.tasks || [];

      const current = all.find(
        (t) => t.assigned_agent_id === user?.id && ['ACCEPTED', 'IN_PROGRESS'].includes(t.status)
      );
      setActiveTask(current || null);

      const completed = all.filter(
        (t) => t.assigned_agent_id === user?.id && ['COMPLETED', 'CONFIRMED'].includes(t.status)
      );
      setCompletedTasks(completed);

      // Available tasks in pool
      const available = all.filter((t) => ['POSTED', 'MATCHING', 'REASSIGNING'].includes(t.status));
      setNearbyTasks(available);

      // 3. Fetch AI multi-task opportunities if agent is available
      try {
        const bundleRes = await api.getMultiTaskOpportunities();
        setMultiTaskOpportunities(bundleRes.bundles || []);
      } catch {
        // Non-blocking
      }
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, filterCategory]);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Reactive updates on WebSocket events
  useEffect(() => {
    if (lastEvent) {
      fetchAgentData();
    }
  }, [lastEvent, fetchAgentData]);

  // Section 34: Movement Simulation logic
  const handleToggleSimulation = () => {
    if (isSimulatingMovement) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      setIsSimulatingMovement(false);
      return;
    }

    if (!activeTask) {
      alert('Please accept an active task first to simulate moving toward the destination.');
      return;
    }

    setIsSimulatingMovement(true);
    simulationTimerRef.current = setInterval(async () => {
      try {
        const res = await api.simulateLocationStep(activeTask.id, 0.20);
        if (res.remainingDistanceKm < 0.08) {
          clearInterval(simulationTimerRef.current);
          setIsSimulatingMovement(false);
        }
      } catch (err) {
        console.error('Simulation step error:', err);
        clearInterval(simulationTimerRef.current);
        setIsSimulatingMovement(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, []);

  // Toggle availability
  const handleToggleAvailability = async () => {
    try {
      await updateProfile({ is_available: !user?.is_available });
    } catch (err) {
      console.error('Failed to update availability:', err);
    }
  };

  const handleLocationSync = useCallback(
    async (latitude: number, longitude: number, address?: string) => {
      const label = address || `Live GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      const res = await api.updateAgentLocation(latitude, longitude, label, activeTask?.id);
      await updateProfile({
        latitude: res.latitude,
        longitude: res.longitude,
        address: label,
      });
      return res;
    },
    [activeTask?.id, updateProfile]
  );

  // Set demo location preset
  const handleSelectPresetLocation = async (preset: typeof DEMO_PRESETS[0]) => {
    try {
      setGpsStatus('Demo hub synced');
      await handleLocationSync(preset.lat, preset.lng, preset.name);
      setLocationMode('DEMO');
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  };

  const handleToggleRealGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('This browser does not support GPS');
      return;
    }

    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      setIsTrackingGps(false);
      setGpsStatus('GPS tracking paused');
      setLocationMode('DEMO');
      return;
    }

    setLocationMode('GPS');
    setIsTrackingGps(true);
    setGpsStatus('Waiting for GPS signal...');

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));

        try {
          await handleLocationSync(latitude, longitude, `Live GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setGpsStatus(`Live GPS synced • ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch (err) {
          console.error('Failed to sync live GPS:', err);
          setGpsStatus('GPS synced failed; retrying...');
        }
      },
      (error) => {
        setIsTrackingGps(false);
        setGpsStatus(`GPS permission or signal issue: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }, [handleLocationSync]);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  // Agent updates status to IN_PROGRESS
  const handleStartTask = async () => {
    if (!activeTask) return;
    try {
      await api.updateTaskStatus(activeTask.id, 'IN_PROGRESS');
      fetchAgentData();
    } catch (err) {
      console.error('Failed to start task:', err);
    }
  };

  // Section 12: Mandatory Agent Cancellation After Acceptance
  const handleConfirmCancellation = async () => {
    if (!activeTask) return;
    setIsCancelling(true);
    try {
      await api.cancelAcceptedTask(activeTask.id, cancelReason);
      setShowCancelModal(false);
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      setIsSimulatingMovement(false);
      fetchAgentData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel task');
    } finally {
      setIsCancelling(false);
    }
  };

  // Complete task
  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setIsSubmittingCompletion(true);
    try {
      await api.updateTaskStatus(activeTask.id, 'COMPLETED', {
        proof_of_completion_url: proofUrl,
        completion_notes: completionNotes || 'Fulfillment confirmed. Proof submitted.',
      });
      setIsCompleting(false);
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      setIsSimulatingMovement(false);
      fetchAgentData();
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const handleAcceptBundle = async (taskId: string) => {
    if (!activeTask) return;
    try {
      await api.acceptBundledTask(taskId);
      fetchAgentData();
    } catch (err: any) {
      alert(err.message || 'Failed to accept task bundle');
    }
  };

  const totalEarnings = completedTasks.reduce((sum, t) => sum + (t.budget || 0), 0);
  const activeTasksCount = activeTask ? 1 : 0;

  return (
    <div className="tm-page space-y-8">
      
      {/* Agent Status Hero */}
      <div className="tm-card flex flex-col justify-between gap-6 border-l-4 border-l-[#0b7285] p-6 sm:p-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}
              alt={user?.name}
              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-slate-100 shadow-md"
            />
            <span
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center ${
                user?.is_available ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            >
              <Power className="w-2.5 h-2.5 text-white" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> VERIFIED AGENT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{user?.address || 'Madhapur, Hyderabad'}</span>
            </p>
          </div>
        </div>

        {/* Online/Offline Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              {user?.is_available ? "You're Online" : 'Offline'}
            </span>
            <button
              onClick={handleToggleAvailability}
              className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
                user?.is_available
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{user?.is_available ? 'Go Offline' : 'Go Online'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 34: DEMO LOCATION MODE & REAL GPS BAR */}
      <div className="tm-gradient-panel space-y-3 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Your availability and location
              </div>
              <p className="text-[11px] text-slate-400">
                Keep your availability and service location up to date for better task suggestions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleRealGps}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                locationMode === 'GPS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isTrackingGps ? 'Stop GPS' : 'Real GPS'}
            </button>
            <button
              type="button"
              onClick={() => setLocationMode('DEMO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                locationMode === 'DEMO' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Demo location
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Demo Starting Hubs:</span>
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleSelectPresetLocation(p)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  user?.address === p.name
                    ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {p.name.replace('Hyderabad - ', '')}
              </button>
            ))}
          </div>

          {activeTask && (
            <button
              type="button"
              onClick={handleToggleSimulation}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0 ${
                isSimulatingMovement
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>
                {isSimulatingMovement ? 'Stop Route Simulation' : 'Start Movement Simulation'}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5 border-t border-slate-800 pt-2 text-[11px] text-slate-300">
          <span className="font-bold uppercase tracking-wider text-indigo-200">GPS status</span>
          <span>{gpsStatus}</span>
        </div>
      </div>

      {/* AI VERIFICATION & WORKLOAD CAPACITY PANEL */}
      <div className="tm-card grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-3">
        {/* Verification Status */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Verification</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                user?.verification_status === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : user?.verification_status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {user?.verification_status || 'VERIFIED'}
              </span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              Trust Score: {user?.verification_score || 96.5}/100
            </div>
          </div>
        </div>

        {/* Skills & Capability Domains */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Verified Skill Domains
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(user?.skills && user.skills.length > 0
              ? user.skills
              : ['Delivery', 'Documents', 'Groceries', 'Quick Errands']
            ).map((s, idx) => (
              <span key={idx} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Concurrent Workload Meter & Route Optimizer button */}
        <div className="flex items-center justify-between md:justify-end gap-4">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Active Workload
            </span>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span className="text-indigo-600 font-black">{activeTasksCount}</span> / {user?.max_concurrent_tasks || 3} Tasks
              <span className="text-[10px] text-slate-400 font-normal">
                ({Math.max(0, (user?.max_concurrent_tasks || 3) - activeTasksCount)} open)
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowRouteModal(true)}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-2xl border border-indigo-200 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Compass className="w-4 h-4 text-indigo-600" />
            <span>Route Optimizer</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="tm-card p-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's earnings</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalEarnings}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Direct bank credit</span>
        </div>

        <div className="tm-card p-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Your rating</span>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-1">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>{user?.rating?.toFixed(1) || '4.9'}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Top 5% agent rank</span>
        </div>

        <div className="tm-card p-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Reliability</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {((user?.reliability_score || 0.98) * 100).toFixed(0)}%
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">High allocation priority</span>
        </div>

        <div className="tm-card p-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Completed tasks</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {(user?.total_completed_tasks || 0) + completedTasks.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total fulfilled</span>
        </div>
      </div>

      {/* AI MULTI-TASK BUNDLING OPPORTUNITIES */}
      {multiTaskOpportunities.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Nearby task suggestions
              </h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
              {multiTaskOpportunities.length} Nearby Compatible
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {multiTaskOpportunities.map((bundle) => (
              <MultiTaskBundleCard
                key={bundle.suggestedTaskId}
                bundle={bundle}
                onAccept={handleAcceptBundle}
                onDismiss={() => {
                  setMultiTaskOpportunities((prev) =>
                    prev.filter((b) => b.suggestedTaskId !== bundle.suggestedTaskId)
                  );
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE MISSION CARD (WITH CANCELLATION & STEPPING) */}
      {activeTask && (
        <div className="tm-card space-y-6 border-2 border-[#0b7285] p-6 shadow-xl sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">
                  Current task
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {activeTask.title}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <TaskStatusBadge status={activeTask.status} size="lg" />
              <button
                onClick={() => setInspectTaskId(activeTask.id)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Inspect Task Audit Engine"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mission Details & Customer Info */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Pickup Location:</span>
                    <p className="mt-0.5">{activeTask.pickup_location}</p>
                  </div>
                </div>

                {activeTask.destination_location && (
                  <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-200">
                    <Navigation className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Destination:</span>
                      <p className="mt-0.5">{activeTask.destination_location}</p>
                    </div>
                  </div>
                )}

                {activeTask.description && (
                  <p className="pt-2 border-t border-slate-200 text-slate-600 italic">
                    "{activeTask.description}"
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">
                    Customer: {activeTask.customer_name || 'Rahul'}
                  </span>
                </div>
                <a
                  href={`tel:${activeTask.customer_phone || '+919876543210'}`}
                  className="text-xs font-bold text-emerald-700 flex items-center gap-1 hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {activeTask.customer_phone || '+91 98765 43210'}
                </a>
              </div>

              {/* AI Arrival Prediction & ETA */}
              <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 block">
                      Estimated travel time
                    </span>
                    <span className="text-xs font-black text-indigo-950">
                      ~{activeTask.estimated_arrival_minutes || 14} mins estimated
                    </span>
                  </div>
                </div>
                {activeTask.estimated_arrival_minutes && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-200 font-mono shadow-2xs">
                    ETA: ~{activeTask.estimated_arrival_minutes}m
                  </span>
                )}
              </div>

              {/* AI Transparent Allocation Explanation */}
              {activeTask.ai_matching_explanation && (
                <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-2xl border border-indigo-100/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Why this task fits you:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    "{activeTask.ai_matching_explanation}"
                  </p>
                </div>
              )}
            </div>

            {/* Workflow Action Panel */}
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-sky-50 rounded-2xl border border-indigo-100 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 block mb-1">
                  Fulfillment Actions
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeTask.status === 'ACCEPTED'
                    ? 'Task accepted. Click "Start Task" when moving to the pickup location.'
                    : 'Task is in progress. Complete delivery and upload proof to receive payment.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-indigo-200/60 flex flex-col gap-2.5">
                {activeTask.status === 'ACCEPTED' ? (
                  <button
                    onClick={handleStartTask}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Task (En Route)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCompleting(true)}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete Task & Upload Proof</span>
                  </button>
                )}

                {/* SECTION 12: MANDATORY AGENT CANCELLATION BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-2 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel This Task (Triggers Auto-Reassignment)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 12: CONFIRM CANCELLATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Cancel Accepted Task?
                </h3>
                <p className="text-[11px] text-slate-500">
                  Your cancellation will cause the task to be automatically reassigned to another nearby agent.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 cursor-pointer"
              >
                <option value="Vehicle breakdown / flat tire">Vehicle breakdown / mechanical issue</option>
                <option value="Personal medical emergency">Personal emergency</option>
                <option value="Severe weather / impassable road">Severe weather / traffic blockage</option>
                <option value="Unable to contact customer / missing details">Unable to reach customer</option>
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-900">
              The customer will be notified and the next suitable provider will receive a real-time offer.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Keep Task
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                disabled={isCancelling}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Reassigning...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETION PROOF MODAL */}
      {isCompleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Complete Task & Upload Proof
            </h3>
            <p className="text-xs text-slate-500">
              Provide a completion note and proof photo to release payment.
            </p>

            <form onSubmit={handleSubmitCompletion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Completion Notes
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Handed over package directly to customer."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Proof Photo URL
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 h-28">
                  <img src={proofUrl} alt="Proof" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompleting(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCompletion}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCompletion ? 'Submitting...' : 'Submit & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETED TASKS HISTORY */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Completed tasks</h3>
            <p className="text-xs text-slate-500">Successfully fulfilled tasks and earned payouts</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
            {completedTasks.length} Done
          </span>
        </div>

        {completedTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No completed tasks yet. Completed requests and earnings will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Earned</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{t.title}</td>
                    <td className="py-3.5 px-4 text-slate-600">{t.pickup_location}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">₹{t.budget}</td>
                    <td className="py-3.5 px-4"><TaskStatusBadge status={t.status} size="sm" /></td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setInspectTaskId(t.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Realtime Offer Modal */}
      {activeOffer && (
        <TaskOfferModal
          offer={activeOffer}
          onAccepted={() => {
            setActiveOffer(null);
            fetchAgentData();
          }}
          onDeclined={() => {
            setActiveOffer(null);
            fetchAgentData();
          }}
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
        />
      )}

      {/* AI Route Optimizer Modal */}
      {showRouteModal && (
        <RouteOptimizerModal onClose={() => setShowRouteModal(false)} />
      )}

      {/* Floating AI Copilot Trigger */}
      <button
        onClick={() => setShowCopilot(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-xl flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105 border-2 border-emerald-300/40"
        title="Open AI Agent Copilot"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-extrabold hidden sm:inline">AI Copilot</span>
      </button>

      {/* AI Agent Copilot Drawer */}
      <AIAgentCopilotDrawer
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
        onAction={(action) => {
          if (action === 'VIEW_ROUTE') {
            setShowRouteModal(true);
          }
        }}
      />

    </div>
  );
};
