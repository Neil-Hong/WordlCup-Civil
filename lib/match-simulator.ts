import { store, TEAMS } from "./store";
import { processMatchEvent } from "./agent-engine";
import type { Match, MatchEvent } from "./types";

// ── Pre-match lineup data ──

export interface LineupData {
  formation: string;
  startingXI: string[];
  substitutes: string[];
  keyPlayers: string[];
  strengthRating: number; // 0-100
}

export const LINEUPS: Record<string, LineupData> = {
  brazil: {
    formation: "4-2-3-1",
    startingXI: ["Alisson", "Danilo", "Marquinhos", "Gabriel", "Alex Sandro", "Casemiro", "Paqueta", "Raphinha", "Neymar", "Vinicius Jr", "Rodrygo"],
    substitutes: ["Ederson", "Militao", "Bruno Guimaraes", "Martinelli", "Jesus"],
    keyPlayers: ["Neymar", "Vinicius Jr", "Casemiro"],
    strengthRating: 88,
  },
  england: {
    formation: "4-3-3",
    startingXI: ["Pickford", "Walker", "Stones", "Maguire", "Shaw", "Rice", "Bellingham", "Foden", "Saka", "Kane", "Rashford"],
    substitutes: ["Ramsdale", "Trippier", "Henderson", "Grealish", "Wilson"],
    keyPlayers: ["Kane", "Bellingham", "Saka"],
    strengthRating: 86,
  },
};

// ── Probabilistic Event Generation ──
// Events are NOT guaranteed — they happen based on probability,
// simulating the uncertainty of real football. The Agent interprets
// whatever events occur (or don't occur) autonomously.

const PLAYERS: Record<string, string[]> = {
  brazil: ["Neymar", "Vinicius Jr", "Rodrygo", "Raphinha", "Paqueta", "Casemiro"],
  england: ["Kane", "Bellingham", "Saka", "Foden", "Rice", "Rashford"],
};

function weightedCoin(prob: number): boolean {
  return Math.random() < prob;
}

function randomPlayer(teamId: string): string {
  const names = PLAYERS[teamId] ?? ["Player"];
  return names[Math.floor(Math.random() * names.length)];
}

function generateGoal(minute: number, match: Match): MatchEvent | null {
  const baseChance = 0.04; // 4% per tick
  let phaseMult = 1.0;
  if (minute < 15) phaseMult = 0.3;
  else if (minute < 30) phaseMult = 0.7;
  else if (minute < 45) phaseMult = 1.2;
  else if (minute < 55) phaseMult = 0.5;
  else if (minute < 75) phaseMult = 1.0;
  else phaseMult = 1.5;

  if (!weightedCoin(baseChance * phaseMult)) return null;

  const diff = match.score.home - match.score.away;
  let side: "home" | "away";
  if (diff > 1) side = weightedCoin(0.6) ? "away" : "home";
  else if (diff < -1) side = weightedCoin(0.6) ? "home" : "away";
  else side = weightedCoin(0.55) ? "home" : "away";

  const teamId = side === "home" ? match.homeTeam.id : match.awayTeam.id;
  const player = randomPlayer(teamId);
  const descs = [
    `${player} with a clinical finish into the bottom corner!`,
    `${player} scores from a brilliant counter-attack!`,
    `${player} heads it in from a corner!`,
    `${player} curls a beauty into the top corner!`,
    `Penalty converted by ${player}!`,
    `${player} taps in from close range after a defensive error.`,
  ];
  return createEvent("goal", side, minute, descs[Math.floor(Math.random() * descs.length)], player);
}

function generateCard(minute: number, match: Match): MatchEvent | null {
  const baseChance = 0.03;
  if (!weightedCoin(baseChance)) return null;
  const diff = match.score.home - match.score.away;
  const isRed = weightedCoin(0.1); // 10% of cards are red
  let side: "home" | "away";
  if (diff < 0) side = weightedCoin(0.55) ? "home" : "away";
  else if (diff > 0) side = weightedCoin(0.55) ? "away" : "home";
  else side = weightedCoin(0.5) ? "home" : "away";
  const teamId = side === "home" ? match.homeTeam.id : match.awayTeam.id;
  const player = randomPlayer(teamId);
  return createEvent(
    isRed ? "red_card" : "yellow_card", side, minute,
    isRed ? `${player} is SENT OFF! A reckless challenge and the referee shows red!` : `${player} receives a yellow card.`,
    player,
  );
}

// ── Helper ──

function createEvent(
  type: MatchEvent["type"],
  side: MatchEvent["side"],
  minute: number,
  description: string,
  player?: string
): MatchEvent {
  return {
    id: store.nextEventId(),
    type,
    side,
    minute,
    player,
    description,
    timestamp: Date.now(),
  };
}

// ── Create the single match ──

export function createMatch(): Match {
  const match: Match = {
    id: "match_1",
    homeTeam: TEAMS.brazil,
    awayTeam: TEAMS.england,
    status: "upcoming",
    score: { home: 0, away: 0 },
    currentMinute: 0,
    events: [],
    startTime: Date.now(),
  };
  store.matches.set("match_1", match);
  return match;
}

// ── Simulation Control ──

export interface SimulationState {
  matchId: string;
  running: boolean;
  currentMinute: number;
  timerId: ReturnType<typeof setInterval> | null;
  eventIndex: number;
}

const simulations: Map<string, SimulationState> = new Map();

export function startSimulation(matchId: string): SimulationState {
  const match = store.getMatch(matchId);
  if (!match) throw new Error(`Match not found: ${matchId}`);

  stopSimulation(matchId);

  // Reset
  match.status = "live";
  match.startTime = Date.now();
  match.currentMinute = 0;
  match.score = { home: 0, away: 0 };
  match.events = [];
  store.matchAgentStates.delete(matchId);

  // ── Kickoff: pre-match lineup analysis ──
  const kickoff = createEvent(
    "kickoff",
    "neutral",
    0,
    `KICKOFF! ${match.homeTeam.name} (${LINEUPS.brazil.formation}) vs ${match.awayTeam.name} (${LINEUPS.england.formation}). Brazil lineup: ${LINEUPS.brazil.startingXI.slice(0, 6).join(", ")}... England lineup: ${LINEUPS.england.startingXI.slice(0, 6).join(", ")}...`
  );

  processMatchEvent(matchId, kickoff).catch(() => {});

  const sim: SimulationState = {
    matchId,
    running: true,
    currentMinute: 0,
    timerId: null,
    eventIndex: 0,
  };

  // Probabilistic match simulation — events may or may not occur
  sim.timerId = setInterval(() => {
    const currentMatch = store.getMatch(matchId);
    if (!currentMatch || currentMatch.status === "finished") {
      stopSimulation(matchId);
      return;
    }

    // Advance time by 2-4 minutes
    sim.currentMinute = Math.min(90, sim.currentMinute + 2 + Math.floor(Math.random() * 3));

    // Time update
    const tu = createEvent("time_update", "neutral", sim.currentMinute, `Match clock: ${sim.currentMinute}'`);
    store.addEvent(matchId, tu);

    // Probabilistic events
    const goal = generateGoal(sim.currentMinute, currentMatch);
    if (goal) processMatchEvent(matchId, goal).catch(() => {});

    const card = generateCard(sim.currentMinute, currentMatch);
    if (card) processMatchEvent(matchId, card).catch(() => {});

    // Halftime at 45
    if (sim.currentMinute >= 45 && !currentMatch.events.some(e => e.type === "halftime")) {
      const halftime = createEvent("halftime", "neutral", 45, "HALFTIME! Teams head to the dressing room.");
      processMatchEvent(matchId, halftime).catch(() => {});
    }

    // Fulltime at 90
    if (sim.currentMinute >= 90 && !currentMatch.events.some(e => e.type === "fulltime")) {
      const ft = createEvent("fulltime", "neutral", 90, "FULL TIME! The referee blows the final whistle.");
      processMatchEvent(matchId, ft).catch(() => {});
      currentMatch.status = "finished";
      currentMatch.currentMinute = 90;
      store.calculateRewards(matchId);
    }
  }, 4000);

  simulations.set(matchId, sim);
  return sim;
}

export function stopSimulation(matchId: string): void {
  const sim = simulations.get(matchId);
  if (sim?.timerId) {
    clearInterval(sim.timerId as any);
    sim.timerId = null;
    sim.running = false;
  }
  simulations.delete(matchId);
}

// ── Seed: just the one match ──

export function seedMatch(): Match | null {
  if (store.getMatch("match_1")) return null;
  return createMatch();
}
