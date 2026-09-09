import React from 'react';
import { CustomerWallet, WalletTransaction } from '../../types';
import { 
  X, 
  Wallet, 
  IndianRupee, 
  Sparkles, 
  Gift, 
  ShieldCheck, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  HelpCircle,
  Award
} from 'lucide-react';

interface Props {
  wallet: CustomerWallet | null;
  transactions: WalletTransaction[];
  onClose: () => void;
}

export const CustomerWalletModal: React.FC<Props> = ({ wallet, transactions, onClose }) => {
  if (!wallet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Wallet className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Points & compensation</h2>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-mono">
                  {wallet.priority_tier}
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Everything you have earned or received, clearly separated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Distinct Balances Grid */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* 1. Refunds Balance */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center justify-between text-emerald-700 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Refunds</span>
                <IndianRupee className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-emerald-900">₹{wallet.refund_balance.toFixed(2)}</div>
              <span className="text-[10px] text-emerald-700 mt-1 block">
                Returned funds from unassigned tasks
              </span>
            </div>

            {/* 2. Service Credits */}
            <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200">
              <div className="flex items-center justify-between text-sky-700 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Credits</span>
                <Gift className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-sky-900">₹{wallet.service_credits.toFixed(2)}</div>
              <span className="text-[10px] text-sky-700 mt-1 block">
                Platform courtesy credits for bookings
              </span>
            </div>

            {/* 3. Compensation Points */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
              <div className="flex items-center justify-between text-amber-700 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Comp. Points</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-amber-900">{wallet.compensation_points}</div>
              <span className="text-[10px] text-amber-700 mt-1 block">
                Issued for service delays & wait time
              </span>
            </div>

            {/* 4. Customer Reward Points */}
            <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200">
              <div className="flex items-center justify-between text-purple-700 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Reward Points</span>
                <Award className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-purple-900">{wallet.reward_points}</div>
              <span className="text-[10px] text-purple-700 mt-1 block">
                Earned for successful completions
              </span>
            </div>

          </div>

          {/* Policy Notice Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-800">How your balance works:</span>
              <p className="leading-relaxed">
                Refunds and service credits come from eligible unsuccessful bookings. Reward points come from successful completions, and compensation points are kept separate from both.
              </p>
            </div>
          </div>

          {/* Transaction History Ledger */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Wallet & Compensation Ledger
            </h3>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                {transactions.map((tx) => {
                  const isRefund = tx.type === 'REFUND';
                  const isCredit = tx.type === 'SERVICE_CREDIT';
                  const isComp = tx.type === 'COMPENSATION_POINTS';

                  return (
                    <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                            isRefund
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCredit
                                ? 'bg-sky-100 text-sky-800'
                                : isComp
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isRefund ? <ArrowDownLeft className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{tx.description}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(tx.created_at).toLocaleString()} • Type: <span className="font-mono">{tx.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-extrabold text-xs">
                        <span className={isRefund || isCredit ? 'text-emerald-600' : 'text-purple-600'}>
                          +{isRefund || isCredit ? `₹${tx.amount}` : `${tx.amount} pts`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Protected by TaskMate Escrow & Compensation Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
