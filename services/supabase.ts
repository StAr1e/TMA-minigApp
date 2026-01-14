
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    console.error('Telegram error:', e);
  }
}

export const api = {
  /* -------------------- USERS -------------------- */
  async getOrCreateUser(telegramId: number, profile: any) {
    const username = profile?.username || profile?.first_name || `user_${telegramId}`;
    const avatar_url = profile?.photo_url || null;

    /* UPSERT USER into 'users' table using your specific schema */
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

    if (error) {
      console.error('USER UPSERT FAILED:', error);
      throw error;
    }

    // Initialize mining status if needed (separate table for energy management)
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

    /* Welcome message only on first creation */
    if (data.created_at === data.updated_at) {
      await sendBotNotification(
        telegramId,
        `Welcome *${username}*! 🪙 Your BP Treasury is now active and synced to the Baloch network.`
      );
    }

    return data;
  },

  async getMiningStatus(telegramId: number) {
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
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) return [];

    // Correctly join with user_tasks for completion state
    const { data, error } = await supabase
      .from('tasks')
      .select('*, user_tasks(id)')
      .eq('user_tasks.user_id', user.id);

    if (error) {
      console.error('TASK FETCH ERROR:', error);
      return [];
    }

    return (data || []).map(task => ({
      ...task,
      completed: task.user_tasks && task.user_tasks.length > 0
    }));
  },

  /* -------------------- COMPLETE TASK -------------------- */
  async completeTask(
    telegramId: number,
    taskId: string,
    reward: number,
    culturalReward: number
  ) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, points, cultural_points')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !user) {
      console.error('USER NOT FOUND');
      return { success: false };
    }

    /* Insert completion into user_tasks */
    const { error: taskError } = await supabase
      .from('user_tasks')
      .insert({
        user_id: user.id,
        task_id: taskId
      });

    if (taskError) {
      console.error('TASK INSERT ERROR:', taskError);
      return { success: false };
    }

    /* Update balances in users table using correct columns */
    const { error: updateError } = await supabase
      .from('users')
      .update({
        points: (user.points || 0) + reward,
        cultural_points: (user.cultural_points || 0) + culturalReward,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    return { success: !updateError };
  },

  /* -------------------- POINTS & ENERGY SYNC -------------------- */
  async updateBalanceAndEnergy(telegramId: number, pointsToAdd: number, energyUsed: number) {
    const { data: user } = await supabase
      .from('users')
      .select('points')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) return;

    await Promise.all([
      supabase
        .from('users')
        .update({
          points: (user.points || 0) + pointsToAdd,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId),
      supabase
        .from('mining_status')
        .update({
          energy: Math.max(0, 1000 - energyUsed) // Example energy update
        })
        .eq('telegram_id', telegramId)
    ]);
  },

  /* -------------------- REFERRALS -------------------- */
  async getReferralCount(telegramId: number) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) return 0;

    const { count } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id);

    return count || 0;
  }
};
