import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { matchId, teamId, amount } = body;

  if (!matchId || !teamId || !amount) {
    return NextResponse.json(
      { error: "Missing required fields: matchId, teamId, amount" },
      { status: 400 }
    );
  }

  const match = store.getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status === "finished") {
    return NextResponse.json(
      { error: "Cannot stake on a finished match" },
      { status: 400 }
    );
  }

  if (teamId !== match.homeTeam.id && teamId !== match.awayTeam.id) {
    return NextResponse.json(
      { error: "Invalid team for this match" },
      { status: 400 }
    );
  }

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be a positive number" },
      { status: 400 }
    );
  }

  // Generate a simple user ID (in production this would come from wallet/auth)
  const userId = req.headers.get("x-user-id") ?? `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const stake = store.stake(userId, matchId, teamId, amount);

  return NextResponse.json({
    success: true,
    stake,
    userId,
    pool: store.getStakingPool(matchId, teamId),
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const userId = url.searchParams.get("userId");

  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  if (userId) {
    const stakes = store.getUserStakes(userId, matchId);
    return NextResponse.json({ stakes });
  }

  const match = store.getMatch(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  const homePool = store.getStakingPool(matchId, match.homeTeam.id);
  const awayPool = store.getStakingPool(matchId, match.awayTeam.id);
  return NextResponse.json({ pools: [homePool, awayPool] });
}
