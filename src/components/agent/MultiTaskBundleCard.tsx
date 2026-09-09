import React, { useState } from 'react';
import { MultiTaskBundle } from '../../types';
import { 
  Sparkles, 
  MapPin, 
  Navigation, 
  IndianRupee, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Layers
} from 'lucide-react';

interface Props {
  bundle: MultiTaskBundle;
  onAccept: (taskId: string) => Promise<void>;
  onDismiss: () => void;
}

export const MultiTaskBundleCard: React.FC<Props> = ({ bundle, onAccept, onDismiss }) => {
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(bundle.suggestedTaskId);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden space-y-4 animate-in zoom-in-95 duration-200">
      
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
              AI Multi-Task Opportunity Detected
            </span>
            <h3 className="text-sm font-bold text-white">Combine with your active route</h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-black text-emerald-400">+₹{bundle.additionalReward}</div>
          <span className="text-[10px] text-indigo-200">Extra Reward</span>
        </div>
      </div>

      {/* Task Summary */}
      <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-white">{bundle.suggestedTaskTitle}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-indigo-100 uppercase font-mono">
            {bundle.suggestedTaskCategory}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-indigo-200">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            {bundle.pickupLocation.split(',')[0]}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-sky-400" />
            +{bundle.additionalDistanceKm} km detour
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            ~{bundle.estimatedExtraMinutes} mins
          </span>
        </div>

        <p className="text-[11px] text-indigo-100/90 leading-relaxed border-t border-white/10 pt-2 mt-1">
          {bundle.explanation}
        </p>
      </div>

      {/* Route Order */}
      {bundle.routeOrder && bundle.routeOrder.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
            Suggested Stop Order:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-indigo-100">
            {bundle.routeOrder.map((stop, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl">
                <span>{stop}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-xs font-bold text-indigo-200 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
        >
          Decline Add-on
        </button>
        <button
          onClick={handleAccept}
          disabled={isAccepting}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
        >
          {isAccepting ? (
            <span>Accepting...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept & Add to Route (+₹{bundle.additionalReward})</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
