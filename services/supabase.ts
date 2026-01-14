
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
      const avatarUrl = profile.photo_url || '';

      // Force upsert into the 'users' table using your schema columns: points, cultural_points
      const { data: user, error } = await supabase
        .from('users')
        .upsert({ 
          telegram_id: telegramId, 
          username: telegramUsername,
          avatar_url: avatarUrl
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (error) {
        console.error("Supabase Upsert Error:", error);
        throw error;
      }

      // Check if user has a mining status record (optional based on your custom logic)
      const { data: status } = await supabase
        .from('mining_status')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!status) {
        // Since the users table has points/cultural_points, we ensure they are initialized
        await Promise.all([
          // If you use a separate table for energy, keep this, otherwise use users table
          supabase.from('mining_status').upsert([{ 
            telegram_id: telegramId, 
            energy: 1000, 
            max_energy: 1000, 
            tap_value: 1 
          }], { onConflict: 'telegram_id' }),
          this.sendBotNotification(telegramId, `Welcome *${telegramUsername}*! 🪙 Your Treasury is now synced.`)
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
      // Use your SQL schema: update 'points' in 'users' table
      // We use a simple increment since the RPC might not be named 'increment_bp' in your provided schema
      const { data: currentUser } = await supabase
        .from('users')
        .select('points')
        .eq('telegram_id', telegramId)
        .single();

      if (currentUser) {
        await supabase
          .from('users')
          .update({ points: (currentUser.points || 0) + bpEarned })
          .eq('telegram_id', telegramId);
      }

      // Update energy in mining_status
      await supabase
        .from('mining_status')
        .update({ energy: Math.max(0, 1000 - energyUsed) }) // Simplified logic for example
        .eq('telegram_id', telegramId);

    } catch (e) {
      console.error("Critical Sync Exception:", e);
    }
  },

  async getTasks(telegramId: number) {
    if (!supabase) return [];
    try {
      // Get internal user id first
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
      if (!user) return [];

      // Fetch tasks and join with user_tasks based on your schema
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*, user_tasks(id)')
        .eq('user_tasks.user_id', user.id);
      
      if (error) throw error;
      return (tasks || []).map((t: any) => ({ 
        ...t, 
        completed: Array.isArray(t.user_tasks) && t.user_tasks.length > 0 
      }));
    } catch (e) {
      return [];
    }
  },

  async completeTask(telegramId: number, taskId: string, reward: number, culturalReward: number) {
    if (!supabase) return { success: false };
    try {
      const { data: user } = await supabase.from('users').select('id, points, cultural_points').eq('telegram_id', telegramId).single();
      if (!user) throw new Error("User not found");

      // 1. Mark as completed in 'user_tasks' table
      await supabase.from('user_tasks').insert([{ user_id: user.id, task_id: taskId }]);

      // 2. Update points and cultural_points in 'users' table
      await supabase
        .from('users')
        .update({ 
          points: (user.points || 0) + reward,
          cultural_points: (user.cultural_points || 0) + culturalReward
        })
        .eq('id', user.id);

      return { success: true };
    } catch (e) {
      console.error("Task Database Error:", e);
      return { success: false };
    }
  },

  async getReferralCount(telegramId: number): Promise<number> {
    if (!supabase) return 0;
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id);
      
      if (error) throw error;
      return count || 0;
    } catch (e) {
      return 0;
    }
  }
};
