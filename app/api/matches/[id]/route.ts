import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { advanceSimulation, ensureMatch, seedMatch } from "@/lib/match-simulator";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  seedMatch();
  const match = params.id.startsWith("demo_") ? ensureMatch(params.id) : store.getMatch(params.id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status === "live") {
    advanceSimulation(match.id);
    const hasFulltime = match.events.some(e => e.type === "fulltime");
    if (hasFulltime || match.currentMinute >= 90) {
      match.status = "finished";
      if (!match.events.some(e => e.type === "fulltime")) {
        match.events.push({
          id: store.nextEventId(), type: "fulltime", side: "neutral",
          minute: 90, description: "FULL TIME!", timestamp: Date.now(),
        });
      }
    }
  }

  if (match.status === "finished") {
    store.calculateRewards(match.id);
  }

  const homePool = store.getStakingPool(match.id, match.homeTeam.id);
  const awayPool = store.getStakingPool(match.id, match.awayTeam.id);
  const matchAgent = store.getMatchAgentState(match.id);

  const totalPool = homePool.totalStaked + awayPool.totalStaked;

  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
  let userStrategies = null;
  if (userId) {
    const homeStrat = store.getUserStrategy(userId, match.id, match.homeTeam.id);
    const awayStrat = store.getUserStrategy(userId, match.id, match.awayTeam.id);
    userStrategies = { home: homeStrat ?? null, away: awayStrat ?? null };
  }

  return NextResponse.json({
    match,
    staking: { home: homePool, away: awayPool, totalPool },
    matchAgent: matchAgent ?? null,
    result: store.getResult(match.id) ?? null,
    userStrategies,
  });
}
