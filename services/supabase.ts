
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
  async getOrCreateUser(telegramId: number, profile: any) {
    if (!supabase) {
      console.warn("Supabase not initialized, skipping DB save.");
      return { telegram_id: telegramId, username: profile.username || 'Warrior', points: 0, cultural_points: 0 };
    }

    const username = profile?.username || profile?.first_name || `user_${telegramId}`;
    const avatar_url = profile?.photo_url || null;

    try {
      // Use explicit select to ensure we get the full object back
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
        .select()
        .single();

      if (error) {
        console.error("User Upsert Error:", error.message);
        throw error;
      }

      // Sync mining status
      const { data: status, error: statusError } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!status && !statusError) {
        await supabase.from('mining_status').insert([{ 
          telegram_id: telegramId, 
          energy: 1000, 
          max_energy: 1000, 
          tap_value: 1,
          cultural_multiplier: 1.0
        }]);
      }

      if (data && data.created_at === data.updated_at) {
        await sendBotNotification(telegramId, `Welcome *${username}*! 🪙 Your Tribal identity is now on-chain.`);
      }

      return data;
    } catch (err) {
      console.error("Critical DB Sync Error:", err);
      return { telegram_id: telegramId, username, points: 0, cultural_points: 0 };
    }
  },

  async updateBalanceAndEnergy(telegramId: number, pointsToAdd: number, energyUsed: number) {
    if (!supabase) return;
    try {
      // First, fetch current points to avoid overwriting with stale local state
      const { data: user } = await supabase
        .from('users')
        .select('points')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      const newTotal = (user?.points || 0) + pointsToAdd;

      const { error } = await supabase
        .from('users')
        .update({
          points: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId);

      if (error) console.error("Balance update error:", error.message);

      // Energy sync (non-blocking)
      const { data: status } = await supabase.from('mining_status').select('energy').eq('telegram_id', telegramId).maybeSingle();
      if (status) {
        await supabase.from('mining_status').update({
          energy: Math.max(0, status.energy - energyUsed)
        }).eq('telegram_id', telegramId);
      }
    } catch (e) {
      console.error("Sync process failed:", e);
    }
  },

  async getMiningStatus(telegramId: number) {
    if (!supabase) return { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
    const { data } = await supabase.from('mining_status').select('*').eq('telegram_id', telegramId).maybeSingle();
    return data || { energy: 1000, max_energy: 1000, tap_value: 1, cultural_multiplier: 1.0 };
  },

  async getTasks(telegramId: number) {
    if (!supabase) return [];
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle();
    if (!user) return [];
    const { data } = await supabase.from('tasks').select('*, user_tasks(id)').eq('user_tasks.user_id', user.id);
    return (data || []).map(t => ({ ...t, completed: !!(t.user_tasks && t.user_tasks.length > 0) }));
  },

  async completeTask(telegramId: number, taskId: string, reward: number, culturalReward: number) {
    if (!supabase) return { success: false };
    const { data: user } = await supabase.from('users').select('id, points, cultural_points').eq('telegram_id', telegramId).maybeSingle();
    if (!user) return { success: false };
    await supabase.from('user_tasks').insert({ user_id: user.id, task_id: taskId });
    await supabase.from('users').update({
      points: (user.points || 0) + reward,
      cultural_points: (user.cultural_points || 0) + culturalReward
    }).eq('id', user.id);
    return { success: true };
  },

  async getReferralCount(telegramId: number) {
    if (!supabase) return 0;
    const { count } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', telegramId);
    return count || 0;
  }
};
