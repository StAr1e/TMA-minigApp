
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BOT_TOKEN = '8372930912:AAGthTYgZGfpzniUG9wiUmnCYxiTysLCA4k';

export const api = {
  async sendBotNotification(chat_id: number, text: string) {
    if (!BOT_TOKEN) return;
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' })
      });
    } catch (e) {
      console.error("Bot notification failed", e);
    }
  },

  async getOrCreateUser(telegramId: number, profile: any) {
    try {
      let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!user) {
        const referralCode = `BALOCH_${Math.random().toString(36).substring(7).toUpperCase()}`;
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{ 
            telegram_id: telegramId, 
            username: profile.username || `user_${telegramId}`, 
            first_name: profile.first_name || 'Warrior',
            bp_balance: 0, 
            cultural_bp: 0, 
            level: 1, 
            referral_code: referralCode
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        
        await this.sendBotNotification(telegramId, `Welcome *${profile.first_name || 'Warrior'}*! 🪙 Your journey in BalochCoin begins.`);
        
        try { 
          await supabase.from('mining_status').insert([{ 
            telegram_id: telegramId, 
            energy: 1000, 
            max_energy: 1000, 
            tap_value: 1 
          }]); 
        } catch (e) {}
        
        return newUser;
      }
      return user;
    } catch (e: any) {
      console.error("Supabase Error:", e.message);
      throw new Error("DB_OFFLINE");
    }
  },

  async getMiningStatus(telegramId: number) {
    try {
      const { data, error } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      
      if (error) throw error;
      return data || { energy: 1000, max_energy: 1000, tap_value: 1 };
    } catch (e) {
      return { energy: 1000, max_energy: 1000, tap_value: 1 };
    }
  },

  async updateBalanceAndEnergy(telegramId: number, bpEarned: number, energyUsed: number) {
    try {
      await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
      await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
    } catch (e) {
      console.error("Sync failed", e);
    }
  },

  async getReferralCount(telegramId: number): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', telegramId);
      return count || 0;
    } catch (e) {
      return 0;
    }
  },

  async getTasks(telegramId: number) {
    try {
      const { data, error } = await supabase
        .from('cultural_tasks')
        .select('*, task_completions(id)')
        .eq('task_completions.user_id', telegramId);
      if (error) throw error;
      return (data || []).map((t: any) => ({ ...t, completed: t.task_completions?.length > 0 }));
    } catch (e) {
      return [];
    }
  },

  // Fix: Added missing completeTask method to handle task completions in the backend
  async completeTask(telegramId: number, taskId: number, bpReward: number, culturalBpReward: number) {
    try {
      const { error: completionError } = await supabase
        .from('task_completions')
        .insert([{ user_id: telegramId, task_id: taskId }]);
      
      if (completionError) throw completionError;

      const { error: balanceError } = await supabase.rpc('add_cultural_rewards', {
        t_id: telegramId,
        bp_earned: bpReward,
        cbp_earned: culturalBpReward
      });

      if (balanceError) throw balanceError;

      return { success: true };
    } catch (e) {
      console.error("Complete task failed", e);
      return { success: false };
    }
  }
};
