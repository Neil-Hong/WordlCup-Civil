import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chains";
import { CONTRACTS, PredictionABI, TEAM_IDS } from "./contracts";
import { getChainMatchId } from "./match-id";
import { store } from "./store";

const finalizeInFlight = new Map<string, Promise<{ tx?: string; error?: string }>>();

function getServerAccount() {
  let pk = process.env.PRIVATE_KEY;
  if (!pk || pk === "0x_your_private_key_here") {
    console.warn("[ChainWriter] No PRIVATE_KEY configured; on-chain writes disabled");
    return null;
  }
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  return privateKeyToAccount(pk as `0x${string}`);
}

function getWalletClient() {
  const account = getServerAccount();
  if (!account) return null;
  return createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(),
  });
}

function isValidAddress(addr: string): boolean {
  return addr.startsWith("0x") && addr.length === 42 && addr !== "0x0000000000000000000000000000000000000000";
}

function getContractError(): string | null {
  if (!isValidAddress(CONTRACTS.teamVault)) return "VAULT_ADDRESS not configured";
  if (!isValidAddress(CONTRACTS.prediction)) return "PREDICTION_ADDRESS not configured";
  if (!isValidAddress(CONTRACTS.reward)) return "REWARD_ADDRESS not configured";
  return null;
}

export async function finalizeMatchOnChain(matchId: string): Promise<{ tx?: string; error?: string }> {
  const active = finalizeInFlight.get(matchId);
  if (active) return active;

  const task = finalizeMatchOnChainInternal(matchId).finally(() => {
    finalizeInFlight.delete(matchId);
  });
  finalizeInFlight.set(matchId, task);
  return task;
}

async function finalizeMatchOnChainInternal(matchId: string): Promise<{ tx?: string; error?: string }> {
  const contractError = getContractError();
  if (contractError) return { error: `Contracts not configured: ${contractError}` };

  const wallet = getWalletClient();
  if (!wallet) return { error: "No server wallet configured (check PRIVATE_KEY in .env.local)" };

  const match = store.getMatch(matchId);
  if (!match || match.status !== "finished") return { error: "Match not finished" };

  const settlement = store.getAgentSettlement(matchId);
  if (!settlement) return { error: "No Agent settlement prediction found" };

  const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() });
  const balance = await publicClient.getBalance({ address: wallet.account.address });
  if (balance === 0n) return { error: "Server wallet has 0 STT; fund it at the Somnia faucet" };

  const numericMatchId = getChainMatchId(matchId);
  const homeNumericId = BigInt(TEAM_IDS[match.homeTeam.id] ?? 1);
  const awayNumericId = BigInt(TEAM_IDS[match.awayTeam.id] ?? 2);

  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.prediction,
      abi: PredictionABI,
      functionName: "results",
      args: [numericMatchId],
    });
    if ((result as any)[3]) return { tx: "already-finalized" };

    const setTeamsTx = await writePredictionContractWithNonceRetry(
      wallet,
      publicClient,
      "setMatchTeams",
      [numericMatchId, homeNumericId, awayNumericId],
    );
    await publicClient.waitForTransactionReceipt({ hash: setTeamsTx, timeout: 60000 });

    const tx = await writePredictionContractWithNonceRetry(
      wallet,
      publicClient,
      "finalizeMatchResult",
      [numericMatchId, settlement.homeScore, settlement.awayScore],
    );
    await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60000 });

    match.onChainTxHash = tx;
    await topUpRewardPoolIfNeeded(wallet);

    return { tx };
  } catch (err: any) {
    console.error("[ChainWriter] Finalize failed:", err.message);
    if (await isMatchAlreadyFinalized(publicClient, numericMatchId)) {
      return { tx: "already-finalized" };
    }
    return { error: err.message };
  }
}

async function isMatchAlreadyFinalized(
  publicClient: ReturnType<typeof createPublicClient>,
  numericMatchId: bigint,
): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.prediction,
      abi: PredictionABI,
      functionName: "results",
      args: [numericMatchId],
    });
    return Boolean((result as any)[3]);
  } catch {
    return false;
  }
}

async function writePredictionContractWithNonceRetry(
  wallet: NonNullable<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
  functionName: "setMatchTeams" | "finalizeMatchResult",
  args: readonly unknown[],
): Promise<Hash> {
  let lastError: any;
  let nextNonce: number | undefined;

  for (let attempt = 0; attempt < 8; attempt++) {
    let nonce: number | undefined;
    try {
      nonce = nextNonce ?? await publicClient.getTransactionCount({
        address: wallet.account.address,
        blockTag: "pending",
      });

      return await wallet.writeContract({
        address: CONTRACTS.prediction,
        abi: PredictionABI,
        functionName,
        args,
        nonce,
      } as any);
    } catch (err: any) {
      lastError = err;
      if (!isNonceTooLowError(err) || attempt === 7) break;
      if (nonce != null) nextNonce = nonce + 1;
      await sleep(900 + attempt * 600);
    }
  }

  throw lastError;
}

function isNonceTooLowError(err: any): boolean {
  const message = String(err?.shortMessage ?? err?.message ?? err ?? "").toLowerCase();
  return message.includes("nonce too low") ||
    message.includes("nonce provided") ||
    message.includes("lower than the current nonce");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function topUpRewardPoolIfNeeded(wallet: NonNullable<ReturnType<typeof getWalletClient>>) {
  try {
    const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() });
    const rewardBalance = await publicClient.getBalance({ address: CONTRACTS.reward });
    if (rewardBalance >= parseEther("0.1")) return;

    const topUpTx = await wallet.sendTransaction({
      to: CONTRACTS.reward,
      value: parseEther("0.1"),
    });
    await publicClient.waitForTransactionReceipt({ hash: topUpTx, timeout: 60000 });
  } catch (err: any) {
    console.warn("[ChainWriter] Reward top-up failed:", err.message);
  }
}

function parseEther(value: string): bigint {
  return BigInt(Math.floor(parseFloat(value) * 1e18));
}
