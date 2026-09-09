import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Package, 
  MapPin, 
  Clock, 
  Check, 
  X, 
  Zap, 
  ShieldCheck, 
  Compass,
  AlertTriangle 
} from 'lucide-react';

interface Props {
  offer: any;
  onAccepted: () => void;
  onDeclined: () => void;
}

export const TaskOfferModal: React.FC<Props> = ({ offer, onAccepted, onDeclined }) => {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [offer.task_id]);

  const handleAccept = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const res = await api.acceptTask(offer.task_id);
      if (res.success) {
        onAccepted();
      }
    } catch (err: any) {
      setError(err.message || 'Could not accept task');
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    setError('');
    try {
      await api.rejectTask(offer.task_id);
      onDeclined();
    } catch (err: any) {
      console.error('Decline error:', err);
      onDeclined();
    }
  };

  const breakdown = offer.score_breakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-indigo-500 overflow-hidden relative animate-bounce-short">
        
        {/* Urgent Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">
              New Hyperlocal Task Offer!
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{secondsLeft}s</span>
          </div>
        </div>

        {/* Progress Countdown Bar */}
        <div className="w-full h-1.5 bg-indigo-100">
          <div
            className="h-full bg-indigo-600 transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / 60) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Customer */}
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 mb-1.5">
              {offer.category || 'Errand / Delivery'}
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
              {offer.title}
            </h3>
            {offer.description && (
              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                {offer.description}
              </p>
            )}
          </div>

          {/* Key Deal Highlights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                ₹
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Reward</span>
                <span className="text-xl font-black text-emerald-700">₹{offer.budget}</span>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Distance</span>
                <span className="text-xl font-black text-indigo-700">{offer.distance_km} km</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-slate-700">Pickup / Meeting Point:</span>
              <p className="text-slate-600 mt-0.5">{offer.pickup_location}</p>
            </div>
          </div>

          {/* Transparent Suitability Score pill */}
          <div className="px-3.5 py-2.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between text-xs text-purple-900">
            <div className="flex items-center gap-1.5 font-medium">
              <Zap className="w-4 h-4 text-purple-600" />
              <span>Matching Engine Score:</span>
            </div>
            <span className="font-mono font-bold text-purple-700 text-sm">
              {offer.suitability_score?.toFixed(1) || '92.5'}% Match
            </span>
          </div>

          {/* Big Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs rounded-2xl border border-slate-200 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>DECLINE (Pass)</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>ACCEPT TASK</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Declining will immediately re-offer this task to the next closest verified agent.
          </p>
        </div>

      </div>
    </div>
  );
};
