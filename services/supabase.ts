import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';
const BOT_TOKEN = (typeof process !== 'undefined' && process.env.BOT_TOKEN) || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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

export const api = {
  // -------------------- CREATE OR GET USER --------------------
  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) return { telegram_id: telegramId, username: profile.username || 'Warrior', points: 0, cultural_points: 0 };

    const username = profile?.username || profile?.first_name || `user_${telegramId}`;
    const avatar_url = profile?.photo_url || null;

    try {
      // Upsert the user into 'users' table, include points and cultural_points default
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            telegram_id: telegramId,
            username,
            avatar_url,
            points: 0,
            cultural_points: 0,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'telegram_id' }
        )
        .select('*')
        .single();

      if (error) throw error;

      // Make sure mining_status exists (linked by user.id)
      const { data: status } = await supabase
        .from('mining_status')
        .select('*')
        .eq('user_id', data.id)
        .maybeSingle();

      if (!status) {
        await supabase.from('mining_status').insert([{
          user_id: data.id,
          energy: 1000,
          max_energy: 1000,
          tap_value: 1,
          cultural_multiplier: 1.0
        }]);
      }

      // Optional: welcome message
      if (data && data.points === 0 && data.cultural_points === 0) {
        await sendBotNotification(telegramId, `Welcome *${username}*! 🪙 Your Tribal identity is now on-chain.`);
      }

      return data;

    } catch (err) {
      console.error('Critical DB Sync Error:', err);
      return { telegram_id: telegramId, username, points: 0, cultural_points: 0 };
    }
  },

  // -------------------- UPDATE BALANCE AND ENERGY --------------------
  async updateBalanceAndEnergy(telegramId: number, pointsToAdd: number, energyUsed: number) {
    if (!supabase) return;

    try {
      // Get user.id first
      const { data: user } = await supabase.from('users').select('id, points').eq('telegram_id', telegramId).maybeSingle();
      if (!user) return;

      // Update points
      await supabase
        .from('users')
        .update({ points: (user.points || 0) + pointsToAdd, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      // Update energy in mining_status
      const { data: status } = await supabase.from('mining_status').select('energy').eq('user_id', user.id).maybeSingle();
      if (status) {
        await supabase
          .from('mining_status')
          .update({ energy: Math.max(0, status.energy - energyUsed) })
          .eq('user_id', user.id);
      }

    } catch (e) {
      console.error('Sync process failed:', e);
    }
  },

  // -------------------- GET MINING STATUS --------------------
  async getMiningStatus(telegramId: number) {
    if (!supabase) return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle();
      if (!user) return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };

      const { data: status } = await supabase.from('mining_status').select('*').eq('user_id', user.id).maybeSingle();
      return status || { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    } catch (e) {
      console.error('Failed to fetch mining status', e);
      return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    }
  },

  // -------------------- GET TASKS --------------------
  async getTasks(telegramId: number) {
    if (!supabase) return [];
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle();
      if (!user) return [];

      const { data } = await supabase.from('tasks').select('*, user_tasks(id)').eq('user_tasks.user_id', user.id);
      return (data || []).map(t => ({ ...t, completed: !!(t.user_tasks?.length) }));
    } catch (e) {
      console.error('Get tasks failed:', e);
      return [];
    }
  },

  // -------------------- COMPLETE TASK --------------------
  async completeTask(telegramId: number, taskId: string, reward: number, culturalReward: number) {
    if (!supabase) return { success: false };
    try {
      const { data: user } = await supabase.from('users').select('id, points, cultural_points').eq('telegram_id', telegramId).maybeSingle();
      if (!user) return { success: false };

      // Mark as completed
      await supabase.from('user_tasks').insert([{ user_id: user.id, task_id: taskId }]);

      // Update rewards
      await supabase.from('users').update({
        points: (user.points || 0) + reward,
        cultural_points: (user.cultural_points || 0) + culturalReward
      }).eq('id', user.id);

      return { success: true };
    } catch (e) {
      console.error('Complete task error:', e);
      return { success: false };
    }
  },

  // -------------------- GET REFERRALS --------------------
  async getReferralCount(telegramId: number) {
    if (!supabase) return 0;
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle();
      if (!user) return 0;

      const { count, error } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id);
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Referral fetch failed:', e);
      return 0;
    }
  }
};
