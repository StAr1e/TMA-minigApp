
export interface User {
  telegram_id: number;
  username: string;
  bp_balance: number;
  cultural_bp: number;
  level: number;
  referral_code: string;
}

export interface MiningStatus {
  energy: number;
  max_energy: number;
  energy_regen_rate: number;
  tap_value: number;
  cultural_multiplier: number;
}

export interface CulturalTask {
  id: number;
  type: 'quiz' | 'story' | 'music' | 'learn';
  title: string;
  description: string;
  bp_reward: number;
  cultural_bp_reward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
  category: string;
  content?: any;
}
