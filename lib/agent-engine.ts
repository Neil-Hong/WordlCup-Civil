import { store } from "./store";
import { callSomniaAgent } from "./somnia-agent";
import { EVENT_IMPACT, MOMENTUM_DELTA, STRATEGY_CONFIGS, computeStakeInfluence, MAX_ATTRIBUTE_BONUS } from "./types";
import { LINEUPS } from "./match-simulator";
import type { MatchAgentResponse, Match, MatchEvent, StrategyType, TeamState } from "./types";

// ── Persona for Match Agent ──

const MATCH_AGENT_PERSONA = `You are the AI Match Agent — a neutral, autonomous football analyst for the WorldCup Civil prediction economy.
You analyze both teams objectively. You are not biased toward either side.
Your role: evaluate lineups, interpret match events, assess momentum, and update predictions.
You maintain your own autonomous reasoning. Real-world events inform but do not dictate your analysis.`;

// ── Helpers ──

function isAgentMoment(event: MatchEvent): boolean {
  // Only call Somnia LLM for major events to avoid blocking the match flow
  return event.type === "kickoff" || event.type === "goal" || event.type === "halftime";
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function buildLocalEventNarrative(
  match: Match,
  event: MatchEvent,
  teamA: TeamState,
  teamB: TeamState,
  teamAWinRate: number,
  teamBWinRate: number,
): string {
  const score = `${match.homeTeam.name} ${match.score.home}-${match.score.away} ${match.awayTeam.name}`;
  const balance =
    teamAWinRate === teamBWinRate
      ? "the projection remains balanced"
      : teamAWinRate > teamBWinRate
        ? `${match.homeTeam.name} hold the stronger projection`
        : `${match.awayTeam.name} hold the stronger projection`;

  if (event.type === "time_update") {
    return `[Match Agent] ${event.minute}' update: ${score}; ${balance}. Momentum reads ${match.homeTeam.name} ${teamA.momentum} vs ${match.awayTeam.name} ${teamB.momentum}.`;
  }

  return `[Match Agent] ${event.minute}' ${event.description} The agent updates the match state: ${match.homeTeam.name} ${teamAWinRate}% - ${teamBWinRate}% ${match.awayTeam.name}.`;
}

function buildLocalStrategyNarrative(
  match: Match,
  teamId: string,
  strategy: StrategyType,
  teamA: TeamState,
  teamB: TeamState,
  teamAWinRate: number,
  teamBWinRate: number,
): string {
  const team = teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
  const config = STRATEGY_CONFIGS[strategy];
  const metric = teamId === match.homeTeam.id ? teamA[config.affects] : teamB[config.affects];

  return `[Match Agent] Supporter signal received for ${team.name}: ${config.label}. The agent records it as a capped ${config.affects} preference, now reading ${metric}/100, with projection ${match.homeTeam.name} ${teamAWinRate}% - ${teamBWinRate}% ${match.awayTeam.name}.`;
}

// ── Community Influence Calculator ──
// Logarithmic: prevents whale domination, caps at +10 per attribute

function computeCommunityInfluence(matchId: string, teamId: string): {
  attackBonus: number;
  defenseBonus: number;
  midfieldBonus: number;
  supporterScore: number;
  strategySummary: string;
} {
  const strategies = store.getStrategiesForTeam(matchId, teamId);
  const pool = store.getStakingPool(matchId, teamId);

  // Supporter score from total stake (logarithmic)
  const supporterScore = clamp(Math.round(computeStakeInfluence(pool.totalStaked) * 10));

  if (strategies.length === 0) {
    return { attackBonus: 0, defenseBonus: 0, midfieldBonus: 0, supporterScore, strategySummary: "" };
  }

  // Aggregate strategy choices with logarithmic weight per user
  let attackBonus = 0, defenseBonus = 0, midfieldBonus = 0;
  const dist: Record<string, number> = {};

  for (const s of strategies) {
    const cfg = STRATEGY_CONFIGS[s.strategy];
    const userStakes = store.getUserStakes(s.userId, matchId);
    const userStakeAmount = userStakes.filter(u => u.teamId === teamId).reduce((sum, u) => sum + u.amount, 0);
    // Each user's influence = log10(1 + stake)
    const influence = computeStakeInfluence(userStakeAmount);

    if (cfg.affects === "attack") attackBonus += influence;
    else if (cfg.affects === "defense") defenseBonus += influence;
    else if (cfg.affects === "midfield") midfieldBonus += influence;

    const label = cfg.label;
    dist[label] = (dist[label] ?? 0) + 1;
  }

  const n = strategies.length;
  const summary = Object.entries(dist)
    .map(([k, v]) => `${k} (${Math.round((v / n) * 100)}%)`)
    .join(", ");

  return {
    attackBonus: Math.min(MAX_ATTRIBUTE_BONUS, Math.round(attackBonus)),
    defenseBonus: Math.min(MAX_ATTRIBUTE_BONUS, Math.round(defenseBonus)),
    midfieldBonus: Math.min(MAX_ATTRIBUTE_BONUS, Math.round(midfieldBonus)),
    supporterScore,
    strategySummary: summary,
  };
}

// ── State Delta Calculator ──
// Applies Reality Confidence Model: event impact × realityConfidence

function computeStateDeltas(
  event: MatchEvent,
  match: Match,
  prevTeamA: TeamState,
  prevTeamB: TeamState,
  communityA: ReturnType<typeof computeCommunityInfluence>,
  communityB: ReturnType<typeof computeCommunityInfluence>,
): { teamA: TeamState; teamB: TeamState } {
  const a = { ...prevTeamA };
  const b = { ...prevTeamB };

  // Apply community influence bonuses (capped)
  a.attack = clamp(a.attack + communityA.attackBonus);
  a.defense = clamp(a.defense + communityA.defenseBonus);
  a.midfield = clamp(a.midfield + communityA.midfieldBonus);
  a.supporter = communityA.supporterScore;

  b.attack = clamp(b.attack + communityB.attackBonus);
  b.defense = clamp(b.defense + communityB.defenseBonus);
  b.midfield = clamp(b.midfield + communityB.midfieldBonus);
  b.supporter = communityB.supporterScore;

  // Apply event deltas with Reality Confidence Model
  const impact = EVENT_IMPACT[event.type];
  if (impact) {
    const actualImpact = Math.round(impact.baseImpact * impact.realityConfidence);
    const isHomeEvent = event.side === "home";
    const isAwayEvent = event.side === "away";

    if (event.type === "goal") {
      if (isHomeEvent) {
        a.momentum = clamp(a.momentum + 20);
        b.momentum = clamp(b.momentum - 15);
        a.attack = clamp(a.attack + actualImpact);
        b.defense = clamp(b.defense - actualImpact);
      } else if (isAwayEvent) {
        b.momentum = clamp(b.momentum + 20);
        a.momentum = clamp(a.momentum - 15);
        b.attack = clamp(b.attack + actualImpact);
        a.defense = clamp(a.defense - actualImpact);
      }
    } else if (event.type === "red_card") {
      if (isHomeEvent) {
        a.momentum = clamp(a.momentum - 12);
        a.defense = clamp(a.defense - actualImpact);
        b.momentum = clamp(b.momentum + 10);
      } else if (isAwayEvent) {
        b.momentum = clamp(b.momentum - 12);
        b.defense = clamp(b.defense - actualImpact);
        a.momentum = clamp(a.momentum + 10);
      }
    } else if (event.type === "yellow_card") {
      if (isHomeEvent) {
        a.momentum = clamp(a.momentum - actualImpact);
      } else if (isAwayEvent) {
        b.momentum = clamp(b.momentum - actualImpact);
      }
    }
  }

  // Momentum dynamic adjustment
  const momentumShift = Math.round((Math.random() - 0.5) * MOMENTUM_DELTA);
  // Only apply random momentum to the team with higher momentum (snowball effect)
  if (a.momentum > b.momentum) {
    a.momentum = clamp(a.momentum + Math.abs(momentumShift));
  } else if (b.momentum > a.momentum) {
    b.momentum = clamp(b.momentum + Math.abs(momentumShift));
  }

  // Halftime: regression toward 50
  if (event.type === "halftime") {
    a.momentum = clamp(Math.round(a.momentum * 0.6 + 50 * 0.4));
    b.momentum = clamp(Math.round(b.momentum * 0.6 + 50 * 0.4));
  }

  // Kickoff: reset to baseline
  if (event.type === "kickoff") {
    a.momentum = 50; b.momentum = 50;
    a.supporter = 50; b.supporter = 50;
  }

  return { teamA: a, teamB: b };
}

// ── Main Agent Processing ──

export async function processMatchEvent(
  matchId: string,
  event: MatchEvent
): Promise<MatchAgentResponse> {
  const match = store.getMatch(matchId);
  if (!match) throw new Error(`Match not found: ${matchId}`);

  store.addEvent(matchId, event);
  const updatedMatch = store.getMatch(matchId)!;

  const prevState = store.getMatchAgentState(matchId);
  const prevTeamA: TeamState = prevState?.teamA ?? { attack: 50, defense: 50, midfield: 50, momentum: 50, supporter: 50 };
  const prevTeamB: TeamState = prevState?.teamB ?? { attack: 50, defense: 50, midfield: 50, momentum: 50, supporter: 50 };
  const prevAWinRate = prevState?.teamAWinRate ?? 50;
  const prevBWinRate = prevState?.teamBWinRate ?? 50;

  // Compute community influence
  const communityA = computeCommunityInfluence(matchId, match.homeTeam.id);
  const communityB = computeCommunityInfluence(matchId, match.awayTeam.id);

  // Compute state deltas with Reality Confidence Model
  const { teamA, teamB } = computeStateDeltas(event, updatedMatch, prevTeamA, prevTeamB, communityA, communityB);

  if (event.type === "fulltime") {
    const response: MatchAgentResponse = {
      teamA: prevState?.teamA ?? teamA,
      teamB: prevState?.teamB ?? teamB,
      teamAWinRate: prevAWinRate,
      teamBWinRate: prevBWinRate,
      predictedScore: prevState?.predictedScore ?? "?-?",
      confidence: prevState?.confidence ?? 50,
      narrativeUpdate: `[Match Agent] Full time reached. Settlement uses the last locked Agent prediction before the final whistle, not the simulated final score.`,
      timestamp: Date.now(),
      source: prevState?.source ?? "mock",
      somniaTxHash: prevState?.somniaTxHash,
    };
    store.updateMatchAgentState(matchId, response);
    return response;
  }

  // ── Call Somnia LLM Agent ──
  if (isAgentMoment(event)) {
    try {
      const myLineup = LINEUPS[match.homeTeam.id];
      const oppLineup = LINEUPS[match.awayTeam.id];
      const lineupCtx = event.type === "kickoff" && myLineup && oppLineup
        ? `${match.homeTeam.name} (${myLineup.formation}, rating: ${myLineup.strengthRating}/100): ${myLineup.startingXI.join(", ")}. Key: ${myLineup.keyPlayers.join(", ")}.\n${match.awayTeam.name} (${oppLineup.formation}, rating: ${oppLineup.strengthRating}/100): ${oppLineup.startingXI.join(", ")}. Key: ${oppLineup.keyPlayers.join(", ")}.`
        : undefined;

      const result = await callSomniaAgent({
        teamName: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        teamPersona: MATCH_AGENT_PERSONA,
        matchContext: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        currentScore: `${match.homeTeam.name} ${match.score.home} - ${match.score.away} ${match.awayTeam.name}`,
        minute: updatedMatch.currentMinute,
        latestEvent: event.description,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        teamAState: teamA,
        teamBState: teamB,
        strategySummaryA: communityA.strategySummary || undefined,
        strategySummaryB: communityB.strategySummary || undefined,
        lineupContext: lineupCtx,
        prevAWinRate,
        prevBWinRate,
      });

      if (result.source === "somnia-llm") {
        const response: MatchAgentResponse = {
          teamA: {
            attack: result.attackA ?? teamA.attack,
            defense: result.defenseA ?? teamA.defense,
            midfield: result.midfieldA ?? teamA.midfield,
            momentum: result.momentumA ?? teamA.momentum,
            supporter: teamA.supporter,
          },
          teamB: {
            attack: result.attackB ?? teamB.attack,
            defense: result.defenseB ?? teamB.defense,
            midfield: result.midfieldB ?? teamB.midfield,
            momentum: result.momentumB ?? teamB.momentum,
            supporter: teamB.supporter,
          },
          teamAWinRate: result.teamAWinRate ?? prevAWinRate,
          teamBWinRate: result.teamBWinRate ?? prevBWinRate,
          predictedScore: result.predictedScore ?? "?-?",
          confidence: result.confidence ?? 50,
          narrativeUpdate: `[Somnia AI] ${result.narrative}`,
          timestamp: Date.now(),
          source: "somnia-llm",
          somniaTxHash: result.txHash,
        };
        store.updateMatchAgentState(matchId, response);
        return response;
      }
    } catch (e) {
      console.warn(`[AgentEngine] Somnia call failed, using computed state`);
    }
  }

  // Fallback: update state metrics only, no narrative (Somnia LLM only)
  const scoreDiff = match.score.home - match.score.away;
  const aWR = clamp(50 + scoreDiff * 12 + (teamA.momentum - teamB.momentum) * 0.3);
  const bWR = 100 - aWR;

  const response: MatchAgentResponse = {
    teamA, teamB,
    teamAWinRate: aWR,
    teamBWinRate: bWR,
    predictedScore: prevState?.predictedScore ?? `${match.score.home}-${match.score.away}`,
    confidence: clamp(40 + Math.abs(scoreDiff) * 10),
    narrativeUpdate: buildLocalEventNarrative(updatedMatch, event, teamA, teamB, aWR, bWR),
    timestamp: Date.now(),
    source: "mock",
  };
  store.updateMatchAgentState(matchId, response);
  return response;
}

export async function processStrategyInput(
  matchId: string,
  teamId: string,
  strategy: StrategyType,
): Promise<MatchAgentResponse> {
  const match = store.getMatch(matchId);
  if (!match) throw new Error(`Match not found: ${matchId}`);

  const prevState = store.getMatchAgentState(matchId);
  const prevTeamA: TeamState = prevState?.teamA ?? { attack: 50, defense: 50, midfield: 50, momentum: 50, supporter: 50 };
  const prevTeamB: TeamState = prevState?.teamB ?? { attack: 50, defense: 50, midfield: 50, momentum: 50, supporter: 50 };

  const communityA = computeCommunityInfluence(matchId, match.homeTeam.id);
  const communityB = computeCommunityInfluence(matchId, match.awayTeam.id);
  const strategyEvent: MatchEvent = {
    id: store.nextEventId(),
    type: "time_update",
    side: "neutral",
    minute: match.currentMinute,
    description: `Supporter strategy input: ${teamId} selected ${STRATEGY_CONFIGS[strategy].label}.`,
    timestamp: Date.now(),
  };

  const { teamA, teamB } = computeStateDeltas(strategyEvent, match, prevTeamA, prevTeamB, communityA, communityB);
  const scoreDiff = match.score.home - match.score.away;
  const aWR = clamp(50 + scoreDiff * 12 + (teamA.momentum - teamB.momentum) * 0.3);
  const bWR = 100 - aWR;

  const response: MatchAgentResponse = {
    teamA,
    teamB,
    teamAWinRate: aWR,
    teamBWinRate: bWR,
    predictedScore: prevState?.predictedScore ?? `${match.score.home}-${match.score.away}`,
    confidence: clamp(45 + Math.abs(scoreDiff) * 10),
    narrativeUpdate: buildLocalStrategyNarrative(match, teamId, strategy, teamA, teamB, aWR, bWR),
    timestamp: Date.now(),
    source: "mock",
  };
  store.updateMatchAgentState(matchId, response);
  return response;
}
