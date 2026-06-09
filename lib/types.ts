// ── Match Types ──

export type MatchStatus = "upcoming" | "live" | "finished";

export type EventType =
  | "goal"
  | "red_card"
  | "yellow_card"
  | "halftime"
  | "fulltime"
  | "kickoff"
  | "time_update";

export interface MatchEvent {
  id: string;
  type: EventType;
  side: "home" | "away" | "neutral";
  minute: number;
  player?: string;
  description: string;
  timestamp: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  flag: string;
  color: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  status: MatchStatus;
  score: { home: number; away: number };
  currentMinute: number;
  events: MatchEvent[];
  startTime: number;
  onChainTxHash?: string;
}

// ── Agent Types (Single Match Agent Architecture) ──

export interface TeamState {
  attack: number;    // 0-100
  defense: number;   // 0-100
  midfield: number;  // 0-100
  momentum: number;  // 0-100
  supporter: number; // 0-100
}

export interface MatchAgentState {
  matchId: string;
  teamA: TeamState;    // home team state
  teamB: TeamState;    // away team state
  teamAWinRate: number;   // 0-100 (%)
  teamBWinRate: number;   // 0-100 (%)
  predictedScore: string; // e.g. "2-1"
  confidence: number;     // 0-100
  narrative: string[];    // historical narratives
  predictions: AgentPrediction[];
  lastUpdate: number;
  source: "somnia-llm" | "mock";
  somniaTxHash?: string;
}

export interface AgentPrediction {
  minute: number;
  homeScore: number;
  awayScore: number;
  teamAWinRate: number;
  teamBWinRate: number;
  confidence: number;
}

export interface MatchAgentResponse {
  teamA: TeamState;
  teamB: TeamState;
  teamAWinRate: number;
  teamBWinRate: number;
  predictedScore: string;
  confidence: number;
  narrativeUpdate: string;
  timestamp: number;
  source: "somnia-llm" | "mock";
  somniaTxHash?: string;
}

// ── Reality Confidence Model ──
// Each event only contributes a fraction of its theoretical impact,
// preserving agent autonomy.

export const EVENT_IMPACT: Record<string, { baseImpact: number; realityConfidence: number }> = {
  goal:        { baseImpact: 8,  realityConfidence: 0.25 },  // actual: ~2%
  red_card:    { baseImpact: 15, realityConfidence: 0.25 },  // actual: ~4%
  yellow_card: { baseImpact: 3,  realityConfidence: 0.30 },  // actual: ~1%
};

export const MOMENTUM_DELTA = 5; // ±5% dynamic

// ── Strategy Types ──

export type StrategyType =
  | "wing_attack"
  | "central_attack"
  | "wing_defense"
  | "central_defense"
  | "midfield_control";

export const STRATEGY_CONFIGS: Record<StrategyType, { label: string; description: string; affects: keyof TeamState }> = {
  wing_attack:      { label: "Wing Attack",      description: "Focus attacks down the flanks",          affects: "attack" },
  central_attack:   { label: "Central Attack",   description: "Direct through the middle",             affects: "attack" },
  wing_defense:     { label: "Wing Defense",     description: "Protect the wide areas",                affects: "defense" },
  central_defense:  { label: "Central Defense",  description: "Compact defensive block",               affects: "defense" },
  midfield_control: { label: "Midfield Control",  description: "Dominate possession and tempo",         affects: "midfield" },
};

export interface UserStrategy {
  userId: string;
  matchId: string;
  teamId: string;
  strategy: StrategyType;
  timestamp: number;
}

// ── Stake Influence ──
// Logarithmic: Influence = 10 * log10(1 + stake)
// Caps: max +10 per attribute

export function computeStakeInfluence(totalStaked: number): number {
  return 10 * Math.log10(1 + totalStaked);
}

export const MAX_ATTRIBUTE_BONUS = 10;

// ── Staking Types ──

export interface StakingPool {
  matchId: string;
  teamId: string;
  totalStaked: number;
  userCount: number;
}

export interface UserStake {
  userId: string;
  matchId: string;
  teamId: string;
  amount: number;
  timestamp: number;
}

// ── Reward Types ──
// Winning supporters receive 80% of the losing pool pro-rata.
// If MVP liquidity is one-sided, the prefunded reward pool supplies a sponsor bonus.

export interface RewardDistribution {
  userId: string;
  matchId: string;
  teamId: string;
  stakeAmount: number;
  poolShare: number;       // user's % of winning pool
  rewardFromLosingPool: number; // losing-pool share or MVP sponsor bonus
  totalReturned: number;   // stake + reward
}

export interface MatchResult {
  matchId: string;
  winner: string | null;
  homeScore: number;
  awayScore: number;
  actualHomeScore?: number;
  actualAwayScore?: number;
  settlementSource?: "agent-prediction" | "agent-win-rate";
  homePool: number;
  awayPool: number;
  rewards: RewardDistribution[];
}
