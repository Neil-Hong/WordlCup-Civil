import { MATCH_IDS } from "./contracts";

const DEMO_MATCH_PREFIX = "demo_";

export function createDemoMatchId(now = Date.now()): string {
  return `${DEMO_MATCH_PREFIX}${now}`;
}

export function isDemoMatchId(matchId: string): boolean {
  return /^demo_\d{10,}$/.test(matchId);
}

export function getChainMatchId(matchId: string): bigint {
  if (isDemoMatchId(matchId)) {
    return BigInt(matchId.slice(DEMO_MATCH_PREFIX.length));
  }

  const mapped = MATCH_IDS[matchId];
  if (mapped) return BigInt(mapped);

  const numeric = Number(matchId);
  if (Number.isSafeInteger(numeric) && numeric > 0) {
    return BigInt(numeric);
  }

  return 1n;
}
