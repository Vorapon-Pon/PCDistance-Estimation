'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface CreditConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  totalCost: number;
  isLoading?: boolean;
  confirmText?: string;
  details: { label: string; value: string | number }[]; 
}

export default function CreditConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = "Once confirmed, credits will be deducted from your account. This action cannot be undone.",
  totalCost,
  isLoading = false,
  confirmText = "Confirm & Pay",
  details
}: CreditConfirmModalProps) {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-zinc-700 p-6 rounded-xl max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="text-[#B8AB9C]" />
          {title}
        </h3>
        
        <div className="bg-black/30 p-4 rounded-lg mb-6 border border-zinc-800">
          {/* Loop แสดงรายละเอียดที่ส่งเข้ามา */}
          {details.map((detail, index) => (
            <div key={index} className="flex justify-between items-center mb-2">
              <span className="text-zinc-400">{detail.label}:</span>
              <span className="text-white font-semibold">{detail.value}</span>
            </div>
          ))}
          
          <div className="h-px bg-zinc-800 my-3"></div>
          
          {/* สรุปราคา */}
          <div className="flex justify-between items-center text-lg">
            <span className="text-zinc-300">Total Cost:</span>
            <span className="text-emerald-400 font-bold">{totalCost} credits</span>
          </div>
        </div>

        <p className="text-sm text-zinc-500 mb-6 text-center">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-[#B8AB9C] hover:bg-[#B8AB9C]/80 text-black font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}