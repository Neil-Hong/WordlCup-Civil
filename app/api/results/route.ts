import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");

  if (matchId) {
    const result = store.getResult(matchId);
    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json({ result });
  }

  // Return all results
  const allResults = Array.from(store.results.values());
  return NextResponse.json({ results: allResults });
}
