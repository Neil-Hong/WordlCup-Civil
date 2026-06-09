import { NextRequest, NextResponse } from "next/server";
import { finalizeMatchOnChain } from "@/lib/chain-writer";

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { matchId, action } = body;

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    // Verify contracts are configured
    if (!process.env.NEXT_PUBLIC_PREDICTION_ADDRESS || process.env.NEXT_PUBLIC_PREDICTION_ADDRESS === "0x_") {
      return NextResponse.json({ error: "Contract addresses not configured in .env.local" }, { status: 500 });
    }

    if (action !== "finalize") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const result = await finalizeMatchOnChain(matchId);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Commit API] Unhandled error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error", stack: process.env.NODE_ENV === "development" ? err?.stack : undefined },
      { status: 500 }
    );
  }
}
