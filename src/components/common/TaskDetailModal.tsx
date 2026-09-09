import React, { useState, useEffect } from 'react';
import { Task, TaskAssignment, TaskEvent } from '../../types';
import { api } from '../../services/api';
import { TaskStatusBadge } from './TaskStatusBadge';
import { LiveTrackingMap } from './LiveTrackingMap';
import { 
  X, 
  MapPin, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  BarChart2, 
  ArrowRight, 
  Radio, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';

interface Props {
  taskId: string;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<Props> = ({ taskId, onClose }) => {
  const [data, setData] = useState<{
    task: Task;
    assignments: TaskAssignment[];
    events: TaskEvent[];
    review?: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDetails();
  }, [taskId]);

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTaskById(taskId);
      setData(res);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-700">Loading task inspector...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { task, assignments, events, review } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <TaskStatusBadge status={task.status} />
            <span className="text-xs text-slate-400 font-mono">TASK #{task.id.slice(0, 8)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Main Info */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{task.title}</h2>
            {task.description && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {task.description}
              </p>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Budget</span>
              <span className="text-lg font-bold text-emerald-600">₹{task.budget}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Category</span>
              <span className="text-sm font-bold text-slate-800 capitalize">{task.category}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Priority</span>
              <span className="text-sm font-bold text-slate-800">{task.priority}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Customer</span>
              <span className="text-sm font-bold text-slate-800 truncate">{task.customer_name || 'Customer'}</span>
            </div>
          </div>

          {/* Live Map Telemetry in Inspector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Live Telemetry & Route Map
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {task.assigned_agent_id ? 'Provider assigned' : 'Waiting for assignment'}
              </span>
            </div>
            <LiveTrackingMap
              pickupLocation={{
                lat: task.pickup_latitude,
                lng: task.pickup_longitude,
                label: task.pickup_location,
              }}
              destinationLocation={
                task.destination_latitude && task.destination_longitude
                  ? {
                      lat: task.destination_latitude,
                      lng: task.destination_longitude,
                      label: task.destination_location,
                    }
                  : undefined
              }
              agentLocation={
                (task as any).agent_lat && (task as any).agent_lng
                  ? { lat: (task as any).agent_lat, lng: (task as any).agent_lng }
                  : undefined
              }
              agentName={task.agent_name || 'Agent'}
              height="240px"
            />
          </div>

          {/* Assignment History / Reassignment Audit Trail */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                Multi-Agent Allocation & Reassignment Audit Trail
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {assignments.length} {assignments.length === 1 ? 'Attempt' : 'Attempts'}
              </span>
            </div>

            {assignments.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-100">
                No assignment attempts recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {assignments.map((assignment, index) => {
                  const breakdown = assignment.score_breakdown;
                  let badge = (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      OFFERED
                    </span>
                  );
                  if (assignment.status === 'ACCEPTED') {
                    badge = (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> ACCEPTED
                      </span>
                    );
                  } else if (assignment.status === 'REJECTED') {
                    badge = (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> DECLINED / REJECTED
                      </span>
                    );
                  } else if (assignment.status === 'CANCELLED_BY_AGENT') {
                    badge = (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> CANCELLED BY AGENT
                      </span>
                    );
                  }

                  return (
                    <div
                      key={assignment.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              {assignment.agent_name || 'Agent'}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-2">
                              Rating {assignment.agent_rating?.toFixed(1) || '5.0'}
                            </span>
                          </div>
                        </div>
                        {badge}
                      </div>

                      {/* Suitability Score details */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                        <div>
                          <span className="font-semibold text-indigo-600">
                            Score: {assignment.suitability_score.toFixed(1)} / 100
                          </span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span>Distance: <strong>{assignment.distance_km} km</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Offered: {new Date(assignment.offered_at).toLocaleTimeString()}
                          {assignment.responded_at && (
                            <span> | Responded: {new Date(assignment.responded_at).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Breakdown Tags */}
                      {breakdown && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            Dist: {breakdown.distanceScore}/40
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            Rating: {breakdown.ratingScore}/20
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            Reliability: {breakdown.reliabilityScore}/15
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            Workload: {breakdown.workloadScore}/15
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            Response: {breakdown.responseScore}/10
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chronological Event Timeline */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Full Lifecycle Timeline
            </h3>
            <div className="relative pl-6 space-y-3 border-l-2 border-slate-100 ml-2">
              {events.map((event) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-indigo-50" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{event.event_type}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{event.description}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
