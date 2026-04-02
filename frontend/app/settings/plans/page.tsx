'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Globe, Download, Coins, Layers, Eye, Check, X, CheckCircle2, Loader2, Maximize } from 'lucide-react';
import { createCheckoutSession, getUserProfile } from './actions';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  const [currentPlan, setCurrentPlan] = useState<'free' | 'viewer' | 'uploader'>('free');
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getUserProfile();
        setCurrentPlan(profile.planTier as 'free' | 'viewer' | 'uploader');
        setCurrentCredits(profile.credits);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsFetchingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const success = searchParams.get('success');
    if (success) {
      setIsSuccessModalOpen(true);
      window.history.replaceState(null, '', '/settings/plans'); 
    }
  }, [searchParams]);

  const handleBuyPlan = async (priceId: string, type: 'subscription' | 'topup', planTier: string, creditsToAdd: number = 0) => {
    setIsLoading(priceId);
    try {
      const result = await createCheckoutSession(priceId, type, planTier, creditsToAdd);
      if (result.url) {
        window.location.href = result.url; 
      } else {
        console.error(result.error);
        alert(result.error || 'Something went wrong');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  const isFree = currentPlan === 'free';
  const isViewer = currentPlan === 'viewer';
  const isUploader = currentPlan === 'uploader';

  const uploaderPrice = isViewer ? 30 : 50;
  const VIEWER_PRICE_ID = process.env.NEXT_PUBLIC_VIEWER_PRICE_ID!;
  const UPLOADER_PRICE_ID = process.env.NEXT_PUBLIC_UPLOADER_PRICE_ID!;
  const UPLOADER_UPGRADE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_UPLOADER_UPGRADE_PRICE_ID!;

  if (isFetchingProfile) {
    return <div className="text-white flex items-center justify-center h-64 gap-2"><Loader2 className="animate-spin" /> Loading your plan data...</div>;
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-white">Plan & Billing</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your Point Cloud access tiers and billing settings</p>
      </div>

      {/* Your Current Plan Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Your Plan</h2>
        <div className="bg-[#182321] border border-teal-900/50 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              <div className="bg-[#1c2e2a] p-3 rounded-lg h-fit">
                <Globe className="w-6 h-6 text-teal-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white capitalize">{currentPlan} Plan</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-xl">
                  {currentPlan === 'free' && "Basic access to view point clouds and project images."}
                  {currentPlan === 'viewer' && "Enhanced access with .las exports and object detection viewing."}
                  {currentPlan === 'uploader' && "Full access including distance activation tools and exports."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Plans */}
      <section className="space-y-4 pb-12">
        <h2 className="text-sm font-semibold text-white">Available Plans</h2>
        <div className="grid grid-cols-3 gap-6">
          
          {/* Free Plan Card */}
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl p-6 flex flex-col relative">
            {isFree && <span className="absolute top-4 right-4 bg-[#182321] text-teal-500 text-xs px-2 py-1 rounded-full border border-teal-900">Current</span>}
            <div className="bg-[#2d2d2d] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Free Plan</h3>
            <div className="text-3xl font-bold text-gray-400 mb-6">FREE</div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-gray-500" /> View Point Cloud Data</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-gray-500" /> View Project Images</li>
              <li className="flex items-center gap-2 text-gray-500"><X className="w-4 h-4" /> Cannot export .las files</li>
            </ul>
            <button disabled className="w-full bg-[#2a2a2a] text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
              {isFree ? 'Current Plan' : 'Free Tier'}
            </button>
          </div>

          {/* Viewer Plan Card */}
          <div className="bg-[#1c1c1c] border border-blue-500/50 rounded-xl p-6 flex flex-col relative">
            {isViewer && <span className="absolute top-4 right-4 bg-blue-900/30 text-blue-400 text-xs px-2 py-1 rounded-full border border-blue-900">Current</span>}
            <div className="bg-[#1e293b] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Viewer Plan</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-blue-400">$20</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> View Point Cloud & Images</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Export .las files</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> View Object Detection</li>
            </ul>
            <button 
              onClick={() => handleBuyPlan(VIEWER_PRICE_ID, 'subscription', 'viewer', 200)}
              disabled={isLoading !== null || isViewer || isUploader}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading === VIEWER_PRICE_ID ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                (isViewer ? 'Current Plan' : isUploader ? 'Included in Uploader' : 'Select Plan')}
            </button>
          </div>

          {/* Uploader Plan Card */}
          <div className="bg-[#1c1c1c] border border-teal-500/50 rounded-xl p-6 flex flex-col relative shadow-[0_0_15px_rgba(20,184,166,0.1)]">
            {isUploader && <span className="absolute top-4 right-4 bg-[#182321] text-teal-500 text-xs px-2 py-1 rounded-full border border-teal-900">Current</span>}
            <div className="bg-[#182321] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-teal-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Uploader Plan</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-teal-400">${uploaderPrice}</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> All Viewer Plan features</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Distance Activation Tools</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Priority Processing</li>
            </ul>
            <button 
              onClick={() => handleBuyPlan(isViewer ? UPLOADER_UPGRADE_PRICE_ID : UPLOADER_PRICE_ID, 'subscription', 'uploader', 500)}
              disabled={isLoading !== null || isUploader}
              className="w-full bg-[#38b2ac] hover:bg-[#319795] text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading === UPLOADER_PRICE_ID || isLoading === UPLOADER_UPGRADE_PRICE_ID ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                (isUploader ? 'Current Plan' : isViewer ? 'Upgrade for $30' : 'Select Plan')}
            </button>
          </div>

        </div>
      </section>

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-2xl max-w-sm w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsSuccessModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
            <p className="text-zinc-400 mb-8">Thank you for your purchase. Your account and features have been updated.</p>
            <button onClick={() => setIsSuccessModalOpen(false)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-white flex items-center gap-2"><Loader2 className="animate-spin" /> Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}