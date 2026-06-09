import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { seedMatch, startSimulation } from "@/lib/match-simulator";

// Initialize seed data on first request
let seeded = false;

export async function GET() {
  if (!seeded) {
    seedMatch();
    seeded = true;
  }

  const matches = store.getAllMatches();
  const enriched = matches.map((m) => {
    const homePool = store.getStakingPool(m.id, m.homeTeam.id);
    const awayPool = store.getStakingPool(m.id, m.awayTeam.id);
    const agent = store.getMatchAgentState(m.id);

    return {
      ...m,
      staking: {
        home: { totalStaked: homePool.totalStaked, userCount: homePool.userCount },
        away: { totalStaked: awayPool.totalStaked, userCount: awayPool.userCount },
      },
      matchAgent: agent ? {
        teamAWinRate: agent.teamAWinRate,
        teamBWinRate: agent.teamBWinRate,
        confidence: agent.confidence,
        teamA: agent.teamA,
        teamB: agent.teamB,
      } : null,
      agents: agent ? {
        home: { winProbability: agent.teamAWinRate / 100, confidence: agent.confidence },
        away: { winProbability: agent.teamBWinRate / 100, confidence: agent.confidence },
      } : {
        home: null,
        away: null,
      },
    };
  });

  return NextResponse.json({ matches: enriched });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, matchId } = body;

  if (action === "start") {
    const match = store.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.status === "live") {
      return NextResponse.json({ error: "Match already running" }, { status: 400 });
    }
    if (match.status === "finished") {
      return NextResponse.json({ error: "Match already finished" }, { status: 400 });
    }

    startSimulation(matchId);
    return NextResponse.json({ success: true, matchId });
  }

  if (action === "reset") {
    // Reset all data for demo
    store.matches.clear();
    store.matchAgentStates.clear();
    store.stakingPools.clear();
    store.userStakes.clear();
    store.results.clear();
    store.userStrategies.clear();
    store.globalEventLog = [];
    seeded = false;
    seedMatch();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
