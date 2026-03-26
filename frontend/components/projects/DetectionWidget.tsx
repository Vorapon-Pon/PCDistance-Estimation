'use client';

import { useDetectionStore } from '@/store/useDetectionStore';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function DetectionWidget() {
  const { jobs, isProcessing } = useDetectionStore();
  
  // นับจำนวนงานทั้งหมด และงานที่เสร็จแล้ว
  const jobEntries = Object.entries(jobs);
  if (jobEntries.length === 0) return null;

  const totalJobs = jobEntries.length;
  const completedJobs = jobEntries.filter(([_, job]) => job.status === 'completed').length;
  const failedJobs = jobEntries.filter(([_, job]) => job.status === 'failed').length;

  // หา message ล่าสุดของงานที่กำลังทำอยู่
  const activeJob = jobEntries.find(([_, job]) => job.status === 'processing');
  const currentMessage = activeJob ? activeJob[1].message : 'Processing...';

  return (
    <div className="fixed bottom-4 right-4 bg-neutral-900 border border-zinc-700 rounded-lg p-4 shadow-xl w-80 z-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-medium text-sm">AI Estimation Status</h4>
        <span className="text-xs text-zinc-400">{completedJobs + failedJobs} / {totalJobs}</span>
      </div>
      
      {isProcessing ? (
        <div className="flex items-center gap-3 text-emerald-400 text-sm">
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
          <span className="truncate" title={currentMessage}>{currentMessage}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-zinc-300 text-sm">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>All tasks completed!</span>
        </div>
      )}
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${((completedJobs + failedJobs) / totalJobs) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}