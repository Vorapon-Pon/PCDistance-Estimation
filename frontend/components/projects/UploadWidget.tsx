'use client';

import { useUploadStore } from '@/store/useUploadStore';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';

export default function UploadWidget() {
  const { isUploading, uploadProgress, currentFileIndex, totalFiles, statusText, isMinimized, toggleMinimize } = useUploadStore();

  if (!isUploading && uploadProgress === 0) return null; 

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-[#1A1A1A] border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-300">
      {/* Header */}
      <div 
        className="bg-neutral-800 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-neutral-700 transition-colors"
        onClick={toggleMinimize}
      >
        <div className="flex items-center gap-2">
          {isUploading ? <Loader2 className="animate-spin text-[#B8AB9C]" size={18} /> : <CheckCircle2 className="text-green-400" size={18} />}
          <span className="font-medium text-sm text-white">
            {isUploading ? `Uploading ${currentFileIndex}/${totalFiles}` : 'Upload Complete'}
          </span>
        </div>
        <button className="text-neutral-400 hover:text-white">
          {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Body (ซ่อนถ้าย่อหน้าต่าง) */}
      {!isMinimized && (
        <div className="p-4 bg-[#1A1A1A]">
          <p className="text-xs text-neutral-400 mb-2 truncate" title={statusText}>{statusText}</p>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ease-out ${isUploading ? 'bg-[#B8AB9C]' : 'bg-green-400'}`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}