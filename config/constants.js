// Business logic constants for referral, investment, and rewards

export const REGISTRATION_AMOUNT = 3600;
export const MIN_INVESTMENT_AMOUNT = 10000;
export const MONTHLY_ROI_PERCENT = 0.04; // 4%
export const REFERRAL_PERCENTS = [0, 0.10, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
export const INVESTMENT_ONE_TIME_PERCENTS = [0, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
export const INVESTMENT_MONTHLY_PERCENTS = [0, 0.10, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
export const INVESTMENT_BONUS_MONTHS = 6;
export const DIRECT_REQS = [0, 0, 2, 3, 4, 5, 5, 5, 6, 6, 6];
export const MAX_PAIRS_PER_DAY = 60;
export const REWARD_MILESTONES = [
  { name: 'Supervisor', pairs: 25, reward: null },
  { name: 'Senior Supervisor', pairs: 75, reward: 'Goa Tour' },
  { name: 'Manager', pairs: 175, reward: 40000 },
  { name: 'Executive Manager', pairs: 425, reward: 'Thailand Tour' },
  { name: 'Eagle', pairs: 925, reward: 180000 },
  { name: 'Eagle Executive', pairs: 1925, reward: 400000 },
  { name: 'Silver', pairs: 4425, reward: 800000 },
  { name: 'Gold', pairs: 9425, reward: 1500000 },
  { name: 'Pearl', pairs: 19425, reward: 3000000 },
  { name: 'Diamond', pairs: 44425, reward: 5000000 },
  { name: 'Ambassador', pairs: 94425, reward: 7500000 },
  { name: 'King', pairs: 194425, reward: 12500000 },
  { name: 'Universal King', pairs: 444425, reward: 22500000 },
]; 