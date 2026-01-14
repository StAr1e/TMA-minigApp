
import React, { useState, useEffect } from 'react';
import { Home, Book, Trophy, Wallet, User as UserIcon, Users } from 'lucide-react';
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

  useEffect(() => {
    // Fixed: window.Telegram is now typed
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.setHeaderColor('#0f172a');
      window.Telegram.WebApp.setBackgroundColor('#0f172a');
    }

    const init = async () => {
      try {
        const userData = await mockApi.getUserProfile();
        const statusData = await mockApi.getMiningStatus(userData.telegram_id);
        setUser(userData);
        setStatus(statusData);
      } catch (err: any) {
        console.error("Initialization failed", err);
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
    
    const bpEarned = Math.floor(count * (status.cultural_multiplier || 1));
    setUser(prev => prev ? { ...prev, bp_balance: prev.bp_balance + bpEarned } : null);
    setStatus(prev => prev ? { ...prev, energy: prev.energy - count } : null);

    try {
      await mockApi.tap(count);
    } catch (e) {
      console.error("Tap sync failed", e);
    }
  };

  if (loading || !user || !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-400 font-bold tracking-widest uppercase text-xs animate-pulse">Initializing BalochCoin</p>
      </div>
    );
  }

  const renderContent = () => {
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
    <div className="flex flex-col h-screen bg-transparent text-white overflow-hidden max-w-md mx-auto relative font-jakarta">
      {/* Top Bar */}
      <div className="px-5 pt-6 pb-2 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg">
             <UserIcon size={18} className="text-orange-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight">{user.username}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Warrior Rank</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-[11px] font-black text-white">LVL {user.level}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {renderContent()}
      </div>

      {/* Dock Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-50">
        <div className="glass rounded-[2rem] p-2 flex justify-between items-center shadow-2xl border border-white/10 relative overflow-hidden">
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
    className={`relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 rounded-2xl ${active ? 'text-orange-500 bg-orange-500/10 nav-active-glow' : 'text-slate-500 hover:text-slate-300'}`}
  >
    {icon}
    {active && <div className="absolute -bottom-1 w-1 h-1 bg-orange-500 rounded-full"></div>}
  </button>
);

export default App;
