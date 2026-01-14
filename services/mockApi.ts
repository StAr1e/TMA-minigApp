
import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const mockApi = {
  async getUserProfile(): Promise<User> {
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    
    if (!tgUser && !IS_DEV) throw new Error("TELEGRAM_USER_REQUIRED");

    const realId = tgUser?.id || 123456;
    const profile = {
      telegram_id: realId,
      username: tgUser?.username || tgUser?.first_name || `warrior_${realId}`,
      first_name: tgUser?.first_name || 'Warrior'
    };

    try {
      // Direct fast-path: Don't await if we already have a cached user and aren't in force-refresh mode
      // However, for Mini Apps, syncing once per session is standard.
      return await api.getOrCreateUser(profile.telegram_id, profile);
    } catch (e) {
      console.error("Supabase sync failed, using local DB");
      const localStore = db.getStore(profile.telegram_id);
      return localStore.user;
    }
  },

  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
      // Parallelize internal Supabase checks where possible
      const status = await api.getMiningStatus(userId);
      return {
        ...status,
        energy_regen_rate: 1,
        cultural_multiplier: status.cultural_multiplier || 1.0
      };
    } catch (e) {
      return db.getStore(userId).status;
    }
  },

  async tap(taps: number): Promise<any> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    const store = db.getStore(userId);
    const bpEarned = Math.floor(taps * (store.status.cultural_multiplier || 1));
    
    db.updateUser(userId, { bp_balance: (store.user.bp_balance || 0) + bpEarned });
    db.updateStatus(userId, { energy: Math.max(0, store.status.energy - taps) });

    api.updateBalanceAndEnergy(userId, bpEarned, taps).catch(() => {});
    return { success: true };
  },

  async getTasks(): Promise<CulturalTask[]> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    try {
      const tasks = await api.getTasks(userId);
      return tasks.length > 0 ? tasks : db.getStore(userId).tasks;
    } catch (e) {
      return db.getStore(userId).tasks;
    }
  },

  async completeTask(taskId: number): Promise<any> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    const store = db.getStore(userId);
    const task = store.tasks.find((t: any) => t.id === taskId);
    if (!task || task.completed) return { success: false };

    try {
      await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
      const tasks = await api.getTasks(userId);
      return { success: true, tasks };
    } catch (e) {
      return { success: false };
    }
  },

  async getLeaderboard() {
    if (!supabase) return [];
    try {
      const { data } = await supabase
        .from('users')
        .select('username, bp_balance, level')
        .order('bp_balance', { ascending: false })
        .limit(10);
      return (data || []).map(d => ({ username: d.username, bp: d.bp_balance, level: d.level }));
    } catch (e) {
      return [];
    }
  }
};
