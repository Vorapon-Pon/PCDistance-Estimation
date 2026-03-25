'use client';

import { useSlicingStore } from '@/store/useSlicingStore'; // path ให้ตรงกับโปรเจกต์คุณ
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SlicingWidget() {
  const { isSlicing, isCompleted, statusMessage, isMinimized, toggleMinimize, projectId, reset } = useSlicingStore();
  const router = useRouter();

  if (!isSlicing && !isCompleted) return null;

  return (
    <div className="fixed bottom-24 right-6 w-80 bg-[#1A1A1A] border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-300">
      {/* Header */}
      <div 
        className="bg-neutral-800 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-neutral-700 transition-colors"
        onClick={toggleMinimize}
      >
        <div className="flex items-center gap-2">
          {isSlicing ? <Loader2 className="animate-spin text-[#B8AB9C]" size={18} /> : <CheckCircle2 className="text-green-400" size={18} />}
          <span className="font-medium text-sm text-white">
            {isSlicing ? 'Preparing Calibration...' : 'Ready for Calibration'}
          </span>
        </div>
        <button className="text-neutral-400 hover:text-white">
          {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4 bg-[#1A1A1A] flex flex-col gap-3">
          <p className="text-xs text-neutral-400 truncate" title={statusMessage}>{statusMessage}</p>
          
          {isSlicing && (
             <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
               <div className="h-full bg-[#B8AB9C] w-1/3 animate-[slide_2s_ease-in-out_infinite] rounded-full"></div>
             </div>
          )}

          {isCompleted && projectId && (
            <div className="flex gap-2 mt-1">
               <button 
                 onClick={() => {
                   router.push(`/projects/${projectId}/calibration`);
                   reset();
                 }}
                 className="flex-1 bg-[#B8AB9C] text-black text-xs font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-[#d0c2b2] transition"
               >
                 <Crosshair size={14} /> Go to Calibration
               </button>
               <button 
                 onClick={reset}
                 className="px-3 bg-neutral-800 text-neutral-400 text-xs rounded hover:bg-neutral-700 transition"
               >
                 Dismiss
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}