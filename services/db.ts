
import { User, MiningStatus, CulturalTask } from '../types';

const STORAGE_KEY = 'balochcoin_persistent_v1';

// Initial Cultural Data from your seed script
const INITIAL_TASKS: CulturalTask[] = [
  {
    id: 101,
    type: 'quiz',
    title: "Balochi Proverbs - Level 1",
    description: "Test your knowledge of ancestral wisdom",
    bp_reward: 500,
    cultural_bp_reward: 150,
    difficulty: "easy",
    category: "proverbs",
    completed: false,
    content: {
      questions: [
        {
          question: "Complete the proverb: 'دوست چے گوار ءِ وختے په ...'",
          options: ["زانیت (need)", "خوشی (joy)", "جنگ (war)", "مال (wealth)"],
          correct_answer: 0
        }
      ]
    }
  },
  {
    id: 102,
    type: 'story',
    title: "The Wise Shepherd",
    description: "دانا گوازگ و پادشاه",
    bp_reward: 300,
    cultural_bp_reward: 200,
    difficulty: "medium",
    category: "wisdom",
    completed: false,
    content: {
      text: "In ancient Balochistan, there lived a shepherd known for his wisdom...",
      moral: "True wisdom and contentment cannot be bought with riches"
    }
  }
];

export const db = {
  getStore(id: number) {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const initial = {
        user: {
          telegram_id: 123456,
          username: 'BalochWarrior',
          bp_balance: 0,
          cultural_bp: 0,
          level: 1,
          referral_code: 'BALOCH_NEW'
        },
        status: {
          energy: 1000,
          max_energy: 1000,
          energy_regen_rate: 1,
          tap_value: 1,
          cultural_multiplier: 1.0
        },
        tasks: INITIAL_TASKS,
        lastUpdate: Date.now()
      };
      this.saveStore(initial);
      return initial;
    }
    return JSON.parse(data);
  },

  saveStore(data: any, id: number) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  updateUser(userId: number, updates: Partial<User>) {
    const store = this.getStore();
    store.user = { ...store.user, ...updates };
    this.saveStore(store);
    return store.user;
  },

  updateStatus(userId: number, updates: Partial<MiningStatus>) {
    const store = this.getStore();
    store.status = { ...store.status, ...updates };
    this.saveStore(store);
    return store.status;
  }
};
