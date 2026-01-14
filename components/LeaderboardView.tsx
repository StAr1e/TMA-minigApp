
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mockApi } from '../services/mockApi';
/* Added ChevronRight to imports */
import { Trophy, Medal, Star, Crown, ChevronRight } from 'lucide-react';

interface Props {
  user: User;
}

const LeaderboardView: React.FC<Props> = ({ user }) => {
  const [board, setBoard] = useState<{ username: string, bp: number, level: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockApi.getLeaderboard().then(data => {
      setBoard(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="px-6 py-4 flex flex-col h-full pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black mb-1">Global Top</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">The strongest tribes</p>
        </div>
        <div className="glass p-3.5 rounded-2xl shadow-xl">
           <Trophy className="text-yellow-500" size={26} />
        </div>
      </div>

      <div className="flex-1 space-y-3.5">
        {loading ? (
           [1,2,3,4,5,6].map(i => <div key={i} className="h-20 w-full glass animate-pulse rounded-3xl"></div>)
        ) : (
          board.map((player, idx) => (
            <div 
              key={idx} 
              className={`p-5 rounded-[2rem] glass border flex items-center justify-between transition-all ${
                player.username === user.username 
                  ? 'border-orange-500/40 bg-orange-500/10' 
                  : 'border-white/5'
              } ${idx < 3 ? 'bg-slate-900/80' : ''}`}
            >
              <div className="flex items-center gap-5">
                <div className="w-8 flex justify-center">
                  {idx === 0 ? <Crown className="text-yellow-400" size={24} /> : 
                   idx === 1 ? <Medal className="text-slate-300" size={24} /> :
                   idx === 2 ? <Medal className="text-orange-500" size={24} /> :
                   <span className="text-sm font-black text-slate-600 font-orbitron">#{idx + 1}</span>}
                </div>
                <div className="relative">
                   <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center font-black text-sm text-slate-300">
                      {player.username.charAt(0).toUpperCase()}
                   </div>
                   {idx < 3 && (
                     <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-[#0f172a] flex items-center justify-center">
                        <Star size={8} className="text-white fill-white" />
                     </div>
                   )}
                </div>
                <div>
                  <h4 className="font-extrabold text-[14px] flex items-center gap-2">
                    {player.username}
                    {player.username === user.username && <span className="text-[10px] bg-orange-500 px-1.5 py-0.5 rounded text-white font-black uppercase tracking-tighter">You</span>}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.1em]">Lvl {player.level}</span>
                    <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
                    <span className="text-[9px] text-orange-500/80 font-black uppercase tracking-[0.1em]">Warrior</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="block font-black text-white font-orbitron tracking-tight text-sm">{player.bp.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Tokens</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Persistent User Stats bar */}
      <div className="mt-8 glass p-6 rounded-[2.5rem] border border-white/10 flex items-center justify-between shadow-2xl mb-12">
         <div className="flex items-center gap-5">
            <div className="flex flex-col items-center">
               <span className="text-xl font-black text-white font-orbitron">481</span>
               <span className="text-[9px] font-black uppercase text-slate-500">Rank</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10"></div>
            <div>
               <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Elite 5% Club</p>
               <p className="text-[10px] font-bold text-slate-500">Keep tapping to climb</p>
            </div>
         </div>
         <button className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20">
            <ChevronRight size={20} className="text-white" />
         </button>
      </div>
    </div>
  );
};

export default LeaderboardView;