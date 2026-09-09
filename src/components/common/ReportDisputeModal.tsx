import React, { useState } from 'react';
import { api } from '../../services/api';
import { 
  X, 
  ShieldAlert, 
  AlertTriangle, 
  Send, 
  CheckCircle2, 
  PhoneCall, 
  LifeBuoy 
} from 'lucide-react';

interface Props {
  taskId: string;
  onClose: () => void;
  onReported?: () => void;
}

const REPORT_CATEGORIES = [
  { id: 'unreachable', label: 'Agent Unreachable / Not Responding' },
  { id: 'delay', label: 'Unreasonable Delay / Abandonment' },
  { id: 'item_issue', label: 'Item Safety / Wrong Goods' },
  { id: 'conduct', label: 'Unprofessional Conduct / Safety Concern' },
  { id: 'payment', label: 'Budget or Payment Dispute' },
  { id: 'other', label: 'Other Operational Issue' },
];

export const ReportDisputeModal: React.FC<Props> = ({ taskId, onClose, onReported }) => {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a brief explanation of the issue.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.submitReport(taskId, category, description);
      setIsSuccess(true);
      if (onReported) onReported();
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Trust & Safety Support</h3>
              <p className="text-[11px] text-slate-500">Report an issue or dispute task</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Support Ticket Logged</h4>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              Our 24/7 Operations Trust & Safety team has received your ticket. An incident manager will review task telemetry and contact you immediately.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Issue Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Description of Incident *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Please describe what occurred so our response team can take immediate action..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Emergency Hotline Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <LifeBuoy className="w-4 h-4 text-indigo-600" />
                Urgent Hotline:
              </span>
              <span className="font-mono font-bold text-indigo-600">1800-TASKMATE</span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Filing Report...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
