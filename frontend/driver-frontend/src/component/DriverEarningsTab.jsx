import React, { useState } from 'react';
import {
  DollarSign, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight,
  CreditCard, ShieldCheck, CheckCircle2, Clock, Sparkles, Building
} from 'lucide-react';

export default function DriverEarningsTab({ completedRides = [], driverProfile, onShowAlert }) {
  const [period, setPeriod] = useState('today'); // 'today' | 'week' | 'month'
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Dynamic calculations from completed rides
  const rideGross = completedRides.reduce((acc, curr) => acc + (parseFloat(curr.fare || curr.total_fare) || 0), 0) || 1240;
  const incentives = 200;
  const tips = 50;
  const commission = Math.round(rideGross * 0.15);
  const netEarnings = rideGross + incentives + tips - commission;

  const weeklyEarnings = 8450;
  const monthlyEarnings = 32800;

  const handleRequestPayout = () => {
    setPayoutLoading(true);
    setTimeout(() => {
      setPayoutLoading(false);
      onShowAlert(
        `Instant payout of ₹${netEarnings.toLocaleString()} has been queued for transfer to ${driverProfile?.bank?.bank_name || 'HDFC Bank'} (A/C •••• ${driverProfile?.bank?.account_number?.slice(-4) || '8901'}).`,
        'Payout Initiated Successfully',
        'success'
      );
    }, 800);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          Earnings & Payouts
        </h2>
        <p className="text-xs text-gray-500">
          Track your daily trips, bonuses, incentives and bank transfers
        </p>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div
          onClick={() => setPeriod('today')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            period === 'today'
              ? 'bg-black text-white border-black shadow-md scale-[1.02]'
              : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${period === 'today' ? 'text-gray-400' : 'text-gray-500'}`}>
              Today
            </span>
            <Clock className={`w-3.5 h-3.5 ${period === 'today' ? 'text-[#FFC000]' : 'text-gray-400'}`} />
          </div>
          <div className="text-lg sm:text-2xl font-black mt-1">
            ₹{netEarnings.toLocaleString()}
          </div>
          <p className={`text-[10px] mt-0.5 ${period === 'today' ? 'text-emerald-400' : 'text-emerald-600 font-semibold'}`}>
            +8.5% vs yesterday
          </p>
        </div>

        <div
          onClick={() => setPeriod('week')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            period === 'week'
              ? 'bg-black text-white border-black shadow-md scale-[1.02]'
              : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${period === 'week' ? 'text-gray-400' : 'text-gray-500'}`}>
              This Week
            </span>
            <TrendingUp className={`w-3.5 h-3.5 ${period === 'week' ? 'text-[#FFC000]' : 'text-gray-400'}`} />
          </div>
          <div className="text-lg sm:text-2xl font-black mt-1">
            ₹{weeklyEarnings.toLocaleString()}
          </div>
          <p className={`text-[10px] mt-0.5 ${period === 'week' ? 'text-emerald-400' : 'text-emerald-600 font-semibold'}`}>
            42 Trips completed
          </p>
        </div>

        <div
          onClick={() => setPeriod('month')}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
            period === 'month'
              ? 'bg-black text-white border-black shadow-md scale-[1.02]'
              : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${period === 'month' ? 'text-gray-400' : 'text-gray-500'}`}>
              This Month
            </span>
            <Calendar className={`w-3.5 h-3.5 ${period === 'month' ? 'text-[#FFC000]' : 'text-gray-400'}`} />
          </div>
          <div className="text-lg sm:text-2xl font-black mt-1">
            ₹{monthlyEarnings.toLocaleString()}
          </div>
          <p className={`text-[10px] mt-0.5 ${period === 'month' ? 'text-emerald-400' : 'text-emerald-600 font-semibold'}`}>
            184 Trips
          </p>
        </div>
      </div>

      {/* Detailed Earnings Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#FFC000]" />
            <span>Earnings Breakdown ({period === 'today' ? "Today" : period === 'week' ? 'This Week' : 'This Month'})</span>
          </h3>
          <span className="text-xs text-gray-400 font-medium">Auto-calculated</span>
        </div>

        <div className="space-y-2.5 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-gray-700">
            <span>Ride Gross Fare</span>
            <span className="font-bold text-gray-900">₹{rideGross.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Target Incentives & Bonus
            </span>
            <span className="font-bold">+₹{incentives}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-700">
            <span>Customer Tips (100% to Captain)</span>
            <span className="font-bold">+₹{tips}</span>
          </div>
          <div className="flex items-center justify-between text-red-600">
            <span>RaahGo Platform Commission (15%)</span>
            <span className="font-bold">-₹{commission}</span>
          </div>
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-sm sm:text-base font-black text-gray-900">
            <span>Net Take-Home Earnings</span>
            <span className="text-emerald-700 text-lg sm:text-xl">₹{netEarnings.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bank Account & Instant Payout Card */}
      <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-[#FFC000]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Direct Bank Deposit</p>
              <h4 className="font-bold text-sm sm:text-base text-white">
                {driverProfile?.bank?.bank_name || 'HDFC Bank Limited'}
              </h4>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Verified Account
          </span>
        </div>

        <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
          <span className="text-gray-400">A/C: •••• {driverProfile?.bank?.account_number?.slice(-4) || '8901'}</span>
          <span className="text-gray-400">IFSC: {driverProfile?.bank?.ifsc_code || 'HDFC0001234'}</span>
        </div>

        <button
          onClick={handleRequestPayout}
          disabled={payoutLoading}
          className="w-full py-3.5 bg-[#FFC000] text-black font-extrabold rounded-xl hover:bg-[#E5AC00] transition-colors shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          <span>{payoutLoading ? 'Processing Transfer…' : `Request Instant Payout (₹${netEarnings.toLocaleString()})`}</span>
        </button>
      </div>

      {/* Payout History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-xs">
        <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Recent Payout History</h4>
        <div className="space-y-2 text-xs">
          {[
            { id: 'p1', date: 'Yesterday, 11:30 PM', amount: '₹1,180', status: 'Completed', ref: 'IMPS/682910' },
            { id: 'p2', date: '15 Aug 2026', amount: '₹2,450', status: 'Completed', ref: 'IMPS/681022' },
          ].map((p) => (
            <div key={p.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
              <div>
                <p className="font-bold text-gray-800">{p.amount}</p>
                <p className="text-[10px] text-gray-400">{p.date} • {p.ref}</p>
              </div>
              <span className="text-emerald-700 font-extrabold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
