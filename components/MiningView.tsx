
import React, { useState, useRef } from 'react';
import { User, MiningStatus } from '../types';
import { Zap, Coins, Flame } from 'lucide-react';

interface Props {
  user: User;
  status: MiningStatus;
  onTap: (count: number) => void;
}

const MiningView: React.FC<Props> = ({ user, status, onTap }) => {
  const [taps, setTaps] = useState<{ id: number, x: number, y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fallback values if status is incomplete
  const culturalMultiplier = status?.cultural_multiplier || 1.0;
  const tapValue = status?.tap_value || 1;
  const energy = status?.energy ?? 0;
  const maxEnergy = status?.max_energy || 1000;

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (energy <= 0) return;

    const id = Date.now();
    setTaps(prev => [...prev, { id, x: clientX, y: clientY }]);
    onTap(1);

    // Fixed: window.Telegram is now typed
    if (window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      } catch (err) {}
    }

    setTimeout(() => {
      setTaps(prev => prev.filter(t => t.id !== id));
    }, 800);
  };

  return (
    <div className="flex flex-col items-center px-6 pt-4 h-full relative" ref={containerRef}>
      {/* Balance Glass Card */}
      <div className="w-full glass rounded-[2.5rem] p-6 flex flex-col items-center mb-8 relative overflow-hidden shadow-2xl">
        <div className="flex items-center gap-1.5 mb-2">
           <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
           <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">BP Treasury</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/20 p-2 rounded-xl">
            <Coins className="text-orange-400" size={28} />
          </div>
          <span className="text-5xl font-black font-orbitron tracking-tighter text-white tabular-nums">
            {(user?.bp_balance ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="mt-5 flex items-center gap-3">
           <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-2">
              <Flame size={14} className="text-orange-500" />
              <span className="text-orange-400 text-xs font-black">x{culturalMultiplier.toFixed(2)}</span>
           </div>
           <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-2">
              <span className="text-slate-400 text-[10px] font-bold uppercase">Profit/Tap</span>
              <span className="text-white text-xs font-black">+{Math.floor(tapValue * culturalMultiplier)}</span>
           </div>
        </div>
      </div>

      {/* Main Tapper */}
      <div className="flex-1 flex items-center justify-center w-full min-h-[300px] mb-8">
        <div 
          className="relative w-72 h-72 cursor-pointer active:scale-95 transition-all duration-75 select-none touch-none"
          onMouseDown={handleTouch}
          onTouchStart={handleTouch}
        >
          <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-[40px] animate-pulse"></div>
          <div className="absolute -inset-6 border-2 border-orange-500/5 rounded-full animate-[ping_3s_linear_infinite]"></div>
          
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-orange-300 via-orange-500 to-orange-800 p-1.5 coin-glow">
            <div className="w-full h-full rounded-full bg-[#0a0f1e] flex items-center justify-center overflow-hidden relative border-t border-white/20">
              <div className="absolute inset-4 border border-white/5 rounded-full"></div>
              <div className="flex flex-col items-center z-10">
                <span className="text-8xl font-black text-orange-500 font-orbitron drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]">B</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Energy System */}
      <div className="w-full mb-6">
        <div className="flex justify-between items-end mb-3 px-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stamina Units</span>
            <div className="flex items-center gap-2">
              <Zap className="text-orange-400 fill-orange-400" size={16} />
              <span className="text-lg font-black font-orbitron tracking-wider">{energy} <span className="text-slate-600 text-sm">/ {maxEnergy}</span></span>
            </div>
          </div>
        </div>
        <div className="h-5 w-full glass rounded-full p-1.5 border border-white/5 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-300 progress-glow relative"
            style={{ width: `${(energy / maxEnergy) * 100}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20 animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
      </div>

      {/* Floating Indicators */}
      {taps.map(tap => (
        <div 
          key={tap.id}
          className="tap-animation font-orbitron"
          style={{ left: tap.x - 15, top: tap.y - 50 }}
        >
          +{Math.floor(tapValue * culturalMultiplier)}
        </div>
      ))}
    </div>
  );
};

export default MiningView;
