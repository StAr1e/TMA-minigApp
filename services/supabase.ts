
import { createClient } from '@supabase/supabase-js';

// Access standard environment variables directly
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// Initialize Supabase only if credentials exist
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Developer feedback for local environment
if (!supabase && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  console.warn("Database keys (SUPABASE_URL/SUPABASE_ANON_KEY) missing from .env. Some features will be disabled.");
}

export const api = {
  async sendBotNotification(chat_id: number, text: string) {
    if (!BOT_TOKEN) {
      console.warn("Notification skipped: BOT_TOKEN missing from environment.");
      return;
    }
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' })
      });
    } catch (e) {
      console.error("Telegram API call failed:", e);
    }
  },

  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) throw new Error("Database not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment.");
    
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
            username: profile.username || `warrior_${telegramId}`, 
            first_name: profile.first_name || 'Warrior',
            bp_balance: 0, 
            cultural_bp: 0, 
            level: 1, 
            referral_code: referralCode
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        
        // Initialize mining status
        try { 
          await supabase.from('mining_status').insert([{ 
            telegram_id: telegramId, 
            energy: 1000, 
            max_energy: 1000, 
            tap_value: 1 
          }]); 
        } catch (e) {}

        await this.sendBotNotification(telegramId, `Welcome *${profile.first_name || 'Warrior'}*! 🪙 Your tribal journey begins.`);
        return newUser;
      }
      
      return user;
    } catch (e: any) {
      console.error("API getOrCreateUser Error:", e.message);
      throw e;
    }
  },

  async getMiningStatus(telegramId: number) {
    if (!supabase) return { energy: 1000, max_energy: 1000, tap_value: 1 };
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
    if (!supabase) return;
    try {
      await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
      await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
    } catch (e) {
      console.error("Sync to Supabase failed:", e);
    }
  },

  async getReferralCount(telegramId: number): Promise<number> {
    if (!supabase) return 0;
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
    if (!supabase) return [];
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

  async completeTask(telegramId: number, taskId: number, bpReward: number, culturalBpReward: number) {
    if (!supabase) return { success: false };
    try {
      await supabase
        .from('task_completions')
        .insert([{ user_id: telegramId, task_id: taskId }]);
      
      await supabase.rpc('reward_user', {
        t_id: telegramId,
        bp: bpReward,
        cbp: culturalBpReward
      });

      return { success: true };
    } catch (e) {
      console.error("Complete task failed", e);
      return { success: false };
    }
  }
};
