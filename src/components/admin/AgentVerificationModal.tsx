import React, { useState } from 'react';
import { AgentVerification } from '../../types';
import { api } from '../../services/api';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Star, 
  User, 
  FileText 
} from 'lucide-react';

interface Props {
  verifications: AgentVerification[];
  onClose: () => void;
  onUpdated: () => void;
}

export const AgentVerificationModal: React.FC<Props> = ({ verifications, onClose, onUpdated }) => {
  const [selectedVerification, setSelectedVerification] = useState<AgentVerification | null>(
    verifications[0] || null
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED') => {
    if (!selectedVerification) return;
    setIsProcessing(true);
    try {
      await api.reviewAgentVerification(
        selectedVerification.agent_id,
        status,
        adminNotes || `Admin marked as ${status}`
      );
      setAdminNotes('');
      onUpdated();
    } catch (err) {
      console.error('Failed to review agent:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">AI Agent Verification Command Center</h2>
              <p className="text-xs text-slate-400">Human-in-the-loop review for agent credential approval</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-y-auto">
          
          {/* Left Column: Applications List */}
          <div className="p-4 space-y-2 overflow-y-auto max-h-[70vh]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Verification Queue ({verifications.length})
            </span>

            {verifications.map((v) => {
              const isSelected = selectedVerification?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVerification(v)}
                  className={`w-full p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={v.agent_avatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}
                      alt="Agent"
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate w-32">{v.agent_name}</div>
                      <div className="text-[10px] text-slate-500">AI Score: <strong>{v.ai_score}</strong>/100</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase font-mono ${
                      v.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : v.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {v.status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right 2 Columns: Deep Verification Inspector */}
          {selectedVerification ? (
            <div className="md:col-span-2 p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              
              {/* Agent Profile Overview */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedVerification.agent_avatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}
                    alt="Agent"
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/20 shadow-sm"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedVerification.agent_name}</h3>
                    <div className="text-xs text-slate-500">{selectedVerification.agent_email} • {selectedVerification.agent_phone}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                        {selectedVerification.experience_years || 2} Years Experience
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Status: <strong>{selectedVerification.status}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-600">{selectedVerification.ai_score}</div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">AI Trust Score</span>
                </div>
              </div>

              {/* AI Evaluation Summary */}
              {selectedVerification.ai_summary && (
                <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    AI Evaluation Summary
                  </span>
                  <p className="leading-relaxed text-indigo-800/90">{selectedVerification.ai_summary}</p>
                </div>
              )}

              {/* Verification Factors Breakdown */}
              {selectedVerification.breakdown && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Credential Breakdown
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Profile Completeness</span>
                      <span className="font-extrabold text-slate-800">{selectedVerification.breakdown.profileCompleteness || 95}%</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Identity Document</span>
                      <span className="font-extrabold text-emerald-600">
                        {selectedVerification.breakdown.identityVerified ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Phone Verification</span>
                      <span className="font-extrabold text-emerald-600">
                        {selectedVerification.breakdown.phoneVerified ? '✓ Matched OTP' : 'Pending'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Experience Rating</span>
                      <span className="font-extrabold text-indigo-600">{selectedVerification.breakdown.experienceScore || 80}/100</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Completion Reliability</span>
                      <span className="font-extrabold text-emerald-600">{selectedVerification.breakdown.historicalCompletionScore || 98}%</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 block">Fraud Risk Score</span>
                      <span className="font-extrabold text-emerald-600">{selectedVerification.breakdown.fraudRiskScore || 95}/100</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Decision Actions */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Review Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Government ID and background check physically verified."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleAction('VERIFIED')}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Verify</span>
                  </button>

                  <button
                    onClick={() => handleAction('REJECTED')}
                    disabled={isProcessing}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleAction('SUSPENDED')}
                    disabled={isProcessing}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Suspend</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="md:col-span-2 p-12 text-center text-slate-400 text-xs">
              Select an agent from the queue to inspect their credentials and review verification.
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
