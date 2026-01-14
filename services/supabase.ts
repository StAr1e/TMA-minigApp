
import { createClient } from '@supabase/supabase-js';

// Use optional strings to avoid crashing on module load
const SUPABASE_URL = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';
const BOT_TOKEN = (typeof process !== 'undefined' && process.env.BOT_TOKEN) || '';

// Initialize Supabase only if keys are present. 
// If missing, export null to let the app fall back to local storage (mockApi).
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

/* -------------------- Telegram Bot Helper -------------------- */
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
  /* -------------------- USERS -------------------- */
  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) {
      console.warn("Supabase not initialized. Returning mock user data.");
      return { 
        telegram_id: telegramId, 
        username: profile.username || 'Warrior', 
        points: 0, 
        cultural_points: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const username = profile?.username || profile?.first_name || `user_${telegramId}`;
    const avatar_url = profile?.photo_url || null;

    try {
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            telegram_id: telegramId,
            username,
            avatar_url,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'telegram_id' }
        )
        .select('*')
        .single();

      if (error) throw error;

      // Ensure mining_status exists
      const { data: status } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!status) {
        await supabase.from('mining_status').insert([{ 
          telegram_id: telegramId, 
          energy: 1000, 
          max_energy: 1000, 
          tap_value: 1,
          cultural_multiplier: 1.0
        }]);
      }

      if (data && data.created_at === data.updated_at) {
        await sendBotNotification(telegramId, `Welcome *${username}*! 🪙 Your Treasury is synced.`);
      }

      return data;
    } catch (err) {
      console.error("Supabase user operation failed:", err);
      throw err;
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

  /* -------------------- TASKS -------------------- */
  async getTasks(telegramId: number) {
    if (!supabase) return [];
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
      if (!user) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*, user_tasks(id)')
        .eq('user_tasks.user_id', user.id);

      if (error) return [];
      return (data || []).map(task => ({
        ...task,
        completed: task.user_tasks && task.user_tasks.length > 0
      }));
    } catch (e) {
      return [];
    }
  },

  /* -------------------- COMPLETE TASK -------------------- */
  async completeTask(telegramId: number, taskId: string, reward: number, culturalReward: number) {
    if (!supabase) return { success: false };
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, points, cultural_points')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !user) return { success: false };

      await supabase.from('user_tasks').insert({ user_id: user.id, task_id: taskId });
      await supabase.from('users').update({
        points: (user.points || 0) + reward,
        cultural_points: (user.cultural_points || 0) + culturalReward,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      return { success: true };
    } catch (e) {
      return { success: false };
    }
  },

  /* -------------------- POINTS & ENERGY SYNC -------------------- */
  async updateBalanceAndEnergy(telegramId: number, pointsToAdd: number, energyUsed: number) {
    if (!supabase) return;
    try {
      const { data: user } = await supabase.from('users').select('points').eq('telegram_id', telegramId).single();
      if (!user) return;

      await Promise.all([
        supabase.from('users').update({
          points: (user.points || 0) + pointsToAdd,
          updated_at: new Date().toISOString()
        }).eq('telegram_id', telegramId),
        supabase.from('mining_status').update({
          energy: Math.max(0, 1000 - energyUsed)
        }).eq('telegram_id', telegramId)
      ]);
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  async getReferralCount(telegramId: number) {
    if (!supabase) return 0;
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
      if (!user) return 0;
      const { count } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id);
      return count || 0;
    } catch (e) {
      return 0;
    }
  }
};
