
import React, { useState } from 'react';
import { User } from '../types';
import { Wallet, ShieldCheck, ArrowRightLeft, ExternalLink, Info, Activity, Globe } from 'lucide-react';

interface Props {
  user: User;
}

const WalletView: React.FC<Props> = ({ user }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
      // Fixed: window.Telegram is now typed
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
      }
    }, 1500);
  };

  return (
    <div className="px-6 py-4 pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-black mb-1">TON Network</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Connect to the Blockchain</p>
      </div>

      {!connected ? (
        <div className="glass p-10 rounded-[3rem] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/10 blur-[60px] rounded-full"></div>
          
          <div className="w-28 h-28 rounded-full bg-slate-900 flex items-center justify-center mb-8 relative border border-white/10 shadow-inner">
            <div className="absolute -inset-2 bg-orange-500/20 rounded-full animate-pulse"></div>
            <Wallet className="text-orange-400" size={48} />
          </div>
          
          <h3 className="text-2xl font-black mb-3">Sync Your Wallet</h3>
          <p className="text-slate-500 text-xs font-semibold mb-10 leading-relaxed px-2 uppercase tracking-wide">
            Access future <span className="text-orange-400">$BALOH</span> distributions and cultural NFTs.
          </p>
          
          <button 
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-5 bg-white text-slate-950 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl active:scale-95 transition-all disabled:opacity-50"
          >
            {connecting ? 'Synchronizing...' : 'Connect TON'}
          </button>
          
          <div className="mt-8 flex items-center gap-2.5 text-slate-600 bg-slate-800/50 px-5 py-2 rounded-2xl border border-white/5">
             <ShieldCheck size={16} className="text-blue-500" />
             <span className="text-[10px] font-black uppercase tracking-[0.15em]">Verified Secure Protocol</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Wallet Card */}
          <div className="glass p-7 rounded-[2.5rem] relative overflow-hidden border-white/10">
            <div className="flex justify-between items-start mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                     <Globe className="text-blue-400" size={24} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Status</span>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs font-black text-white uppercase tracking-tighter">Mainnet Linked</span>
                     </div>
                  </div>
               </div>
               <button 
                 onClick={() => setConnected(false)}
                 className="bg-white/5 hover:bg-red-500/10 p-2.5 rounded-xl transition-colors border border-white/5"
               >
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Exit</span>
               </button>
            </div>
            
            <div className="bg-slate-950/80 p-5 rounded-3xl border border-white/5 flex items-center justify-between mb-2">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">TON Address</span>
                  <span className="font-orbitron text-xs text-white tracking-widest">EQA...7uY9</span>
               </div>
               <ExternalLink size={16} className="text-slate-600" />
            </div>
          </div>

          {/* Token Balance Dashboard */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
            {/* Design patterns */}
            <div className="absolute top-0 right-0 p-8 opacity-20">
               <ArrowRightLeft size={80} className="text-white" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-10">
                  <div className="flex flex-col">
                     <span className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Pending Claim</span>
                     <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black font-orbitron text-white">0</span>
                        <span className="text-orange-200 font-black uppercase text-sm tracking-widest">$BALOH</span>
                     </div>
                  </div>
                  <div className="bg-white/20 p-3.5 rounded-2xl backdrop-blur-md border border-white/20">
                     <Activity className="text-white" size={28} />
                  </div>
               </div>
               
               <button className="w-full py-5 bg-slate-950 text-white rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all shadow-xl shadow-black/30 border-t border-white/10">
                 Exchange Points
               </button>
            </div>
          </div>

          {/* Claim Mechanics Info */}
          <div className="glass p-7 rounded-[2.5rem]">
             <div className="flex items-start gap-4">
                <div className="bg-blue-500/15 p-2 rounded-xl border border-blue-500/10">
                   <Info className="text-blue-400" size={20} />
                </div>
                <div>
                   <h5 className="text-[14px] font-black text-white mb-2 tracking-tight uppercase">Distribution Cycle</h5>
                   <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Tokens are distributed every <span className="text-white">Sunday</span>. Your allocation is weighted by your total <span className="text-orange-400">BP balance</span> and historical cultural engagement.
                   </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
