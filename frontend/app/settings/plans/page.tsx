import { Globe, Download, Coins, Zap, Crown, Check } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Plan & Billing</h1>
        <p className="text-sm text-gray-400 mt-1">Change your plan or manage your billing settings</p>
      </div>

      {/* Your Plan Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Your Plan</h2>
        
        {/* Active Plan Card */}
        <div className="bg-[#182321] border border-teal-900/50 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              <div className="bg-[#1c2e2a] p-3 rounded-lg h-fit">
                <Globe className="w-6 h-6 text-teal-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Public Plan</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-xl">
                  Best for personal, open source, and research projects, with public datasets and models for the community to use.
                </p>
                
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-white mb-3">What's included:</h4>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-teal-500/50 flex items-center justify-center text-teal-500 text-[10px]">✓</div>
                      30 credits per month
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-teal-500/50 flex items-center justify-center text-teal-500 text-[10px]">✓</div>
                      $4 per additional credit
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-teal-500" />
                      Public data
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border border-teal-500 rounded text-teal-500 flex items-center justify-center text-[10px]">👥</div>
                      Community Support
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button className="bg-[#38b2ac] hover:bg-[#319795] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Change Plan
            </button>
          </div>
        </div>

        {/* Add Weights Download Card */}
        <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl p-6 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div className="bg-[#2d2d2d] p-3 rounded-lg">
              <Download className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Weights Download</h3>
              <p className="text-sm text-gray-400 mt-1">
                Your current plan does not include the ability to download model weights. You will need to purchase a plan to use this feature.
              </p>
            </div>
          </div>
          <button className="border border-teal-500/50 text-teal-400 hover:bg-teal-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
            Purchase Plan
          </button>
        </div>
      </section>

      {/* Purchase Additional Credits */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Purchase Additional Credits</h2>
        <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl p-6 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div className="bg-[#2d2d2d] p-3 rounded-lg">
              <Coins className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Prepaid Credits: 0</h3>
              <p className="text-sm text-gray-400 mt-1">
                Prepaid credits do not expire and are consumed after the monthly included credits on your plan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#121212] border border-[#2d2d2d] rounded-lg px-3 py-2">
              <input type="number" defaultValue={100} className="bg-transparent text-white w-16 outline-none" />
            </div>
            <span className="text-sm text-gray-400">credits</span>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-lg text-sm font-bold transition-colors">
              Buy
            </button>
          </div>
        </div>
      </section>

      {/* Available Plans */}
      <section className="space-y-4 pb-12">
        <h2 className="text-sm font-semibold text-white">Available Plans</h2>
        <div className="grid grid-cols-3 gap-6">
          
          {/* Public Plan Card */}
          <div className="bg-[#1c1c1c] border border-teal-500/50 rounded-xl p-6 relative flex flex-col">
            <span className="absolute top-4 right-4 bg-[#182321] text-teal-500 text-xs px-2 py-1 rounded-full border border-teal-900">Current</span>
            <div className="bg-[#182321] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-5 h-5 text-teal-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Public Plan</h3>
            <div className="text-3xl font-bold text-teal-400 mb-6">FREE</div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> 30 credits per month</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> $4 per additional credit</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Public data</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Community Support</li>
            </ul>
            <button className="w-full bg-[#2a2a2a] text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
              Current Plan
            </button>
          </div>

          {/* Starter Plan Card */}
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl p-6 flex flex-col">
            <div className="bg-[#2d2d2d] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-teal-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Starter Plan</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-teal-400">$20</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> 100 credits per month</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> $3 per additional credit</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Private data</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" /> Email Support</li>
            </ul>
            <button className="w-full bg-[#38b2ac] hover:bg-[#319795] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Select Plan
            </button>
          </div>

          {/* Professional Plan Card */}
          <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-xl p-6 flex flex-col">
            <div className="bg-[#2d2d2d] w-10 h-10 rounded-lg flex items-center justify-center mb-4">
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Professional Plan</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-yellow-500">$50</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-yellow-500" /> 500 credits per month</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-yellow-500" /> $2 per additional credit</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-yellow-500" /> Private data + Collaboration</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-yellow-500" /> Priority Support</li>
            </ul>
            <button className="w-full bg-[#38b2ac] hover:bg-[#319795] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Select Plan
            </button>
          </div>

        </div>
      </section>
    </div>
  );
}