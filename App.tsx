
import React, { useState, useEffect } from 'react';
import { Home, Book, Trophy, Wallet, User as UserIcon, Users, AlertTriangle } from 'lucide-react';
import { User, MiningStatus } from './types';
import { mockApi } from './services/mockApi';
import MiningView from './components/MiningView';
import TasksView from './components/TasksView';
import LeaderboardView from './components/LeaderboardView';
import WalletView from './components/WalletView';
import ReferralView from './components/ReferralView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<MiningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0f172a');
      tg.setBackgroundColor('#0f172a');
    }

    const init = async () => {
      try {
        setLoading(true);
        
        // Instant Preview: Set profile from Telegram data immediately while we sync
        const tgUser = tg?.initDataUnsafe?.user;
        if (tgUser) {
          setUser({
            telegram_id: tgUser.id,
            username: tgUser.username || tgUser.first_name || 'Warrior',
            bp_balance: 0,
            cultural_bp: 0,
            level: 1,
            referral_code: ''
          });
        }

        // Run API calls in parallel to maximize speed
        const [userData, statusData] = await Promise.all([
          mockApi.getUserProfile(),
          mockApi.getMiningStatus(tgUser?.id || 123456)
        ]);
        
        setUser(userData);
        setStatus(statusData);
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.impactOccurred('light');
        }
      } catch (err: any) {
        console.error("Critical Startup Error:", err);
        if (err.message === "TELEGRAM_USER_REQUIRED") {
          setError("PLEASE_OPEN_IN_TELEGRAM");
        } else {
          setError("CONNECTION_ERROR");
        }
      } finally {
        setLoading(false);
      }
    };
    
    init();

    const regenInterval = setInterval(() => {
      setStatus(prev => {
        if (!prev || prev.energy >= prev.max_energy) return prev;
        return { ...prev, energy: Math.min(prev.max_energy, prev.energy + 1) };
      });
    }, 2000);

    return () => clearInterval(regenInterval);
  }, []);

  const handleTap = async (count: number) => {
    if (!status || status.energy < count) return;
    
    const multiplier = status.cultural_multiplier || 1;
    const bpEarned = Math.floor(count * multiplier);
    
    setUser(prev => prev ? { ...prev, bp_balance: prev.bp_balance + bpEarned } : null);
    setStatus(prev => prev ? { ...prev, energy: prev.energy - count } : null);

    if (user) {
      mockApi.tap(count).catch(e => console.error("Tapping sync error:", e));
    }
  };

  if (error === "PLEASE_OPEN_IN_TELEGRAM") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-10 text-center">
        <div className="bg-orange-500/10 p-6 rounded-full mb-6">
          <AlertTriangle className="text-orange-500" size={60} />
        </div>
        <h1 className="text-2xl font-black mb-4 text-white">Open in Telegram</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          BalochCoin heritage rewards are only available within the Telegram ecosystem.
        </p>
        <button 
          onClick={() => window.location.href = 'https://t.me/BalochCoinBot'}
          className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
        >
          Open BalochCoin
        </button>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="relative">
           <div className="w-16 h-16 border-4 border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2">
           <p className="text-slate-200 font-black tracking-widest uppercase text-xs">Entering Arena</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!user || !status) return null;
    switch (activeTab) {
      case 'home': return <MiningView user={user} status={status} onTap={handleTap} />;
      case 'tasks': return <TasksView />;
      case 'leaderboard': return <LeaderboardView user={user} />;
      case 'friends': return <ReferralView user={user} />;
      case 'wallet': return <WalletView user={user} />;
      default: return <MiningView user={user} status={status} onTap={handleTap} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-transparent text-white overflow-hidden max-w-md mx-auto relative">
      <div className="px-5 pt-6 pb-2 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center border border-white/10 shadow-lg">
             <span className="font-black text-orange-500">{user?.username?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm truncate max-w-[140px]">{user?.username}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Warrior Rank</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass px-3 py-1.5 rounded-xl border border-white/5">
            <span className="text-[11px] font-black text-white uppercase">Level {user?.level}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {renderContent()}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-50">
        <div className="glass rounded-[2rem] p-2 flex justify-between items-center shadow-2xl border border-white/10">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={22} />} />
          <NavButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<Book size={22} />} />
          <NavButton active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} icon={<Trophy size={22} />} />
          <NavButton active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} icon={<Users size={22} />} />
          <NavButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={<Wallet size={22} />} />
        </div>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode }> = ({ active, onClick, icon }) => (
  <button 
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 rounded-2xl ${active ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500'}`}
  >
    {icon}
    {active && <div className="absolute -bottom-1 w-1 h-1 bg-orange-500 rounded-full"></div>}
  </button>
);

export default App;
