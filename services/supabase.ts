import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';
const BOT_TOKEN = (typeof process !== 'undefined' && process.env.BOT_TOKEN) || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ------------------ TELEGRAM BOT NOTIFICATION ------------------
async function sendBotNotification(chat_id: number, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error('Telegram bot notification failed:', e);
  }
}

// ------------------ API FUNCTIONS ------------------
export const api = {
  // ------------------ CREATE OR GET USER ------------------
  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) {
      console.warn("Supabase not initialized.");
      return {
        telegram_id: telegramId,
        username: profile.username || 'Warrior',
        points: 0,
        cultural_points: 0
      };
    }

    const username = profile.username || profile.first_name || `user_${telegramId}`;
    const avatar_url = profile.photo_url || '';

    try {
      // UPSERT user into `users` table
      const { data: user, error } = await supabase
        .from('users')
        .upsert({
          telegram_id: telegramId,
          username,
          avatar_url,
          updated_at: new Date().toISOString()
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (error) throw error;

      // Ensure mining_status exists
      const { data: status, error: statusError } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!status && !statusError) {
        await supabase
          .from('mining_status')
          .upsert({
            telegram_id: telegramId,
            energy: 1000,
            max_energy: 1000,
            tap_value: 1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'telegram_id' });
      }

      // Welcome message only for new user
      if (user && user.created_at === user.updated_at) {
        await sendBotNotification(telegramId, `Welcome *${username}*! 🪙 Your Tribal identity is now on-chain.`);
      }

      return user;
    } catch (err: any) {
      console.error("getOrCreateUser failed:", err.message || err);
      return {
        telegram_id: telegramId,
        username,
        points: 0,
        cultural_points: 0
      };
    }
  },

  // ------------------ GET MINING STATUS ------------------
  async getMiningStatus(telegramId: number) {
    if (!supabase) return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    try {
      const { data } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      return data || { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    } catch (e) {
      console.error('getMiningStatus failed:', e);
      return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    }
  },

  // ------------------ UPDATE BALANCE & ENERGY ------------------
  async updateBalanceAndEnergy(telegramId: number, pointsToAdd: number, energyUsed: number) {
    if (!supabase) return;

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, points')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!user) return;

      const newPoints = (user.points || 0) + pointsToAdd;

      await supabase
        .from('users')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      // Update energy
      const { data: status } = await supabase
        .from('mining_status')
        .select('energy')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (status) {
        await supabase
          .from('mining_status')
          .update({ energy: Math.max(0, status.energy - energyUsed), updated_at: new Date().toISOString() })
          .eq('telegram_id', telegramId);
      }
    } catch (e) {
      console.error('updateBalanceAndEnergy failed:', e);
    }
  },

  // ------------------ GET TASKS ------------------
  async getTasks(telegramId: number) {
    if (!supabase) return [];

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!user) return [];

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*, user_tasks(id)')
        .eq('user_tasks.user_id', user.id);

      return (tasks || []).map(t => ({
        ...t,
        completed: !!(t.user_tasks && t.user_tasks.length > 0)
      }));
    } catch (e) {
      console.error('getTasks failed:', e);
      return [];
    }
  },

  // ------------------ COMPLETE TASK ------------------
  async completeTask(telegramId: number, taskId: string, reward: number, culturalReward: number) {
    if (!supabase) return { success: false };

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, points, cultural_points')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!user) return { success: false };

      // Insert completion
      await supabase.from('user_tasks').insert({ user_id: user.id, task_id: taskId });

      // Update points
      await supabase.from('users').update({
        points: (user.points || 0) + reward,
        cultural_points: (user.cultural_points || 0) + culturalReward,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      return { success: true };
    } catch (e) {
      console.error('completeTask failed:', e);
      return { success: false };
    }
  },

  // ------------------ REFERRAL COUNT ------------------
  async getReferralCount(telegramId: number) {
    if (!supabase) return 0;

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!user) return 0;

      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id);

      return count || 0;
    } catch (e) {
      console.error('getReferralCount failed:', e);
      return 0;
    }
  }
};
