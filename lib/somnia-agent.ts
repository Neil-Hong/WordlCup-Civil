import { createWalletClient, http, createPublicClient, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chains";

const ESTIMATED_DEPOSIT = BigInt("500000000000000000"); // 0.5 STT

const CALLBACK_ABI = [
  {
    type: "function", name: "requestInference",
    inputs: [{ name: "prompt", type: "string" }, { name: "system", type: "string" }],
    outputs: [{ name: "requestId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function", name: "getResult",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [{
      components: [
        { name: "textResponse", type: "string" },
        { name: "rawResult", type: "bytes" },
        { name: "numericResponse", type: "int256" },
        { name: "status", type: "uint8" },
        { name: "timestamp", type: "uint256" },
        { name: "fulfilled", type: "bool" },
        { name: "responseCount", type: "uint256" },
        { name: "firstValidatorStatus", type: "uint8" },
      ],
      type: "tuple",
    }],
    stateMutability: "view",
  },
  {
    type: "function", name: "lastRequestId",
    inputs: [], outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface SomniaAgentResult {
  narrative: string;
  teamAWinRate?: number;
  teamBWinRate?: number;
  predictedScore?: string;
  confidence?: number;
  // Team A metrics
  attackA?: number;
  defenseA?: number;
  midfieldA?: number;
  momentumA?: number;
  // Team B metrics
  attackB?: number;
  defenseB?: number;
  midfieldB?: number;
  momentumB?: number;
  //
  source: "somnia-llm" | "mock-fallback";
  requestId?: string;
  txHash?: string;
}

// ── Server Wallet ──

function getServerAccount() {
  let pk = process.env.PRIVATE_KEY;
  if (!pk || pk === "0x_your_private_key_here") return null;
  if (!pk.startsWith("0x")) pk = "0x" + pk;
  return privateKeyToAccount(pk as `0x${string}`);
}

function getCallbackAddr(): `0x${string}` {
  return (process.env.NEXT_PUBLIC_CALLBACK_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
}

// ── Main Entry Point ──

export async function callSomniaAgent(params: {
  teamName: string;
  teamPersona: string;
  matchContext: string;
  currentScore: string;
  minute: number;
  latestEvent: string;
  homeTeamName: string;
  awayTeamName: string;
  teamAState?: { attack: number; defense: number; midfield: number; momentum: number; supporter: number };
  teamBState?: { attack: number; defense: number; midfield: number; momentum: number; supporter: number };
  strategySummaryA?: string;
  strategySummaryB?: string;
  lineupContext?: string;
  prevAWinRate?: number;
  prevBWinRate?: number;
}): Promise<SomniaAgentResult> {
  const account = getServerAccount();
  const callbackAddr = getCallbackAddr();

  if (!account || callbackAddr === "0x0000000000000000000000000000000000000000") {
    return { narrative: "Agent offline", source: "mock-fallback" };
  }

  const wallet = createWalletClient({ account, chain: somniaTestnet, transport: http() });
  const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() });

  const systemPrompt = buildSystemPrompt(params.homeTeamName, params.awayTeamName, params.teamPersona);
  const userPrompt = buildUserPrompt(params);

  try {
    const reqData = encodeFunctionData({
      abi: CALLBACK_ABI, functionName: "requestInference",
      args: [userPrompt, systemPrompt],
    });

    console.log(`[SomniaAgent] Sending tx for ${params.teamName}...`);
    const txHash = await wallet.sendTransaction({
      to: callbackAddr, data: reqData, value: ESTIMATED_DEPOSIT,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30000 });
    console.log(`[SomniaAgent] TX: ${txHash.slice(0, 14)}... gas=${receipt.gasUsed}`);

    if (receipt.status !== "success") return { narrative: "TX failed", source: "mock-fallback" };

    let requestId = "0";
    try {
      const rid = await publicClient.readContract({
        address: callbackAddr, abi: CALLBACK_ABI, functionName: "lastRequestId",
      });
      requestId = rid.toString();
    } catch {}

    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      try {
        const result = await publicClient.readContract({
          address: callbackAddr, abi: CALLBACK_ABI, functionName: "getResult",
          args: [BigInt(requestId)],
        });
        const res = result as any;
        const text = (res.textResponse ?? "") as string;
        const status = Number(res.status ?? 0);
        const fulfilled = Boolean(res.fulfilled);

        if (fulfilled) {
          if (status === 2 && text.length > 0) {
            console.log(`[SomniaAgent] ✅ "${text.slice(0, 60)}..."`);
            const parsed = parseMatchAgentResponse(text);
            return { ...parsed, source: "somnia-llm", requestId, txHash };
          }
          console.log(`[SomniaAgent] Status=${status}`);
          break;
        }
      } catch { /* keep polling */ }
    }

    console.log(`[SomniaAgent] Timeout`);
    return { narrative: "Agent timeout", source: "mock-fallback" };
  } catch (err: any) {
    console.warn(`[SomniaAgent] Error: ${err.message?.slice(0, 80)}`);
    return { narrative: "Agent error", source: "mock-fallback" };
  }
}

// ── Prompt Building ──

function buildSystemPrompt(homeTeam: string, awayTeam: string, persona: string): string {
  return `${persona}

OUTPUT FORMAT — You MUST respond with valid JSON only, no markdown, no extra text:
{
  "narrative": "<2-4 sentences of tactical analysis covering both teams>",
  "teamAWinRate": <number 0-100, ${homeTeam} win probability %>,
  "teamBWinRate": <number 0-100, ${awayTeam} win probability %>,
  "predictedScore": "<home>-<away>",
  "attackA": <number 0-100, ${homeTeam} attack strength>,
  "defenseA": <number 0-100>,
  "midfieldA": <number 0-100>,
  "momentumA": <number 0-100>,
  "attackB": <number 0-100, ${awayTeam} attack strength>,
  "defenseB": <number 0-100>,
  "midfieldB": <number 0-100>,
  "momentumB": <number 0-100>,
  "confidence": <number 0-100, how certain you are about this prediction>
}

RULES:
- teamAWinRate + teamBWinRate MUST equal 100
- All metrics are 0-100 scale
- Momentum reflects recent events and match flow
- Stay neutral and objective — you are analyzing BOTH teams`;
}

function buildUserPrompt(p: {
  homeTeamName: string; awayTeamName: string; matchContext: string; currentScore: string;
  minute: number; latestEvent: string;
  teamAState?: { attack: number; defense: number; midfield: number; momentum: number; supporter: number };
  teamBState?: { attack: number; defense: number; midfield: number; momentum: number; supporter: number };
  strategySummaryA?: string; strategySummaryB?: string;
  lineupContext?: string;
  prevAWinRate?: number; prevBWinRate?: number;
}): string {
  let prompt = `MATCH STATE — Minute ${p.minute}'\n${p.matchContext}\nScore: ${p.currentScore}\nLatest event: ${p.latestEvent}`;

  if (p.lineupContext) {
    prompt += `\n\nPRE-MATCH LINEUPS:\n${p.lineupContext}`;
  }

  if (p.prevAWinRate !== undefined) {
    prompt += `\n\nPREVIOUS PREDICTION: ${p.homeTeamName} ${p.prevAWinRate}% - ${p.prevBWinRate}% ${p.awayTeamName}`;
  }

  prompt += `\n\nCURRENT METRICS — ${p.homeTeamName}: Attack=${p.teamAState?.attack ?? 50} Defense=${p.teamAState?.defense ?? 50} Midfield=${p.teamAState?.midfield ?? 50} Momentum=${p.teamAState?.momentum ?? 50} Supporter=${p.teamAState?.supporter ?? 50}`;
  prompt += `\nCURRENT METRICS — ${p.awayTeamName}: Attack=${p.teamBState?.attack ?? 50} Defense=${p.teamBState?.defense ?? 50} Midfield=${p.teamBState?.midfield ?? 50} Momentum=${p.teamBState?.momentum ?? 50} Supporter=${p.teamBState?.supporter ?? 50}`;

  if (p.strategySummaryA) {
    prompt += `\n\n${p.homeTeamName} SUPPORTER STRATEGIES: ${p.strategySummaryA}`;
  }
  if (p.strategySummaryB) {
    prompt += `\n${p.awayTeamName} SUPPORTER STRATEGIES: ${p.strategySummaryB}`;
  }

  prompt += `\n\nAnalyze the match state and respond with the required JSON format.`;

  return prompt;
}

// ── Response Parser ──

function parseMatchAgentResponse(text: string): Omit<SomniaAgentResult, "source" | "requestId" | "txHash"> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const j = JSON.parse(jsonMatch[0]);
      return {
        narrative: j.narrative ?? text.slice(0, 300),
        teamAWinRate: clamp0_100(j.teamAWinRate ?? j.team_a_win_rate),
        teamBWinRate: clamp0_100(j.teamBWinRate ?? j.team_b_win_rate),
        predictedScore: j.predictedScore ?? j.predicted_score ?? "?-?",
        confidence: clamp0_100(j.confidence),
        attackA: clamp0_100(j.attackA ?? j.attack_a), defenseA: clamp0_100(j.defenseA ?? j.defense_a),
        midfieldA: clamp0_100(j.midfieldA ?? j.midfield_a), momentumA: clamp0_100(j.momentumA ?? j.momentum_a),
        attackB: clamp0_100(j.attackB ?? j.attack_b), defenseB: clamp0_100(j.defenseB ?? j.defense_b),
        midfieldB: clamp0_100(j.midfieldB ?? j.midfield_b), momentumB: clamp0_100(j.momentumB ?? j.momentum_b),
      };
    } catch { /* fall through */ }
  }

  return { narrative: text.slice(0, 300) };
}

function clamp0_100(v: any): number | undefined {
  if (typeof v === "number") return Math.max(0, Math.min(100, Math.round(v)));
  if (typeof v === "string") { const n = parseInt(v, 10); return isNaN(n) ? undefined : Math.max(0, Math.min(100, n)); }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
