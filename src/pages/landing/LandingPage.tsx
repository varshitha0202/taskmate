import React from 'react';
import { 
  MapPin, 
  ShieldCheck, 
  Zap, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  Users, 
  Briefcase, 
  Compass, 
  Navigation,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { BrandMark } from '../../components/common/BrandMark';

interface Props {
  onPostTask: () => void;
  onBecomeAgent: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<Props> = ({ onPostTask, onBecomeAgent, onLogin }) => {
  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900 flex flex-col selection:bg-teal-600 selection:text-white">
      
      {/* Top Hero Section */}
      <section className="relative overflow-hidden bg-[#f4f7f6] pb-20 pt-10">
        <div className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full border-[42px] border-[#f3a44d]/20" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="flex justify-center"><BrandMark /></div>
            
            {/* Pill Banner */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Trusted help, close to home</span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-900">Hyderabad Live</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
              Get things done. <br />
              <span className="text-[#0b7285]">
                With a little local help.
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Book everyday help from trusted providers nearby, then follow your booking from request to completion.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={onPostTask}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-300 hover:shadow-2xl hover:scale-102 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Book a Service</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onBecomeAgent}
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span>Become a Task Agent</span>
              </button>
            </div>

            {/* Trust Micro-Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% ID Verified Agents
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-amber-500" /> Instant Auto-Reassignment
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Navigation className="w-4 h-4 text-indigo-600" /> Live GPS Telemetry
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="border-y border-slate-100 bg-slate-50/70 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-black text-indigo-600 font-mono">1.8 km</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                Average Agent Proximity
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 font-mono">&lt; 45s</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                Instant Match Time
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-emerald-600 font-mono">4.9 ★</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                Customer Satisfaction
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 font-mono">100%</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                Automated Reassignment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (Visual Steps) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              Intelligent Hyperlocal Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              How TaskMate Works
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              From request to fulfillment in minutes with zero manual dispatching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-200/80 bg-slate-50/50 hover:border-indigo-300 transition-all shadow-xs relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg mb-6 shadow-md shadow-indigo-200">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">Post What You Need</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Describe your errand, pickup, delivery, or quick fix. Pick your location coordinates or use device GPS and set your budget reward.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200/80 bg-slate-50/50 hover:border-indigo-300 transition-all shadow-xs relative">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-lg mb-6 shadow-md shadow-sky-200">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">Smart Engine Matches</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Our algorithm calculates Haversine distance, driver rating, completion rate, and workload to select the top candidate. If declined, it automatically cascades to the next best agent!
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200/80 bg-slate-50/50 hover:border-indigo-300 transition-all shadow-xs relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg mb-6 shadow-md shadow-emerald-200">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">Track & Pay Securely</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Watch your verified agent's live coordinates move towards the destination on an interactive OpenStreetMap. Confirm completion and rate your experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Customers vs For Agents Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* For Customers */}
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-4">
                  <Users className="w-3.5 h-3.5" /> For Customers
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  Delegation made effortless & trustworthy
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Never worry about waiting in queues, picking up documents, or urgent parcels. Verified local agents are always within minutes of your location.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Realtime interactive live map with ETA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant automatic reassignment if an agent becomes unavailable</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Verified background-checked helpers with star ratings</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={onPostTask}
                className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Post a Request</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* For Agents */}
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4">
                  <Briefcase className="w-3.5 h-3.5" /> For Task Agents
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  Earn on your schedule in your neighborhood
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Turn your spare time into income. Receive immediate task offers near your GPS location with clear rewards, upfront details, and 100% payout upon completion.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Online/Offline availability toggle anytime</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Transparent distance-based suitability scoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant earnings crediting with photo completion proof</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={onBecomeAgent}
                className="mt-8 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Start Earning as an Agent</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              T
            </div>
            <span className="font-bold text-slate-900">TaskMate</span>
            <span>— "Your Task. Your Nearby Helper."</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onLogin} className="hover:text-indigo-600 cursor-pointer">Sign In</button>
            <span className="text-slate-300">|</span>
            <span>Support: 1800-TASKMATE</span>
            <span className="text-slate-300">|</span>
            <span>© 2026 TaskMate Inc.</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
