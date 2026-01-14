import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const mockApi = {
  // ------------------ GET OR CREATE USER ------------------
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
      const dbUser = await api.getOrCreateUser(profile.telegram_id, profile);

      return {
        telegram_id: dbUser.telegram_id,
        username: dbUser.username,
        bp_balance: dbUser.points || 0,
        cultural_bp: dbUser.cultural_points || 0,
        level: dbUser.level || 1,
        referral_code: dbUser.referral_code || ''
      };
    } catch (e) {
      const localStore = db.getStore(realId);
      return localStore.user;
    }
  },

  // ------------------ GET MINING STATUS ------------------
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

  // ------------------ TAP ACTION ------------------
  async tap(taps: number): Promise<{ success: boolean }> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    const store = db.getStore(userId);

    const bpEarned = Math.floor(taps * (store.status.cultural_multiplier || 1));

    // Sync to database
    api.updateBalanceAndEnergy(userId, bpEarned, taps).catch(() => {});

    return { success: true };
  },

  // ------------------ GET TASKS ------------------
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
      return db.getStore(userId).tasks;
    }
  },

  // ------------------ COMPLETE TASK ------------------
  async completeTask(taskId: string): Promise<{ success: boolean }> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;

    try {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return { success: false };

      return await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
    } catch (e) {
      console.error('completeTask failed:', e);
      return { success: false };
    }
  },

  // ------------------ GET LEADERBOARD ------------------
  async getLeaderboard(): Promise<{ username: string; bp: number; level: number; photo_url: string }[]> {
    if (!supabase) return [];

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
        photo_url: d.avatar_url
      }));
    } catch (e) {
      console.error('getLeaderboard failed:', e);
      return [];
    }
  },

  // ------------------ GET REFERRAL COUNT ------------------
  async getReferralCount(): Promise<number> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;

    return await api.getReferralCount(userId).catch(() => 0);
  }
};
