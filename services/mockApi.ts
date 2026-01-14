
import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const mockApi = {
  async getUserProfile(): Promise<User> {
    const tg = window.Telegram?.WebApp;
    // This is the CRITICAL source of truth for Telegram Mini Apps
    const tgUser = tg?.initDataUnsafe?.user;
    
    // If no Telegram user is found and we aren't in a dev environment, 
    // we must block access as we cannot identify the user.
    if (!tgUser && !IS_DEV) {
       throw new Error("TELEGRAM_USER_REQUIRED");
    }

    // Use actual Telegram ID, fallback to mock ID only for local testing
    const realId = tgUser?.id || 123456;
    
    const profile = {
      telegram_id: realId,
      username: tgUser?.username || tgUser?.first_name || `warrior_${realId}`,
      first_name: tgUser?.first_name || 'Warrior'
    };

    try {
      // Sync with Supabase: This creates the user and mining record if missing
      const user = await api.getOrCreateUser(profile.telegram_id, profile);
      
      // Update local persistent store for offline/cache capability
      const store = db.getStore(profile.telegram_id);
      db.saveStore({ ...store, user }, profile.telegram_id);
      
      return user;
    } catch (e) {
      console.warn("Supabase profile sync failed, falling back to local cache:", e);
      const localStore = db.getStore(profile.telegram_id);
      // If we have nothing even in local storage, we must throw
      if (!localStore.user.telegram_id) throw new Error("INITIALIZATION_FAILED");
      return localStore.user;
    }
  },

  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
      const status = await api.getMiningStatus(userId);
      let culturalBp = 0;
      
      if (supabase) {
        const { data } = await supabase
          .from('users') 
          .select('cultural_bp')
          .eq('telegram_id', userId)
          .maybeSingle();
        culturalBp = data?.cultural_bp || 0;
      }
      
      const enrichedStatus = {
        ...status,
        energy_regen_rate: 1,
        cultural_multiplier: 1 + (culturalBp / 10000)
      };

      const store = db.getStore(userId);
      db.saveStore({ ...store, status: enrichedStatus }, userId);
      return enrichedStatus;
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

    try {
      await api.updateBalanceAndEnergy(userId, bpEarned, taps);
    } catch (e) {}
    
    return { success: true, data: { bp_earned: bpEarned } };
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
    } catch (e) {}

    const taskIndex = store.tasks.findIndex((t: any) => t.id === taskId);
    store.tasks[taskIndex].completed = true;
    store.user.bp_balance += store.tasks[taskIndex].bp_reward;
    store.user.cultural_bp += store.tasks[taskIndex].cultural_bp_reward;
    store.status.cultural_multiplier = 1 + (store.user.cultural_bp / 10000);
    db.saveStore(store, userId);
    
    return { success: true };
  },

  async getLeaderboard() {
    if (!supabase) {
      return [
        { username: 'Grand_Vizier', bp: 5000000, level: 100 },
        { username: 'Sardar_Warrior', bp: 2000000, level: 80 }
      ];
    }
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
