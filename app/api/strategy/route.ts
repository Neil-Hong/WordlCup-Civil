import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { processStrategyInput } from "@/lib/agent-engine";
import type { StrategyType } from "@/lib/types";
import { STRATEGY_CONFIGS } from "@/lib/types";

const VALID_STRATEGIES = Object.keys(STRATEGY_CONFIGS) as StrategyType[];

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { matchId, teamId, strategy, userId } = body;

    if (!matchId || !teamId || !strategy) {
      return NextResponse.json({ error: "matchId, teamId, and strategy are required" }, { status: 400 });
    }

    // Validate strategy type
    if (!VALID_STRATEGIES.includes(strategy as StrategyType)) {
      return NextResponse.json({
        error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(", ")}`,
      }, { status: 400 });
    }

    // Validate match exists and is not finished
    const match = store.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.status === "finished") {
      return NextResponse.json({ error: "Match already finished" }, { status: 400 });
    }

    // Use a stable userId if not provided
    const uid = userId ?? "anonymous";

    // Verify user has staked on this team
    const stakes = store.getUserStakes(uid, matchId);
    const hasStake = stakes.some(s => s.teamId === teamId);
    if (!hasStake) {
      return NextResponse.json({ error: "You must stake on this team before selecting a strategy" }, { status: 403 });
    }

    const saved = store.setStrategy(uid, matchId, teamId, strategy as StrategyType);
    const config = STRATEGY_CONFIGS[saved.strategy];
    const agent = await processStrategyInput(matchId, teamId, saved.strategy);

    return NextResponse.json({
      success: true,
      strategy: { ...saved, label: config.label, affects: config.affects },
      agent,
    });
  } catch (err: any) {
    console.error("[Strategy API]", err);
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const userId = url.searchParams.get("userId") ?? "anonymous";

  if (!matchId) {
    return NextResponse.json({ error: "matchId query param required" }, { status: 400 });
  }

  const match = store.getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const homeStrategy = store.getUserStrategy(userId, matchId, match.homeTeam.id);
  const awayStrategy = store.getUserStrategy(userId, matchId, match.awayTeam.id);

  const formatStrategy = (s: ReturnType<typeof store.getUserStrategy>) => {
    if (!s) return null;
    const config = STRATEGY_CONFIGS[s.strategy];
    return { ...s, label: config.label, affects: config.affects };
  };

  return NextResponse.json({
    home: formatStrategy(homeStrategy),
    away: formatStrategy(awayStrategy),
  });
}
