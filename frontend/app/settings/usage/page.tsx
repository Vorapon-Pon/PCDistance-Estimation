'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/client';
import { 
  CreditCard, UploadCloud, Crosshair, Settings, 
  ArrowUpRight, ArrowDownRight, Zap, Loader2 
} from 'lucide-react';

export default function UsagePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    spentMonth: 0,
    uploadCredits: 0,
    estimationCredits: 0,
    calibrationCredits: 0
  });

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData);

      const { data: txData, error: txError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txData) {
        setTransactions(txData);
        calculateBreakdown(txData);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBreakdown = (txs: any[]) => {
    let spent = 0;
    let uploads = 0;
    let estimates = 0;
    let calibrations = 0;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    txs.forEach(tx => {
      const txDate = new Date(tx.created_at);
      const amount = Math.abs(tx.amount);

      if (tx.amount < 0 && txDate >= firstDayOfMonth) {
        spent += amount;
      }

      if (tx.transaction_type.startsWith('UPLOAD')) {
        uploads += amount;
      } else if (tx.transaction_type === 'ESTIMATE_DISTANCE') {
        estimates += amount;
      } else if (tx.transaction_type === 'CALIBRATION_OFFSET') {
        calibrations += amount;
      }
    });

    setSummary({
      spentMonth: spent,
      uploadCredits: uploads,
      estimationCredits: estimates,
      calibrationCredits: calibrations
    });
  };

  const getTransactionDetails = (type: string) => {
    if (type.startsWith('UPLOAD')) return { label: 'Upload', icon: <UploadCloud size={16} />, color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (type === 'ESTIMATE_DISTANCE') return { label: 'Estimation', icon: <Crosshair size={16} />, color: 'text-purple-400', bg: 'bg-purple-400/10' };
    if (type === 'CALIBRATION_OFFSET') return { label: 'Calibration', icon: <Settings size={16} />, color: 'text-orange-400', bg: 'bg-orange-400/10' };
    if (type === 'TOP_UP' || type === 'PLAN_UPGRADE') return { label: 'Top Up', icon: <Zap size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    return { label: 'System', icon: <CreditCard size={16} />, color: 'text-neutral-400', bg: 'bg-neutral-800' };
  };

  if (loading) return (
    <div className="text-white flex items-center justify-center h-64 gap-2">
      <Loader2 className="animate-spin mr-2" /> Loading Usage History...
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto text-neutral-200">
      <h1 className="text-2xl font-bold text-white mb-6">Usage & Credits</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <span className="text-sm text-neutral-400">Credits Remain</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-white">{profile?.credits?.toLocaleString() || 0}</span>
            <span className="text-sm text-neutral-500">CR</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <span className="text-sm text-neutral-400">Current plan</span>
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 uppercase tracking-wider mb-2">
              {profile?.plan_tier || 'FREE'}
            </span>
            <div className="text-xs text-neutral-500">
              End Date: {profile?.current_period_end ? new Date(profile.current_period_end).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <span className="text-sm text-neutral-400">Used this month</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-[#B8AB9C]">{summary.spentMonth.toLocaleString()}</span>
            <span className="text-sm text-neutral-500">CR</span>
          </div>
        </div>
      </div>

      {/* Credit Breakdown */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Credit Breakdown (All Time)</h2>
        <div className="space-y-6">
          <UsageBar 
            label="Uploads (Images/Point Cloud)" 
            value={summary.uploadCredits} 
            total={summary.uploadCredits + summary.estimationCredits + summary.calibrationCredits} 
            color="bg-blue-500"
            icon={<UploadCloud size={14} className="text-blue-400"/>}
          />
          <UsageBar 
            label="Estimation & Detection" 
            value={summary.estimationCredits} 
            total={summary.uploadCredits + summary.estimationCredits + summary.calibrationCredits} 
            color="bg-purple-500"
            icon={<Crosshair size={14} className="text-purple-400"/>}
          />
          <UsageBar 
            label="Calibration & Adjustments" 
            value={summary.calibrationCredits} 
            total={summary.uploadCredits + summary.estimationCredits + summary.calibrationCredits} 
            color="bg-orange-500"
            icon={<Settings size={14} className="text-orange-400"/>}
          />
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Transactions History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-400 bg-black/50">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {transactions.map((tx) => {
                const details = getTransactionDetails(tx.transaction_type);
                return (
                  <tr key={tx.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 text-neutral-400 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${details.bg} ${details.color}`}>
                        {details.icon} {details.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-300">{tx.description}</td>
                    <td className={`px-6 py-4 text-right font-mono ${tx.amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, value, total, color, icon }: any) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span className="text-neutral-400 font-mono">{value.toLocaleString()} CR</span>
      </div>
      <div className="w-full bg-neutral-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}