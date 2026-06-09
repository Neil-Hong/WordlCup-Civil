"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { FlagIcon } from "@/components/FlagIcon";
import { LiveMatchPanel } from "@/components/LiveMatchPanel";
import { AgentFeed } from "@/components/AgentFeed";
import { OddsPanel } from "@/components/OddsPanel";
import { StakingPanel } from "@/components/StakingPanel";
import { useCalculateReward, useClaimReward, useMatchResult, useRewardBalance, useRewardClaimed, useUserStakeRead } from "@/lib/hooks";
import type { Match, StakingPool, MatchResult, MatchAgentState } from "@/lib/types";

interface MatchDetail {
  match: Match;
  staking: { home: StakingPool; away: StakingPool; totalPool: number };
  matchAgent: MatchAgentState | null;
  result: MatchResult | null;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { address } = useAccount();

  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const rewardBalance = useRewardBalance();

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 3000);
    return () => clearInterval(interval);
  }, [fetchMatch]);

  const handleStakeSuccess = () => {
    fetchMatch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Match not found.</p>
      </div>
    );
  }

  const { match, staking, matchAgent, result } = data;
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <div className="py-6">
      {/* Match ID breadcrumb */}
      <div className="text-xs text-gray-600 mb-4">
        Match #{matchId} &middot;{" "}
        {isLive ? "In Progress" : isFinished ? "Completed" : "Scheduled"}
      </div>

      {/* Top: Live Match Panel */}
      <div className="mb-6">
        <LiveMatchPanel match={match} events={match.events} />
      </div>

      {/* Middle: Agent Feed */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          AI Agent Analysis
        </h3>
        <AgentFeed
          matchId={match.id}
          homeTeam={{ ...match.homeTeam, color: match.homeTeam.color }}
          awayTeam={{ ...match.awayTeam, color: match.awayTeam.color }}
          initialAgent={matchAgent}
        />
      </div>

      {/* Bottom: Odds + Staking side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OddsPanel
          matchId={match.id}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homeWinRate={matchAgent?.teamAWinRate ?? 50}
          awayWinRate={matchAgent?.teamBWinRate ?? 50}
        />
        <StakingPanel
          key={`${match.id}:${address ?? "disconnected"}`}
          matchId={match.id}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          matchStatus={match.status}
          onStakeSuccess={handleStakeSuccess}
        />
      </div>

      {/* Auto-finalize on Somnia after match ends */}
      {isFinished && (
        <AutoFinalize matchId={match.id} onFinalized={fetchMatch} />
      )}

      {/* Reward results for finished matches */}
      {isFinished && result && (
        <div className="mt-8">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
            Reward Distribution
          </h3>
          <div className="glass-panel p-5">
            {/* Winner banner */}
            <div className="text-center mb-6">
              {result.winner ? (
                <div className="text-lg font-bold text-gold">
                  <FlagIcon
                    teamId={result.winner === match.homeTeam.id ? match.homeTeam.id : match.awayTeam.id}
                    size={32}
                  />{" "}
                  {result.winner === match.homeTeam.id
                    ? match.homeTeam.name
                    : match.awayTeam.name}{" "}
                  Wins!
                </div>
              ) : (
                <div className="text-lg font-bold text-gray-400">
                  Agent Predicted Draw
                </div>
              )}
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-1">
                Agent Settlement Prediction
              </div>
              <div className="text-3xl font-bold text-white mt-1">
                {result.homeScore} - {result.awayScore}
              </div>
              {result.actualHomeScore !== undefined && result.actualAwayScore !== undefined && (
                <div className="text-[10px] text-gray-500 mt-1">
                  Simulated full-time score: {result.actualHomeScore} - {result.actualAwayScore}
                </div>
              )}
            </div>

            {/* Pool info */}
            <div className="mb-6">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Staking Pools
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">{match.homeTeam.name} Pool</div>
                  <div className="text-lg font-bold text-agent-blue">{result.homePool.toFixed(3)} STT</div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">{match.awayTeam.name} Pool</div>
                  <div className="text-lg font-bold text-agent-red">{result.awayPool.toFixed(3)} STT</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Reward Contract Balance</div>
                <div className="text-lg font-bold text-gold">
                  {rewardBalance.data ? Number(rewardBalance.data.formatted).toFixed(3) : "0.000"} STT
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  MVP liquidity used for claimable testnet payouts.
                </div>
              </div>
            </div>

            {/* Reward table */}
            {result.rewards.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Payouts
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-2 font-medium">User</th>
                        <th className="text-left py-2 font-medium">Team</th>
                        <th className="text-right py-2 font-medium">Stake</th>
                        <th className="text-right py-2 font-medium">Share</th>
                        <th className="text-right py-2 font-medium">Reward</th>
                        <th className="text-right py-2 font-medium">Returned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rewards.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5 text-gray-300"
                        >
                          <td className="py-2 text-gray-500">
                            {r.userId.slice(0, 12)}...
                          </td>
                          <td className="py-2">
                            <FlagIcon
                              teamId={r.teamId === match.homeTeam.id ? match.homeTeam.id : match.awayTeam.id}
                              size={20}
                            />
                          </td>
                          <td className="py-2 text-right">{r.stakeAmount.toFixed(3)}</td>
                          <td className="py-2 text-right text-gray-500">{r.poolShare.toFixed(1)}%</td>
                          <td className="py-2 text-right text-green-400">+{r.rewardFromLosingPool.toFixed(3)}</td>
                          <td className="py-2 text-right font-bold text-gold">{r.totalReturned.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.rewards.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-4">
                No stakes were placed on this match.
              </p>
            )}

            {/* On-Chain Claim Section */}
            <OnChainClaim matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          </div>
        </div>
      )}
    </div>
  );
}

function AutoFinalize({ matchId, onFinalized }: { matchId: string; onFinalized: () => void }) {
  const [finalizing, setFinalizing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const startedRef = useRef(false);
  const chainResult = useMatchResult(matchId);
  const alreadyDone = !!chainResult?.finalized;

  const handleFinalize = useCallback(async () => {
    if (startedRef.current || alreadyDone) return;
    startedRef.current = true;
    setFinalizing(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action: "finalize" }),
      });
      const data = await res.json();
      if (data.error) {
        setErr(data.error);
      } else if (data.tx) {
        setTxHash(data.tx);
        onFinalized();
      } else {
        setErr("Unknown error");
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setFinalizing(false);
    }
  }, [alreadyDone, matchId, onFinalized]);

  useEffect(() => {
    if (!alreadyDone) {
      handleFinalize();
    }
  }, [alreadyDone, handleFinalize]);

  if (alreadyDone) {
    return (
      <div className="mt-6 glass-panel p-4 border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm">&#10003;</span>
          <div>
            <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">Match Finalized On-Chain</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Result written to Somnia. Rewards are now claimable below.
            </p>
            {txHash && txHash !== "already-finalized" ? (
              <a href={`https://shannon-explorer.somnia.network/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                 className="text-[10px] text-agent-blue mt-1 block hover:underline">
                View on Explorer: {txHash.slice(0, 20)}...
              </a>
            ) : (
              <a href={`https://shannon-explorer.somnia.network/address/${process.env.NEXT_PUBLIC_PREDICTION_ADDRESS}`} target="_blank" rel="noopener noreferrer"
                 className="text-[10px] text-agent-blue mt-1 block hover:underline">
                Verify on-chain: View Prediction Contract
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 glass-panel p-4 border border-gold/20">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-gold uppercase tracking-wider">On-Chain Finalization</h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {finalizing
              ? "Finalizing match result on Somnia automatically..."
              : txHash
                ? "Finalization submitted. Waiting for on-chain result..."
                : err
                  ? "Automatic finalization needs attention."
                  : "Preparing automatic finalization on Somnia."}
          </p>
        </div>
        <span className="rounded-lg bg-gold/10 px-3 py-2 text-xs font-bold text-gold">
          {finalizing ? "Finalizing..." : txHash ? "Submitted" : err ? "Retry on reload" : "Queued"}
        </span>
      </div>
      {txHash && txHash !== "already-finalized" && (
        <a href={`https://shannon-explorer.somnia.network/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          className="block text-[10px] text-agent-blue mt-2 hover:underline">
          View on Explorer: {txHash.slice(0, 20)}...
        </a>
      )}
      {err && <p className="text-[10px] text-red-400 mt-2">{err}</p>}
    </div>
  );
}

function OnChainClaim({
  matchId,
  homeTeam,
  awayTeam,
}: {
  matchId: string;
  homeTeam: { id: string; name: string; flag: string };
  awayTeam: { id: string; name: string; flag: string };
}) {
  const { isConnected } = useAccount();
  const homeStakeRead = useUserStakeRead(matchId, homeTeam.id);
  const awayStakeRead = useUserStakeRead(matchId, awayTeam.id);
  const chainResult = useMatchResult(matchId);
  const getStakeAmount = (stake: any): bigint => stake?.amount ?? stake?.[0] ?? 0n;
  const homeStake = homeStakeRead.data;
  const awayStake = awayStakeRead.data;
  const homeAmount = getStakeAmount(homeStake);
  const awayAmount = getStakeAmount(awayStake);
  const claimTeam = homeAmount > 0n ? homeTeam : awayAmount > 0n ? awayTeam : null;
  const claimAmount = homeAmount > 0n ? homeAmount : awayAmount;
  const reward = useCalculateReward(matchId, claimTeam?.id ?? homeTeam.id, !!claimTeam && !!chainResult?.finalized);
  const rewardClaimed = useRewardClaimed(matchId, claimTeam?.id ?? homeTeam.id, !!claimTeam && !!chainResult?.finalized);
  const { claim, hash, isPending, isConfirming, isSuccess, error } = useClaimReward(
    matchId,
    claimTeam?.id ?? homeTeam.id,
  );

  if (!isConnected) return null;

  const rewardAmount = reward?.[0] ?? 0n;
  const stakeReturned = reward?.[1] ?? 0n;
  const settlementBonus = reward?.[2] ?? 0n;
  const alreadyClaimed = rewardClaimed.claimed === true || isSuccess;
  const claimStatusLoading = rewardClaimed.isLoading && rewardClaimed.claimed === undefined;
  const canClaim = !!claimTeam && rewardAmount > 0n && !alreadyClaimed && !claimStatusLoading && !isPending && !isConfirming;
  const stakeReadsLoading =
    (homeStakeRead.isLoading && homeStake === undefined) ||
    (awayStakeRead.isLoading && awayStake === undefined);
  const stakeReadError = homeStakeRead.error ?? awayStakeRead.error;

  return (
    <div className="mt-6 pt-4 border-t border-white/10">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        On-Chain Rewards
      </h4>
      {stakeReadsLoading ? (
        <p className="text-xs text-gray-500">
          Checking your on-chain stake on Somnia...
        </p>
      ) : stakeReadError ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs font-semibold text-red-400">Could not read your on-chain stake</p>
          <p className="mt-1 text-[10px] text-gray-400">
            {(stakeReadError as any).shortMessage ?? stakeReadError.message}
          </p>
        </div>
      ) : !claimTeam ? (
        <p className="text-xs text-gray-500">
          No active on-chain stake was found for this wallet in this match.
        </p>
      ) : !chainResult?.finalized ? (
        <div className="rounded-lg border border-gold/20 bg-gold/10 p-3">
          <div className="flex items-center gap-2">
            <FlagIcon teamId={claimTeam.id} size={24} />
            <div>
              <p className="text-xs font-semibold text-gold">On-chain finalization required</p>
              <p className="text-[10px] text-gray-400">
                Your {claimTeam.name} stake was found on-chain. Finalize the match on Somnia before claiming rewards.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlagIcon teamId={claimTeam.id} size={24} />
              <div>
                <p className="text-xs font-semibold text-gray-200">{claimTeam.name} reward claim</p>
                <p className="text-[10px] text-gray-500">
                  Stake {formatEther(claimAmount)} STT + settlement bonus {formatEther(settlementBonus)} STT
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500">Claimable</p>
              <p className="text-sm font-bold text-gold">{formatEther(rewardAmount)} STT</p>
            </div>
          </div>

          <button
            onClick={claim}
            disabled={!canClaim}
            className={`mt-3 w-full rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              canClaim
                ? "bg-gold text-black hover:bg-gold/90"
                : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isPending
              ? "Sign in wallet..."
              : isConfirming
                ? "Claiming on Somnia..."
                : alreadyClaimed
                  ? "Reward claimed"
                  : claimStatusLoading
                    ? "Checking claim status..."
                  : rewardAmount > 0n
                    ? `Claim ${formatEther(rewardAmount)} STT`
                    : "No reward to claim"}
          </button>

          {alreadyClaimed && (
            <p className="mt-2 text-center text-[10px] text-green-400">
              This reward has already been claimed on-chain.
            </p>
          )}

          {hash && (
            <a
              href={`https://shannon-explorer.somnia.network/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-center text-[10px] text-agent-blue hover:underline"
            >
              View claim tx on Somnia Explorer: {hash.slice(0, 18)}...
            </a>
          )}

          {error && (
            <p className="mt-2 text-center text-[10px] text-red-400">
              {(error as any).shortMessage ?? error.message}
            </p>
          )}

          <p className="mt-2 text-[10px] text-gray-500">
            If there is an opposing pool, 80% of the losing pool is distributed to winning supporters pro-rata.
          </p>
          <p className="mt-1 text-[10px] text-gray-500">
            If MVP liquidity is one-sided, the prefunded Reward contract pays a sponsor bonus so winning users still receive a meaningful reward.
          </p>
        </div>
      )}
    </div>
  );
}
