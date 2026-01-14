
import { createClient } from '@supabase/supabase-js';

// Environment variables pulled from the system .env
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing from environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const api = {
  /**
   * Sends a notification via Telegram Bot API using process.env.TELEGRAM_BOT_TOKEN.
   */
  async sendBotNotification(chatId: number, text: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN not found in environment variables. Notification skipped.");
      return;
    }

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {
      console.error("Failed to send bot notification", e);
    }
  },

  async getOrCreateUser(telegramId: number, profile: { username?: string, first_name?: string, last_name?: string, photo_url?: string }) {
    try {
      const referralCode = `BALOCH_${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{ 
            telegram_id: telegramId, 
            username: profile.username || `user_${telegramId}`, 
            first_name: profile.first_name,
            last_name: profile.last_name,
            photo_url: profile.photo_url,
            bp_balance: 0, 
            cultural_bp: 0, 
            level: 1, 
            referral_code: referralCode,
            referral_milestone_claimed: false
          }])
          .select()
          .single();
        
        if (createError) throw createError;

        await this.sendBotNotification(telegramId, `Welcome to *BalochCoin*, ${profile.first_name}! 🪙 Your journey begins.`);
        
        try {
          await supabase.from('mining_status').insert([{
            telegram_id: telegramId,
            energy: 1000,
            max_energy: 1000,
            tap_value: 1
          }]);
        } catch (e) {}

        return newUser;
      } else if (user) {
        const { data: updatedUser } = await supabase
          .from('users')
          .update({
            username: profile.username || user.username,
            first_name: profile.first_name || user.first_name,
            last_name: profile.last_name || user.last_name,
            photo_url: profile.photo_url || user.photo_url
          })
          .eq('telegram_id', telegramId)
          .select()
          .single();
        return updatedUser || user;
      }
      throw error;
    } catch (err: any) {
      console.error("Supabase user sync error:", err);
      throw err;
    }
  },

  async processReferral(newUserId: number, referrerCode: string) {
    try {
      const { data: referrer } = await supabase
        .from('users')
        .select('telegram_id, referral_milestone_claimed, first_name')
        .eq('referral_code', referrerCode)
        .single();

      if (referrer && referrer.telegram_id !== newUserId) {
        const { data: existing } = await supabase
          .from('referrals')
          .select('id')
          .eq('referrer_id', referrer.telegram_id)
          .eq('referred_id', newUserId)
          .single();

        if (!existing) {
          await supabase.rpc('increment_bp', { 
            t_id: referrer.telegram_id, 
            earned: 5000 
          });

          await supabase.from('referrals').insert([{
            referrer_id: referrer.telegram_id,
            referred_id: newUserId
          }]);

          await this.sendBotNotification(referrer.telegram_id, `🤝 *New Ally Joined!* You earned 5,000 BP for recruiting a new warrior.`);

          const { count } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', referrer.telegram_id);

          if (count && count >= 10 && !referrer.referral_milestone_claimed) {
            await supabase.rpc('increment_bp', { 
              t_id: referrer.telegram_id, 
              earned: 50000 
            });
            await supabase
              .from('users')
              .update({ referral_milestone_claimed: true })
              .eq('telegram_id', referrer.telegram_id);
            
            await this.sendBotNotification(referrer.telegram_id, `🏆 *Milestone Achieved!* You've recruited 10 allies. 50,000 BP Bonus added!`);
          }
        }
      }
    } catch (e) {
      console.error("Referral processing failed", e);
    }
  },

  async getReferralCount(telegramId: number): Promise<number> {
    const { count, error } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', telegramId);
    if (error) return 0;
    return count || 0;
  },

  async getMiningStatus(telegramId: number) {
    try {
      const { data, error } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      return { energy: 1000, max_energy: 1000, tap_value: 1 };
    }
  },

  async updateBalanceAndEnergy(telegramId: number, bpEarned: number, energyUsed: number) {
    try {
      await supabase.rpc('increment_bp', { t_id: telegramId, earned: bpEarned });
      await supabase.rpc('decrement_energy', { t_id: telegramId, used: energyUsed });
    } catch (e) {}
  },

  async getTasks(telegramId: number) {
    try {
      const { data, error } = await supabase
        .from('cultural_tasks')
        .select('*, task_completions(id)')
        .eq('task_completions.user_id', telegramId);
      if (error) throw error;
      return (data as any[]).map(task => ({
        ...task,
        completed: task.task_completions?.length > 0
      }));
    } catch (e) {
      return [];
    }
  },

  async completeTask(telegramId: number, taskId: number, bpReward: number, culturalBpReward: number) {
    try {
      await supabase.from('task_completions').insert([{ user_id: telegramId, task_id: taskId }]);
      await supabase.rpc('reward_user', { t_id: telegramId, bp: bpReward, cbp: culturalBpReward });
      await this.sendBotNotification(telegramId, `📚 *Task Complete!* You earned ${bpReward} BP for protecting heritage.`);
    } catch (e) {}
  }
};
