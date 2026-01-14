
import { User, MiningStatus, CulturalTask } from '../types';
import { api, supabase } from './supabase';

export const mockApi = {
  async getUserProfile(): Promise<User> {
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    
    if (!tgUser) {
      // In production, we throw an error if not in Telegram
      throw new Error("Please open this app from within Telegram.");
    }

    const profile = {
      id: tgUser.id,
      username: tgUser.username || `warrior_${tgUser.id}`,
      first_name: tgUser.first_name || 'Guest',
      last_name: tgUser.last_name || '',
      photo_url: (tgUser as any)?.photo_url || ''
    };

    const user = await api.getOrCreateUser(profile.id, profile);

    const startParam = (tg?.initDataUnsafe as any)?.start_param;
    if (startParam && startParam.startsWith('ref_')) {
      const referrerCode = startParam.replace('ref_', '');
      await api.processReferral(profile.id, referrerCode);
    }

    return user;
  },

  async getMiningStatus(userId: number): Promise<MiningStatus> {
    const status = await api.getMiningStatus(userId);
    const { data: user } = await supabase.from('users').select('cultural_bp').eq('telegram_id', userId).single();
    
    const multiplier = 1 + ((user?.cultural_bp || 0) / 10000);
    return {
      energy: status.energy,
      max_energy: status.max_energy,
      energy_regen_rate: 1,
      tap_value: status.tap_value,
      cultural_multiplier: multiplier
    };
  },

  async tap(taps: number): Promise<any> {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!userId) return { success: false };

    const { data: user } = await supabase.from('users').select('cultural_bp').eq('telegram_id', userId).single();
    const multiplier = 1 + ((user?.cultural_bp || 0) / 10000);
    const bpEarned = Math.floor(taps * multiplier);

    await api.updateBalanceAndEnergy(userId, bpEarned, taps);
    
    return { success: true, data: { bp_earned: bpEarned } };
  },

  async getTasks(): Promise<CulturalTask[]> {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!userId) return [];
    return await api.getTasks(userId);
  },

  async completeTask(taskId: number): Promise<any> {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!userId) return { success: false };

    const allTasks = await this.getTasks();
    const task = allTasks.find(t => t.id === taskId);
    if (!task || task.completed) return { success: false };
    await api.completeTask(userId, taskId, task.bp_reward, task.cultural_bp_reward);
    return { success: true };
  },

  async getLeaderboard() {
    const { data, error } = await supabase
      .from('users')
      .select('username, bp_balance, level')
      .order('bp_balance', { ascending: false })
      .limit(10);
    if (error) return [];
    return data.map(d => ({ username: d.username, bp: d.bp_balance, level: d.level }));
  }
};
