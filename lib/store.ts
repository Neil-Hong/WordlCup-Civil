import { EventEmitter } from "events";
import type {
  Match, MatchEvent, StakingPool, UserStake, MatchResult,
  RewardDistribution, Team, StrategyType, UserStrategy,
  MatchAgentState, MatchAgentResponse,
} from "./types";

// ── Team Registry ──

export const TEAMS: Record<string, Team> = {
  argentina: { id: "argentina", name: "Argentina", shortName: "ARG", flag: "🇦🇷", color: "#75aadb" },
  france:    { id: "france",    name: "France",    shortName: "FRA", flag: "🇫🇷", color: "#0055a4" },
  brazil:    { id: "brazil",    name: "Brazil",    shortName: "BRA", flag: "🇧🇷", color: "#009c3b" },
  england:   { id: "england",   name: "England",   shortName: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#cf081f" },
  germany:   { id: "germany",   name: "Germany",   shortName: "GER", flag: "🇩🇪", color: "#000000" },
  spain:     { id: "spain",     name: "Spain",     shortName: "ESP", flag: "🇪🇸", color: "#aa151b" },
};

// ── In-Memory Store ──

class Store extends EventEmitter {
  matches: Map<string, Match> = new Map();
  matchAgentStates: Map<string, MatchAgentState> = new Map(); // matchId -> single agent state
  stakingPools: Map<string, StakingPool> = new Map();
  userStakes: Map<string, UserStake[]> = new Map();
  results: Map<string, MatchResult> = new Map();
  userStrategies: Map<string, UserStrategy> = new Map();
  globalEventLog: { matchId: string; event: MatchEvent }[] = [];

  private eventIdCounter = 0;
  nextEventId(): string { return `evt_${++this.eventIdCounter}`; }

  // ── Match Methods ──

  getMatch(id: string): Match | undefined { return this.matches.get(id); }

  getAllMatches(): Match[] {
    return Array.from(this.matches.values()).sort((a, b) => b.startTime - a.startTime);
  }

  addEvent(matchId: string, event: MatchEvent): void {
    const match = this.matches.get(matchId);
    if (!match) return;
    match.events.push(event);
    this.globalEventLog.push({ matchId, event });
    if (event.type === "goal") {
      if (event.side === "home") match.score.home++;
      else if (event.side === "away") match.score.away++;
    }
    if (event.type === "fulltime") { match.status = "finished"; match.currentMinute = 90; }
    else if (event.type === "halftime") { match.currentMinute = 45; }
    else { match.currentMinute = event.minute; }
    this.emit("match-updated", matchId);
    this.emit("event-added", { matchId, event });
  }

  // ── Match Agent Methods (Single Agent per Match) ──

  getMatchAgentState(matchId: string): MatchAgentState | undefined {
    return this.matchAgentStates.get(matchId);
  }

  updateMatchAgentState(matchId: string, response: MatchAgentResponse): MatchAgentState {
    const existing = this.matchAgentStates.get(matchId);
    const match = this.matches.get(matchId);

    const state: MatchAgentState = {
      matchId,
      teamA: response.teamA,
      teamB: response.teamB,
      teamAWinRate: response.teamAWinRate,
      teamBWinRate: response.teamBWinRate,
      predictedScore: response.predictedScore,
      confidence: response.confidence,
      narrative: existing
        ? [...existing.narrative, response.narrativeUpdate].slice(-20)
        : [response.narrativeUpdate],
      predictions: [
        ...(existing?.predictions ?? []),
        { minute: match?.currentMinute ?? 0, homeScore: match?.score.home ?? 0, awayScore: match?.score.away ?? 0, teamAWinRate: response.teamAWinRate, teamBWinRate: response.teamBWinRate, confidence: response.confidence },
      ].slice(-50),
      lastUpdate: response.timestamp,
      source: response.source,
      somniaTxHash: response.somniaTxHash,
    };

    this.matchAgentStates.set(matchId, state);
    this.emit("agent-updated", { matchId, state });
    return state;
  }

  // ── Staking Methods ──

  getStakingPool(matchId: string, teamId: string): StakingPool {
    const key = `${matchId}:${teamId}`;
    if (!this.stakingPools.has(key)) {
      this.stakingPools.set(key, { matchId, teamId, totalStaked: 0, userCount: 0 });
    }
    return this.stakingPools.get(key)!;
  }

  stake(userId: string, matchId: string, teamId: string, amount: number): UserStake {
    const pool = this.getStakingPool(matchId, teamId);
    pool.totalStaked += amount;
    pool.userCount++;
    const s: UserStake = { userId, matchId, teamId, amount, timestamp: Date.now() };
    if (!this.userStakes.has(userId)) this.userStakes.set(userId, []);
    this.userStakes.get(userId)!.push(s);
    this.emit("stake-updated", { matchId, teamId, pool });
    return s;
  }

  getUserStakes(userId: string, matchId: string): UserStake[] {
    return (this.userStakes.get(userId) ?? []).filter(s => s.matchId === matchId);
  }

  // ── Strategy Methods ──

  setStrategy(userId: string, matchId: string, teamId: string, strategy: StrategyType): UserStrategy {
    const key = `${userId}:${matchId}:${teamId}`;
    const s: UserStrategy = { userId, matchId, teamId, strategy, timestamp: Date.now() };
    this.userStrategies.set(key, s);
    return s;
  }

  getUserStrategy(userId: string, matchId: string, teamId: string): UserStrategy | undefined {
    return this.userStrategies.get(`${userId}:${matchId}:${teamId}`);
  }

  getStrategiesForTeam(matchId: string, teamId: string): UserStrategy[] {
    const r: UserStrategy[] = [];
    for (const [, s] of this.userStrategies) {
      if (s.matchId === matchId && s.teamId === teamId) r.push(s);
    }
    return r;
  }

  getAgentSettlement(matchId: string): {
    winner: string | null;
    homeScore: number;
    awayScore: number;
    source: "agent-prediction" | "agent-win-rate";
  } | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const agent = this.matchAgentStates.get(matchId);
    const parsed = parsePredictedScore(agent?.predictedScore);
    if (parsed) {
      const winner =
        parsed.home > parsed.away ? match.homeTeam.id
          : parsed.away > parsed.home ? match.awayTeam.id
          : null;
      return { winner, homeScore: parsed.home, awayScore: parsed.away, source: "agent-prediction" };
    }

    const homeRate = agent?.teamAWinRate ?? 50;
    const awayRate = agent?.teamBWinRate ?? 50;
    if (homeRate > awayRate) {
      return { winner: match.homeTeam.id, homeScore: 1, awayScore: 0, source: "agent-win-rate" };
    }
    if (awayRate > homeRate) {
      return { winner: match.awayTeam.id, homeScore: 0, awayScore: 1, source: "agent-win-rate" };
    }
    return { winner: null, homeScore: 1, awayScore: 1, source: "agent-win-rate" };
  }

  // ── Reward Methods (New Model) ──
  // Winning supporters receive 80% of the losing pool pro-rata.
  // If MVP liquidity is one-sided, the prefunded reward pool supplies a sponsor bonus.

  calculateRewards(matchId: string): RewardDistribution[] {
    const match = this.matches.get(matchId);
    if (!match || match.status !== "finished") return [];

    const settlement = this.getAgentSettlement(matchId);
    if (!settlement) return [];
    const winner = settlement.winner;

    const homePool = this.getStakingPool(matchId, match.homeTeam.id);
    const awayPool = this.getStakingPool(matchId, match.awayTeam.id);
    const rewards: RewardDistribution[] = [];

    for (const [userId, stakes] of this.userStakes) {
      for (const stake of stakes) {
        if (stake.matchId !== matchId) continue;

        if (winner === null) {
          // Draw: everyone gets their stake back, no rewards
          rewards.push({
            userId, matchId, teamId: stake.teamId,
            stakeAmount: stake.amount, poolShare: 0,
            rewardFromLosingPool: 0, totalReturned: stake.amount,
          });
          continue;
        }

        const isWinner = stake.teamId === winner;
        if (isWinner) {
          const winningPool = winner === match.homeTeam.id ? homePool.totalStaked : awayPool.totalStaked;
          const losingPool = winner === match.homeTeam.id ? awayPool.totalStaked : homePool.totalStaked;
          const poolShare = winningPool > 0 ? stake.amount / winningPool : 0;
          const rewardPool = losingPool > 0
            ? losingPool * 0.8
            : stake.amount * 0.8; // sponsor bonus when there is no opposing pool
          const rewardFromLosingPool = losingPool > 0 ? rewardPool * poolShare : rewardPool;
          const totalReturned = stake.amount + rewardFromLosingPool;

          rewards.push({
            userId, matchId, teamId: stake.teamId,
            stakeAmount: stake.amount,
            poolShare: Math.round(poolShare * 10000) / 100,
            rewardFromLosingPool: Math.round(rewardFromLosingPool * 1000) / 1000,
            totalReturned: Math.round(totalReturned * 1000) / 1000,
          });
        } else {
          // Loser gets nothing back (their stake funds the reward pool)
          rewards.push({
            userId, matchId, teamId: stake.teamId,
            stakeAmount: stake.amount, poolShare: 0,
            rewardFromLosingPool: 0, totalReturned: 0,
          });
        }
      }
    }

    const result: MatchResult = {
      matchId, winner,
      homeScore: settlement.homeScore,
      awayScore: settlement.awayScore,
      actualHomeScore: match.score.home,
      actualAwayScore: match.score.away,
      settlementSource: settlement.source,
      homePool: homePool.totalStaked, awayPool: awayPool.totalStaked,
      rewards,
    };
    this.results.set(matchId, result);
    return rewards;
  }

  getResult(matchId: string): MatchResult | undefined {
    return this.results.get(matchId);
  }
}

const globalStore = globalThis as unknown as { __worldcupStore?: Store };
export const store: Store = globalStore.__worldcupStore ?? (globalStore.__worldcupStore = new Store());

function parsePredictedScore(score?: string): { home: number; away: number } | null {
  if (!score) return null;
  const match = score.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}
