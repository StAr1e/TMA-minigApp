export interface User {
  telegram_id: number;
  username: string;
  bp_balance: number;
  cultural_bp: number;
  level: number;
  referral_code: string;
  photo_url?: string;
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

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        openTelegramLink: (url: string) => void;
        // Added required properties for initialization
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        };
      };
    };
  }
}
