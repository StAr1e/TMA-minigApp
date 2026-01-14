
import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

export const mockApi = {
  async getUserProfile(): Promise<User> {
    // Fixed: window.Telegram is now typed via types.ts
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    
    const profile = tgUser ? {
      id: tgUser.id,
      username: tgUser.username || `warrior_${tgUser.id}`,
      first_name: tgUser.first_name || 'Warrior',
      last_name: tgUser.last_name || '',
      photo_url: (tgUser as any)?.photo_url || ''
    } : { id: 123456, username: 'Local_Warrior', first_name: 'Local', last_name: '', photo_url: '' };

    try {
      const user = await api.getOrCreateUser(profile.id, profile);
      const startParam = (tg?.initDataUnsafe as any)?.start_param;
      if (startParam && startParam.startsWith('ref_')) {
        await api.processReferral(profile.id, startParam.replace('ref_', ''));
      }
      return user;
    } catch (e) {
      console.warn("DB offline or profile load failed, using local fallback.", e);
      return db.getStore().user;
    }
  },

  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
      const status = await api.getMiningStatus(userId);
      let culturalBp = 0;
      if (supabase) {
        const { data } = await supabase.from('users').select('cultural_bp').eq('telegram_id', userId).single();
        culturalBp = data?.cultural_bp || 0;
      }
      return {
        ...status,
        energy_regen_rate: 1,
        cultural_multiplier: 1 + (culturalBp / 10000)
      };
    } catch (e) {
      console.warn("Mining status load failed, using local fallback.");
      return db.getStore().status;
    }
  },

  async tap(taps: number): Promise<any> {
    // Fixed: window.Telegram is now typed
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 123456;
    try {
      let multiplier = 1;
      if (supabase) {
        const { data } = await supabase.from('users').select('cultural_bp').eq('telegram_id', userId).single();
        multiplier = 1 + ((data?.cultural_bp || 0) / 10000);
      }
      const bpEarned = Math.floor(taps * multiplier);
      await api.updateBalanceAndEnergy(userId, bpEarned, taps);
      return { success: true, data: { bp_earned: bpEarned } };
    } catch (e) {
      const store = db.getStore();
      const bpEarned = Math.floor(taps * store.status.cultural_multiplier);
      db.updateUser({ bp_balance: store.user.bp_balance + bpEarned });
      db.updateStatus({ energy: Math.max(0, store.status.energy - taps) });
      return { success: true };
    }
  },

  async getTasks(): Promise<CulturalTask[]> {
    // Fixed: window.Telegram is now typed
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 123456;
    try {
      return await api.getTasks(userId);
    } catch (e) {
      return db.getStore().tasks;
    }
  },

  async completeTask(taskId: number): Promise<any> {
    // Fixed: window.Telegram is now typed
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 123456;
    try {
      const allTasks = await this.getTasks();
      const task = allTasks.find(t => t.id === taskId);
      if (!task || task.completed) return { success: false };
      await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
      return { success: true };
    } catch (e) {
      const store = db.getStore();
      const updatedTasks = store.tasks.map((t: any) => t.id === taskId ? { ...t, completed: true } : t);
      db.saveStore({ ...store, tasks: updatedTasks });
      return { success: true };
    }
  },

  async getLeaderboard() {
    try {
      if (!supabase) throw new Error("DB_OFFLINE");
      const { data } = await supabase.from('users').select('username, bp_balance, level').order('bp_balance', { ascending: false }).limit(10);
      return (data || []).map(d => ({ username: d.username, bp: d.bp_balance, level: d.level }));
    } catch (e) {
      return [{ username: 'Sample Warrior', bp: 50000, level: 10 }];
    }
  }
};
