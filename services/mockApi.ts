import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const mockApi = {
  // -------------------- GET USER PROFILE --------------------
  async getUserProfile(): Promise<User> {
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;

    if (!tgUser && !IS_DEV) throw new Error('TELEGRAM_USER_REQUIRED');

    const telegram_id = tgUser?.id || 123456;
    const profile = {
      telegram_id,
      username: tgUser?.username || tgUser?.first_name || `user_${telegram_id}`,
      first_name: tgUser?.first_name || 'Warrior',
      photo_url: tgUser?.photo_url || ''
    };

    try {
      // Sync or create in Supabase
      const dbUser = await api.getOrCreateUser(profile.telegram_id, profile);

      const user: User = {
        telegram_id: dbUser.telegram_id,
        username: dbUser.username,
        bp_balance: dbUser.points || 0,
        cultural_bp: dbUser.cultural_points || 0,
        level: dbUser.level || 1,
        referral_code: dbUser.referral_code || '',
        photo_url: dbUser.avatar_url || ''
      };

      // Cache locally
      db.saveStore({ user }, telegram_id);

      return user;
    } catch (e) {
      console.error('getUserProfile error:', e);
      const localStore = db.getStore(telegram_id);
      return localStore.user;
    }
  },

  // -------------------- GET MINING STATUS --------------------
  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
      const status = await api.getMiningStatus(userId);
      return {
        ...status,
        energy_regen_rate: 1,
        cultural_multiplier: status.cultural_multiplier || 1.0
      };
    } catch (e) {
      console.error('getMiningStatus error:', e);
      const store = db.getStore(userId);
      return store.status || { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    }
  },

  // -------------------- TAP ACTION --------------------
  async tap(taps: number): Promise<any> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    const store = db.getStore(userId);
    const bpEarned = Math.floor(taps * (store.status?.cultural_multiplier || 1));

    // Update local cache
    db.updateUser(userId, { bp_balance: (store.user?.bp_balance || 0) + bpEarned });
    db.updateStatus(userId, { energy: Math.max(0, (store.status?.energy || 1000) - taps) });

    // Sync with Supabase
    api.updateBalanceAndEnergy(userId, bpEarned, taps).catch(() => {});

    return { success: true, data: { bp_earned: bpEarned } };
  },

  // -------------------- GET TASKS --------------------
  async getTasks(): Promise<CulturalTask[]> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;

    try {
      const dbTasks = await api.getTasks(userId);

      return dbTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        bp_reward: t.reward,
        cultural_bp_reward: t.cultural_flag ? 100 : 0,
        completed: t.completed,
        type: t.type,
        difficulty: 'medium',
        category: 'general'
      }));
    } catch (e) {
      console.error('getTasks error:', e);
      const store = db.getStore(userId);
      return store.tasks || [];
    }
  },

  // -------------------- COMPLETE TASK --------------------
  async completeTask(taskId: string): Promise<any> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;

    try {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === taskId);
      if (!task || task.completed) return { success: false };

      const result = await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);

      if (result.success) {
        const store = db.getStore(userId);
        // Update local cache
        const taskIndex = store.tasks.findIndex((t: any) => t.id === taskId);
        if (taskIndex !== -1) store.tasks[taskIndex].completed = true;

        db.updateUser(userId, {
          bp_balance: (store.user.bp_balance || 0) + task.bp_reward,
          cultural_bp: (store.user.cultural_bp || 0) + task.cultural_bp_reward
        });
        db.saveStore(store, userId);
      }

      return result;
    } catch (e) {
      console.error('completeTask error:', e);
      return { success: false };
    }
  },

  // -------------------- GET LEADERBOARD --------------------
  async getLeaderboard() {
    try {
      const { data } = await supabase
        .from('users')
        .select('username, points, avatar_url')
        .order('points', { ascending: false })
        .limit(10);

      return (data || []).map(d => ({
        username: d.username,
        bp: d.points || 0,
        level: 1,
        photo_url: d.avatar_url || ''
      }));
    } catch (e) {
      console.error('getLeaderboard error:', e);
      return [];
    }
  }
};
