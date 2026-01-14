
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
      username: tgUser?.username || tgUser?.first_name || `user_${realId}`,
      first_name: tgUser?.first_name || 'Warrior',
      photo_url: tgUser?.photo_url || ''
    };

    try {
      // Strict database sync: Add/Update the user in the 'users' table
      const user = await api.getOrCreateUser(profile.telegram_id, profile);
      
      const store = db.getStore(profile.telegram_id);
      db.saveStore({ ...store, user }, profile.telegram_id);
      
      return user;
    } catch (e) {
      console.warn("Supabase handshake failed, using cache");
      const localStore = db.getStore(profile.telegram_id);
      if (localStore.user.telegram_id === realId) return localStore.user;
      
      return {
        telegram_id: realId,
        username: profile.username,
        bp_balance: 0,
        cultural_bp: 0,
        level: 1,
        referral_code: ''
      };
    }
  },

  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
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

    // Sync to database
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
    try {
      const store = db.getStore(userId);
      const task = store.tasks.find((t: any) => t.id === taskId);
      if (!task || task.completed) return { success: false };
      
      // Save information into database
      const res = await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
      return res;
    } catch (e) {
      return { success: false };
    }
  },

  async getLeaderboard() {
    if (!supabase) return [];
    try {
      const { data } = await supabase
        .from('users')
        .select('username, bp_balance, level, photo_url')
        .order('bp_balance', { ascending: false })
        .limit(10);
      return (data || []).map(d => ({ 
        username: d.username, 
        bp: d.bp_balance, 
        level: d.level,
        photo_url: d.photo_url 
      }));
    } catch (e) {
      return [];
    }
  }
};
