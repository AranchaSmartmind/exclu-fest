export type Prize = {
  id: string;
  name: string;
  description: string;
  icon: string;
  stock_total: number;
  stock_remaining: number;
  active: boolean;
};

export type GameResult = {
  already_played: boolean;
  prize: Prize | null;
  raffle_entries: number;
  reward_code: string | null;
  message: string;
};

export type Dashboard = {
  scans: number;
  participants: number;
  prizes_claimed: number;
  raffle_entries: number;
  remaining: { name: string; remaining: number; total: number }[];
};
