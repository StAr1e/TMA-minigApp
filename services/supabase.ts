
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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
      console.error("Telegram API call failed:", e);
    }
  },

  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) throw new Error("Database not configured.");
    
    try {
      // Identity data from Telegram
      const telegramUsername = profile.username || profile.first_name || `user_${telegramId}`;
      const firstName = profile.first_name || 'Warrior';

      // Use upsert to ensure we either create the user or update their current profile info
      const { data: user, error } = await supabase
        .from('users')
        .upsert({ 
          telegram_id: telegramId, 
          username: telegramUsername, 
          first_name: firstName,
          // These fields only set on first insert if using a trigger or handled via logic
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (error) throw error;

      // Handle first-time setup for mining status if not present
      const { data: status } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!status) {
        const referralCode = `BALOCH_${Math.random().toString(36).substring(7).toUpperCase()}`;
        await Promise.all([
          supabase.from('mining_status').insert([{ 
            telegram_id: telegramId, 
            energy: 1000, 
            max_energy: 1000, 
            tap_value: 1 
          }]),
          supabase.from('users').update({ referral_code: referralCode }).eq('telegram_id', telegramId),
          this.sendBotNotification(telegramId, `Welcome *${firstName}*! 🪙 Your data is now synced with the BalochCoin treasury.`)
        ]);
      }

      return user;
    } catch (e: any) {
      console.error("API getOrCreateUser Error:", e.message);
      throw e;
    }
  },

  async getMiningStatus(telegramId: number) {
    if (!supabase) return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    try {
      const { data, error } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      
      if (error) throw error;
      return data || { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    } catch (e) {
      return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    }
  },

  async updateBalanceAndEnergy(telegramId: number, bpEarned: number, energyUsed: number) {
    if (!supabase) return;
    try {
      // Syncing balances and energy to remote DB
      await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
      await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
    } catch (e) {
      console.error("Database sync failed for tap:", e);
    }
  },

  async getTasks(telegramId: number) {
    if (!supabase) return [];
    try {
      const { data } = await supabase
        .from('cultural_tasks')
        .select('*, task_completions(id)')
        .eq('task_completions.user_id', telegramId);
      return (data || []).map((t: any) => ({ ...t, completed: t.task_completions?.length > 0 }));
    } catch (e) {
      return [];
    }
  },

  async completeTask(telegramId: number, taskId: number, bpReward: number, culturalBpReward: number) {
    if (!supabase) return { success: false };
    try {
      await supabase.from('task_completions').insert([{ user_id: telegramId, task_id: taskId }]);
      // Update global user balance for task reward
      await supabase.rpc('reward_user', { t_id: telegramId, bp: bpReward, cbp: culturalBpReward });
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  },

  // Added getReferralCount to fix the missing property error in ReferralView.tsx
  async getReferralCount(telegramId: number): Promise<number> {
    if (!supabase) return 0;
    try {
      const { count, error } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', telegramId);
      
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error("API getReferralCount Error:", e);
      return 0;
    }
  }
};
