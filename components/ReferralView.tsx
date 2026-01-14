
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Share2, Users, Gift, Copy, Check, Trophy, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/supabase';

interface Props {
  user: User;
}

const ReferralView: React.FC<Props> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const [refCount, setRefCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Directly using process.env for the bot username
  const botUsername = process.env.BOT_USERNAME || "BalochCoinBot";
  const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;

  useEffect(() => {
    const loadStats = async () => {
      const count = await api.getReferralCount(user.telegram_id);
      setRefCount(count);
      setLoading(false);
    };
    loadStats();
  }, [user.telegram_id]);

  const handleShare = () => {
    const text = `Join BalochCoin and start earning BP tokens together! 🪙 Balochistan's first tap-to-earn game.`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    // Fixed: window.Telegram is now typed
    (window.Telegram?.WebApp as any)?.openTelegramLink(shareUrl);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Fixed: window.Telegram is now typed
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  const milestoneProgress = refCount ? Math.min((refCount / 10) * 100, 100) : 0;

  return (
    <div className="px-6 py-4 flex flex-col items-center pb-20">
      <div className="w-full text-center mb-8">
        <h2 className="text-3xl font-black mb-1">Recruit Friends</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Build your own tribe</p>
      </div>

      <div className="w-full glass rounded-[2.5rem] p-7 border border-white/5 mb-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 blur-[50px] rounded-full"></div>
        
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                <Users className="text-orange-500" size={26} />
             </div>
             <div className="flex flex-col">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Allies</p>
                <p className="text-2xl font-black font-orbitron">{loading ? <Loader2 size={18} className="animate-spin text-slate-700" /> : refCount}</p>
             </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Commission</p>
             <p className="text-2xl font-black text-orange-500 font-orbitron">{(refCount || 0) * 5}k <span className="text-[10px] text-orange-400">BP</span></p>
          </div>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 backdrop-blur-md">
           <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2.5">
                 <div className="bg-yellow-500/20 p-1.5 rounded-lg">
                    <Trophy size={14} className="text-yellow-500" />
                 </div>
                 <span className="text-[11px] font-black text-white uppercase tracking-tight">Recruiter Goal</span>
              </div>
              <span className="text-[11px] font-black text-slate-500 font-orbitron">{refCount || 0} / 10</span>
           </div>
           
           <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-400 transition-all duration-1000 ease-out relative"
                style={{ width: `${milestoneProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full opacity-30 animate-[shimmer_3s_infinite]"></div>
              </div>
           </div>
           
           <div className="mt-4 flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded-xl">
              <Sparkles size={12} className="text-orange-400" />
              <p className="text-[10px] text-orange-200/80 font-bold">
                 Goal Bonus: <span className="text-white font-black">50,000 BP</span>
              </p>
           </div>
        </div>
      </div>

      <div className="w-full space-y-4">
        <button 
          onClick={handleShare}
          className="w-full py-5 bg-orange-500 text-white rounded-[1.8rem] font-black uppercase tracking-[0.15em] text-sm flex items-center justify-center gap-3 shadow-xl shadow-orange-500/25 active:scale-95 transition-all border-t border-white/20"
        >
          <Share2 size={20} />
          Invite Allies
        </button>

        <button 
          onClick={handleCopy}
          className="w-full py-5 glass text-white rounded-[1.8rem] font-black uppercase tracking-[0.15em] text-sm flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} className="text-slate-400" />}
          {copied ? 'Copied Link' : 'Copy Alliance Link'}
        </button>
      </div>

      <div className="mt-12 glass p-7 rounded-[2.5rem] w-full border border-white/5">
         <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
            How it works
         </h4>
         <div className="space-y-6">
            <div className="flex gap-5">
               <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                  <span className="font-orbitron text-orange-500 font-black">1</span>
               </div>
               <div>
                  <h5 className="text-[13px] font-extrabold mb-1">Send the Invite</h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Share your unique alliance link with your contacts or in groups.</p>
               </div>
            </div>
            <div className="flex gap-5">
               <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                  <span className="font-orbitron text-orange-500 font-black">2</span>
               </div>
               <div>
                  <h5 className="text-[13px] font-extrabold mb-1">Instant Bounty</h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Receive <span className="text-orange-400 font-black">5,000 BP</span> the moment your ally joins the battle.</p>
               </div>
            </div>
            <div className="flex gap-5">
               <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                  <span className="font-orbitron text-orange-500 font-black">3</span>
               </div>
               <div>
                  <h5 className="text-[13px] font-extrabold mb-1">Tribal Bonus</h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Gather <span className="text-yellow-500 font-black">10 warriors</span> to claim the massive System Bonus.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReferralView;
