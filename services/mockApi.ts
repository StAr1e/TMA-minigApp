
import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';
import { db } from './db';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const mockApi = {
  /* -------------------- GET USER PROFILE -------------------- */
  async getUserProfile(): Promise<User> {
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;

    const realId = tgUser?.id || 123456;
    const profile = {
      telegram_id: realId,
      username: tgUser?.username || tgUser?.first_name || `user_${realId}`,
      first_name: tgUser?.first_name || 'Warrior',
      photo_url: tgUser?.photo_url || ''
    };

    try {
      // Upsert user into Supabase
      const dbUser = await api.getOrCreateUser(profile.telegram_id, profile);

      // Map database fields to frontend User type
      const user: User = {
        telegram_id: dbUser.telegram_id,
        username: dbUser.username || profile.username,
        bp_balance: dbUser.points || 0,
        cultural_bp: dbUser.cultural_points || 0,
        level: 1,
        referral_code: dbUser.telegram_id.toString() 
      };

      db.saveStore({ user }, realId);
      return user;
    } catch (e) {
      console.error("Profile fetch error, using local fallback:", e);
      const localStore = db.getStore(realId);
      return localStore.user;
    }
  },

  /* -------------------- GET MINING STATUS -------------------- */
  async getMiningStatus(userId: number): Promise<MiningStatus> {
    try {
      const status = await api.getMiningStatus(userId);
      return {
        energy: status.energy ?? 1000,
        max_energy: status.max_energy ?? 1000,
        tap_value: status.tap_value || 1,
        energy_regen_rate: 1,
        cultural_multiplier: status.cultural_multiplier || 1.0
      };
    } catch (e) {
      console.error("Mining status fetch error, using local fallback:", e);
      const store = db.getStore(userId);
      return store.status;
    }
  },

  /* -------------------- TAP ACTION -------------------- */
  async tap(taps: number): Promise<{ success: boolean; data?: { bp_earned: number } }> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    const store = db.getStore(userId);
    const multiplier = store?.status?.cultural_multiplier || 1;
    const bpEarned = Math.floor(taps * multiplier);

    db.updateUser(userId, { bp_balance: (store.user.bp_balance || 0) + bpEarned });
    api.updateBalanceAndEnergy(userId, bpEarned, taps).catch(e => console.error("Database sync tap error:", e));

    return { success: true, data: { bp_earned: bpEarned } };
  },

  /* -------------------- GET TASKS -------------------- */
  async getTasks(): Promise<CulturalTask[]> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    try {
      const dbTasks = await api.getTasks(userId);
      if (!dbTasks || dbTasks.length === 0) throw new Error("No tasks in DB");
      
      return dbTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        bp_reward: t.reward,
        cultural_bp_reward: t.cultural_flag ? 100 : 0,
        completed: t.completed || false,
        type: t.type || 'learn',
        difficulty: 'medium',
        category: 'general'
      }));
    } catch (e) {
      const store = db.getStore(userId);
      return store.tasks;
    }
  },

  /* -------------------- COMPLETE TASK -------------------- */
  async completeTask(taskId: string): Promise<{ success: boolean }> {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || 123456;
    try {
      const tasks = await this.getTasks();
      const task = tasks.find(t => String(t.id) === String(taskId));
      if (!task) return { success: false };
      return await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
    } catch (e) {
      return { success: false };
    }
  },

  /* -------------------- LEADERBOARD -------------------- */
  async getLeaderboard() {
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
      return [];
    }
  }
};
