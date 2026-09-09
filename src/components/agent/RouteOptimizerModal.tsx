import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { OptimizedRoute } from '../../types';
import { 
  X, 
  Compass, 
  MapPin, 
  Navigation, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const RouteOptimizerModal: React.FC<Props> = ({ onClose }) => {
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRoute();
  }, []);

  const loadRoute = async () => {
    try {
      const res = await api.getOptimizedRoute();
      setRoute(res.route);
    } catch (err) {
      console.error('Failed to load route:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Route Sequence Optimizer</h2>
              <p className="text-xs text-slate-500">Most efficient stop order for minimum travel time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Calculating optimal waypoint order...</div>
          ) : !route || route.stops.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No active tasks to optimize. Accept a task to generate an optimized route plan.
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100 text-center">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Total Stops</span>
                  <span className="text-xl font-black text-indigo-900">{route.stops.length}</span>
                </div>
                <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Distance</span>
                  <span className="text-xl font-black text-emerald-900">{route.totalDistanceKm} km</span>
                </div>
                <div className="p-3.5 bg-sky-50/80 rounded-2xl border border-sky-100 text-center">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Estimated Duration</span>
                  <span className="text-xl font-black text-sky-900">~{route.totalEstimatedMinutes} mins</span>
                </div>
              </div>

              {/* Waypoints Sequence */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Recommended Waypoint Sequence
                </span>

                <div className="space-y-2 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
                  {route.stops.map((stop, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-start gap-3 p-3 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                        {stop.order}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                              stop.type === 'PICKUP'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {stop.type}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{stop.label}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Coords: {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
