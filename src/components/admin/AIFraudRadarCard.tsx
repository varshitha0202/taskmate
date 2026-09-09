import React, { useState } from 'react';
import { FraudAlert } from '../../types';
import { api } from '../../services/api';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Eye 
} from 'lucide-react';

interface Props {
  alerts: FraudAlert[];
  onResolved: () => void;
}

export const AIFraudRadarCard: React.FC<Props> = ({ alerts, onResolved }) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (alertId: string, action: 'DISMISS' | 'CONFIRM_SUSPEND') => {
    setResolvingId(alertId);
    try {
      await api.resolveFraudAlert(alertId, action, `Admin resolved: ${action}`);
      onResolved();
    } catch (err) {
      console.error('Resolve alert error:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const pendingAlerts = alerts.filter((a) => a.status === 'PENDING_REVIEW');

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">AI Trust & Safety Fraud Radar</h2>
              {pendingAlerts.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <p className="text-xs text-slate-500">
              Automated anomaly detection for rapid cancellations, fake reviews, and suspicious patterns
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {pendingAlerts.length} Action Needed
        </span>
      </div>

      {pendingAlerts.length === 0 ? (
        <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center text-xs text-emerald-800 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>All quiet. No active fraud alerts or suspicious booking patterns flagged.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingAlerts.map((alert) => {
            const isHigh = alert.severity === 'HIGH';
            const isMedium = alert.severity === 'MEDIUM';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isHigh
                    ? 'bg-rose-50/50 border-rose-200'
                    : isMedium
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono ${
                          isHigh
                            ? 'bg-rose-600 text-white'
                            : isMedium
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-500 text-white'
                        }`}
                      >
                        {alert.severity} RISK
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">{alert.alert_type}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">{alert.details}</p>

                    <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-1">
                      <span>User: <strong>{alert.user_name || 'Rahul Sharma'}</strong></span>
                      <span>•</span>
                      <span>Role: <strong>{alert.user_role || 'CUSTOMER'}</strong></span>
                      {alert.task_id && (
                        <>
                          <span>•</span>
                          <span>Task #{alert.task_id.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => handleResolve(alert.id, 'DISMISS')}
                      disabled={resolvingId === alert.id}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-2xs transition-colors"
                    >
                      Dismiss Flag
                    </button>
                    <button
                      onClick={() => handleResolve(alert.id, 'CONFIRM_SUSPEND')}
                      disabled={resolvingId === alert.id}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      Suspend User
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
