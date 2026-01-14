
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Create a placeholder that won't crash the app on import
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined') 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const api = {
  async sendBotNotification(chat_id: number, text: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || botToken === 'undefined') return;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' })
      });
    } catch (e) {
      console.error("Bot notification failed", e);
    }
  },

  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) throw new Error("DB_OFFLINE");
    
    const referralCode = `BALOCH_${Math.random().toString(36).substring(7).toUpperCase()}`;
    let { data: user, error } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();

    if (error && error.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase.from('users').insert([{ 
        telegram_id: telegramId, 
        username: profile.username || `user_${telegramId}`, 
        first_name: profile.first_name,
        photo_url: profile.photo_url,
        bp_balance: 0, 
        cultural_bp: 0, 
        level: 1, 
        referral_code: referralCode
      }]).select().single();
      
      if (createError) throw createError;
      await this.sendBotNotification(telegramId, `Welcome *${profile.first_name}*! 🪙`);
      try { await supabase.from('mining_status').insert([{ telegram_id: telegramId, energy: 1000, max_energy: 1000, tap_value: 1 }]); } catch (e) {}
      return newUser;
    }
    return user;
  },

  /* Added processReferral to fix the error in mockApi.ts */
  async processReferral(userId: number, referrerCode: string) {
    if (!supabase) return;
    try {
      // Find the referrer by code
      const { data: referrer } = await supabase
        .from('users')
        .select('telegram_id, username')
        .eq('referral_code', referrerCode)
        .single();

      if (referrer && referrer.telegram_id !== userId) {
        // Check if referral already exists
        const { data: existing } = await supabase
          .from('referrals')
          .select('id')
          .eq('referred_id', userId)
          .single();

        if (!existing) {
          await supabase.from('referrals').insert([{
            referrer_id: referrer.telegram_id,
            referred_id: userId
          }]);
          
          // Reward the referrer
          await supabase.rpc('reward_user', { t_id: referrer.telegram_id, bp: 5000, cbp: 0 });
          await this.sendBotNotification(referrer.telegram_id, `New ally joined! You earned *5,000 BP* 🪙`);
        }
      }
    } catch (e) {
      console.error("Referral processing failed", e);
    }
  },

  async getReferralCount(telegramId: number): Promise<number> {
    if (!supabase) return 0;
    const { count } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', telegramId);
    return count || 0;
  },

  async getMiningStatus(telegramId: number) {
    if (!supabase) throw new Error("DB_OFFLINE");
    const { data } = await supabase.from('mining_status').select('*').eq('telegram_id', telegramId).single();
    return data || { energy: 1000, max_energy: 1000, tap_value: 1 };
  },

  async updateBalanceAndEnergy(telegramId: number, bpEarned: number, energyUsed: number) {
    if (!supabase) return;
    await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
    await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
  },

  async getTasks(telegramId: number) {
    if (!supabase) throw new Error("DB_OFFLINE");
    const { data } = await supabase.from('cultural_tasks').select('*, task_completions(id)').eq('task_completions.user_id', telegramId);
    return (data || []).map((task: any) => ({ ...task, completed: task.task_completions?.length > 0 }));
  },

  async completeTask(telegramId: number, taskId: number, bp: number, cbp: number) {
    if (!supabase) return;
    await supabase.from('task_completions').insert([{ user_id: telegramId, task_id: taskId }]);
    await supabase.rpc('reward_user', { t_id: telegramId, bp, cbp });
  }
};
