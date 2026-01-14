
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
      const telegramUsername = profile.username || profile.first_name || `user_${telegramId}`;
      const firstName = profile.first_name || 'Warrior';
      const photoUrl = profile.photo_url || '';

      // FORCE UPSERT: This ensures the user is DEFINITELY in the 'users' table
      const { data: user, error } = await supabase
        .from('users')
        .upsert({ 
          telegram_id: telegramId, 
          username: telegramUsername, 
          first_name: firstName,
          photo_url: photoUrl
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (error) {
        console.error("Supabase Upsert Error:", error);
        throw error;
      }

      // Handle mining setup if it's a new user
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
          this.sendBotNotification(telegramId, `Welcome *${firstName}*! 🪙 Your BP Treasury is now active.`)
        ]);
      }

      return user;
    } catch (e: any) {
      console.error("API getOrCreateUser Fatal Error:", e.message);
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
      // These RPCs must exist in your Supabase 'SQL Editor'
      const { error: bpErr } = await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
      const { error: enErr } = await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
      
      if (bpErr || enErr) console.error("Balance Sync Error:", bpErr || enErr);
    } catch (e) {
      console.error("Critical Tap Sync Exception:", e);
    }
  },

  async getTasks(telegramId: number) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('cultural_tasks')
        .select('*, task_completions!left(id)')
        .eq('task_completions.user_id', telegramId);
      
      if (error) throw error;
      return (data || []).map((t: any) => ({ 
        ...t, 
        completed: Array.isArray(t.task_completions) && t.task_completions.length > 0 
      }));
    } catch (e) {
      return [];
    }
  },

  async completeTask(telegramId: number, taskId: number, bpReward: number, culturalBpReward: number) {
    if (!supabase) return { success: false };
    try {
      // 1. Mark as completed in the table
      const { error: taskErr } = await supabase.from('task_completions').insert([{ user_id: telegramId, task_id: taskId }]);
      if (taskErr) throw taskErr;

      // 2. Reward the user (updates bp_balance in 'users' table)
      const { error: rewardErr } = await supabase.rpc('reward_user', { t_id: telegramId, bp: bpReward, cbp: culturalBpReward });
      if (rewardErr) throw rewardErr;

      return { success: true };
    } catch (e) {
      console.error("Task Completion Database Error:", e);
      return { success: false };
    }
  },

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
      return 0;
    }
  }
};
