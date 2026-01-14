import React, { useState, useEffect, useMemo } from 'react'; // Combine imports
import { User } from '../types';
import { mockApi } from '../services/mockApi';
import { Trophy, Medal, Star, Crown, ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  user: User;
}

const LeaderboardView: React.FC<Props> = ({ user }) => {
  const [board, setBoard] = useState<{ username: string, bp: number, level: number, photo_url?: string, telegram_id?: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockApi.getLeaderboard().then(data => {
      // Sort data descending by BP just in case the API didn't
      const sorted = [...data].sort((a, b) => b.bp - a.bp);
      setBoard(sorted);
      setLoading(false);
    });
  }, []);

  const userRank = useMemo(() => {
    const index = board.findIndex(p => p.username === user.username || p.telegram_id === user.telegram_id);
    return index !== -1 ? index + 1 : '100+';
  }, [board, user]);

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
           <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-orange-500 mb-4" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Retrieving Rankings</p>
           </div>
        ) : (
          board.map((player, idx) => (
            <div 
              key={idx} 
              className={`p-5 rounded-[2rem] glass border flex items-center justify-between transition-all ${
                player.username === user.username || player.telegram_id === user.telegram_id
                  ? 'border-orange-500/40 bg-orange-500/15' 
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
                   <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center font-black text-sm text-slate-300 overflow-hidden">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.username} className="w-full h-full object-cover" />
                      ) : (
                        player.username.charAt(0).toUpperCase()
                      )}
                   </div>
                   {idx < 3 && (
                     <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-[#0f172a] flex items-center justify-center">
                        <Star size={8} className="text-white fill-white" />
                     </div>
                   )}
                </div>
                <div>
                  <h4 className="font-extrabold text-[14px] flex items-center gap-2 text-white truncate max-w-[120px]">
                    {player.username}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.1em]">Lvl {player.level || 1}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="block font-black text-white font-orbitron tracking-tight text-sm">{(player.bp || 0).toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Tokens</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Persistent User Stats bar */}
      <div className="mt-8 glass p-6 rounded-[2.5rem] border border-white/10 flex items-center justify-between shadow-2xl mb-12 bg-slate-900/90">
         <div className="flex items-center gap-5">
            <div className="flex flex-col items-center min-w-[40px]">
               <span className="text-xl font-black text-orange-500 font-orbitron">#{userRank}</span>
               <span className="text-[9px] font-black uppercase text-slate-500">Rank</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10"></div>
            <div>
               <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                  {/* Fixed comparison by casting userRank or checking its type */}
                  {userRank === 1 ? 'Tribal King' : (typeof userRank === 'number' && userRank <= 10) ? 'Elite Warrior' : 'Verified Warrior'}
               </p>
               <p className="text-[10px] font-bold text-slate-500">Current Standing</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="text-right mr-2">
               <p className="text-[14px] font-black font-orbitron text-white">{user.bp_balance.toLocaleString()}</p>
               <p className="text-[8px] font-bold text-orange-500 uppercase">Total BP</p>
            </div>
            <button className="bg-orange-500/20 p-3 rounded-2xl border border-orange-500/30">
               <ChevronRight size={20} className="text-orange-500" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default LeaderboardView;
