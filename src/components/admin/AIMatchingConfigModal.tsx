import React, { useEffect, useState } from 'react';
import { MatchingWeights, CompensationPolicy } from '../../types';
import { api } from '../../services/api';
import { 
  X, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  RotateCcw, 
  Info 
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export const AIMatchingConfigModal: React.FC<Props> = ({ onClose, onSaved }) => {
  const [weights, setWeights] = useState<MatchingWeights>({
    distance: 25,
    skill: 20,
    availability: 15,
    reliability: 15,
    customerPriority: 10,
    workload: 10,
    compatibility: 5,
  });

  const [policy, setPolicy] = useState<CompensationPolicy>({
    fullRefundPercent: 100,
    serviceCreditAmount: 50,
    compensationPoints: 100,
    autoRefundUnassigned: true,
    searchTimeoutSeconds: 60,
    maxRadiusKm: 25,
  });

  const [activeTab, setActiveTab] = useState<'MATCHING' | 'COMPENSATION'>('MATCHING');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        api.getMatchingWeights(),
        api.getCompensationPolicy(),
      ]);
      if (wRes.weights) setWeights(wRes.weights);
      if (pRes.policy) setPolicy(pRes.policy);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg('');
    try {
      await Promise.all([
        api.updateMatchingWeights(weights),
        api.updateCompensationPolicy(policy),
      ]);
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeight =
    weights.distance +
    weights.skill +
    weights.availability +
    weights.reliability +
    weights.customerPriority +
    weights.workload +
    weights.compatibility;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">AI Allocation & Policy Configuration</h2>
              <p className="text-xs text-slate-400">Tune algorithm scoring weights & customer compensation rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('MATCHING')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'MATCHING'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            AI Matching Formula ({totalWeight} pts)
          </button>
          <button
            onClick={() => setActiveTab('COMPENSATION')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'COMPENSATION'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Compensation Policy Rules
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'MATCHING' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                <span>Total formula weight: <strong>{totalWeight} / 100 points</strong></span>
                <span className="text-[10px] text-indigo-600 font-mono">Normalized internally</span>
              </div>

              {/* Weight Sliders */}
              {[
                { key: 'distance', label: 'Distance Proximity Weight', desc: 'Closer agents receive higher points (Haversine)' },
                { key: 'skill', label: 'Skill Match Weight', desc: 'Category expertise & skill domain keyword matching' },
                { key: 'availability', label: 'Availability Weight', desc: 'Online availability toggle bonus' },
                { key: 'reliability', label: 'Historical Reliability Weight', desc: 'Completion rate & historical customer rating' },
                { key: 'customerPriority', label: 'Customer Priority Tier Weight', desc: 'Priority points advantage for loyal customers' },
                { key: 'workload', label: 'Agent Workload Capacity Weight', desc: 'Prioritize helpers with fewer active in-flight tasks' },
                { key: 'compatibility', label: 'Task Compatibility Weight', desc: 'Vehicle suitability (bike vs van for task type)' },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                    <span className="font-extrabold text-indigo-600 text-sm font-mono w-10 text-right">
                      {(weights as any)[item.key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={(weights as any)[item.key]}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [item.key]: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'COMPENSATION' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Full Refund Percentage (%)</label>
                <p className="text-[10px] text-slate-400">Percentage refunded to wallet if task is unassigned</p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={policy.fullRefundPercent}
                  onChange={(e) => setPolicy((p) => ({ ...p, fullRefundPercent: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Courtesy Service Credit (₹)</label>
                <p className="text-[10px] text-slate-400">Extra credit awarded for inconvenience on failed request</p>
                <input
                  type="number"
                  min="0"
                  value={policy.serviceCreditAmount}
                  onChange={(e) => setPolicy((p) => ({ ...p, serviceCreditAmount: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Compensation Points</label>
                <p className="text-[10px] text-slate-400">Points awarded to customer wallet for waiting delay</p>
                <input
                  type="number"
                  min="0"
                  value={policy.compensationPoints}
                  onChange={(e) => setPolicy((p) => ({ ...p, compensationPoints: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Max Search Radius (km)</label>
                <p className="text-[10px] text-slate-400">Distance boundary limit for expanding nearby search</p>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={policy.maxRadiusKm}
                  onChange={(e) => setPolicy((p) => ({ ...p, maxRadiusKm: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => {
              setWeights({
                distance: 25,
                skill: 20,
                availability: 15,
                reliability: 15,
                customerPriority: 10,
                workload: 10,
                compatibility: 5,
              });
            }}
            className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isSaving ? 'Saving...' : 'Apply & Save'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
