"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { FlagIcon } from "./FlagIcon";
import { StrategyPanel } from "./StrategyPanel";
import { MAX_STAKE_PER_USER_PER_MATCH_STT, useStake, useUserStake, useMatchTotalStaked, useUserTeamChoice } from "@/lib/hooks";

interface StakingPanelProps {
  matchId: string;
  homeTeam: { id: string; name: string; flag: string };
  awayTeam: { id: string; name: string; flag: string };
  matchStatus: string;
  onStakeSuccess: () => void;
}

export function StakingPanel({
  matchId,
  homeTeam,
  awayTeam,
  matchStatus,
  onStakeSuccess,
}: StakingPanelProps) {
  const { isConnected, address } = useAccount();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const { stake, hash, isPending, isConfirming, isSuccess, error, amount, setAmount } =
    useStake(matchId, selectedTeam ?? homeTeam.id);

  // Read on-chain staking pools
  const { homeRaw, awayRaw } = useMatchTotalStaked(matchId, homeTeam.id, awayTeam.id);
  const homePool = { totalStaked: Number(formatEther(homeRaw)), userCount: 0 };
  const awayPool = { totalStaked: Number(formatEther(awayRaw)), userCount: 0 };
  const totalPool = homePool.totalStaked + awayPool.totalStaked;

  // Check user's existing on-chain stake for both teams
  const homeUserStake = useUserStake(matchId, homeTeam.id);
  const awayUserStake = useUserStake(matchId, awayTeam.id);
  const getStakeAmount = (stake: any): bigint => stake?.amount ?? stake?.[0] ?? 0n;
  const homeStakedAmount = getStakeAmount(homeUserStake);
  const awayStakedAmount = getStakeAmount(awayUserStake);

  // Lock only when the connected wallet has an active stake in this match.
  // A stale on-chain userTeamChoice without stake should not block team selection.
  const { isLoading: choiceLoading } = useUserTeamChoice(matchId);
  const lockedTeam =
    homeStakedAmount > 0n ? homeTeam.id : awayStakedAmount > 0n ? awayTeam.id : null;
  const lockedTeamName = lockedTeam === homeTeam.id ? homeTeam.name : lockedTeam === awayTeam.id ? awayTeam.name : null;

  const canStake = matchStatus !== "finished";
  const blockingOtherTeam = lockedTeam != null && selectedTeam != null && selectedTeam !== lockedTeam;
  const stakeDataLoaded = !choiceLoading && homeUserStake !== undefined && awayUserStake !== undefined;
  const enteredAmount = parseFloat(amount);
  const currentTeamStake = selectedTeam === homeTeam.id ? homeStakedAmount : selectedTeam === awayTeam.id ? awayStakedAmount : 0n;
  const currentTeamStakeStt = Number(formatEther(currentTeamStake));
  const exceedsStakeCap =
    selectedTeam != null &&
    !Number.isNaN(enteredAmount) &&
    currentTeamStakeStt + enteredAmount > MAX_STAKE_PER_USER_PER_MATCH_STT;

  // If user already committed to a team, auto-select it immediately
  useEffect(() => {
    if (lockedTeam) {
      setSelectedTeam(lockedTeam);
    }
  }, [lockedTeam]);

  // Sync on-chain stake to server-side store after success
  const syncedRef = useRef(false);
  useEffect(() => {
    if (isSuccess && hash && !syncedRef.current) {
      syncedRef.current = true;
      fetch("/api/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": address ?? "" },
        body: JSON.stringify({
          matchId,
          teamId: selectedTeam,
          amount: parseFloat(amount),
        }),
      }).catch(() => {});
      onStakeSuccess();
    }
  }, [isSuccess, hash]);

  // Reset sync flag when starting new tx
  useEffect(() => {
    if (isPending) syncedRef.current = false;
  }, [isPending]);

  const handleStake = () => {
    if (!selectedTeam || !isConnected || blockingOtherTeam || exceedsStakeCap) return;
    stake();
  };

  const handleSelectTeam = (teamId: string) => {
    if (lockedTeam && lockedTeam !== teamId) return; // Block selecting other team
    setSelectedTeam(teamId);
  };

  return (
    <div className="glass-panel p-5">
      <h3 className="section-label mb-4">
        Stake on Somnia Testnet
      </h3>

      {!isConnected && (
        <div className="mb-4 rounded-md border border-gold/20 bg-gold/10 p-4 text-center">
          <p className="text-sm text-gold mb-2">Connect your wallet to stake</p>
          <p className="text-xs text-gray-400">
            Stake STT tokens on Somnia Testnet to support your team
          </p>
        </div>
      )}

      {isConnected && (
        <div className="mb-3 rounded-md border border-white/10 bg-white/[0.03] p-2 text-center">
          <p className="text-[10px] text-gray-400">
            <a
              href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gold hover:text-[#d4af45]"
            >
              Somnia Faucet
            </a>
          </p>
        </div>
      )}

      {/* One-team-per-match warning */}
      {lockedTeam && lockedTeamName && (
        <div className="mb-3 rounded-md border border-gold/20 bg-gold/10 p-2 text-center">
          <p className="text-[10px] text-gold">
            You are supporting <strong>{lockedTeamName}</strong> in this match.
            Each match allows staking on one team only.
          </p>
        </div>
      )}

      {blockingOtherTeam && (
        <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-center">
          <p className="text-[10px] text-red-400">
            Cannot switch teams because you already staked on {lockedTeamName}.
          </p>
        </div>
      )}

      {!canStake && (
        <div className="mb-4 rounded-md border border-white/10 bg-white/[0.04] p-3 text-center text-xs text-gray-400">
          This match has finished. Staking is closed.
        </div>
      )}

      {/* Team selection */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => handleSelectTeam(homeTeam.id)}
          disabled={!canStake || !isConnected || (!!lockedTeam && lockedTeam !== homeTeam.id)}
          className={`rounded-md border p-3 text-center transition-colors duration-200 ${
            selectedTeam === homeTeam.id
              ? "border-agent-blue/50 bg-agent-blue/10"
              : (lockedTeam && lockedTeam !== homeTeam.id)
                ? "border-white/5 bg-white/[0.01] opacity-40"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
          } ${!canStake || !isConnected || (!!lockedTeam && lockedTeam !== homeTeam.id) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="mb-1 flex justify-center"><FlagIcon teamId={homeTeam.id} size={32} /></div>
          <div className="text-xs font-medium text-gray-300">{homeTeam.name}</div>
          <div className="text-[10px] text-gray-500 mt-1">
            {homePool.totalStaked.toFixed(3)} STT staked
          </div>
          {homeStakedAmount > 0n && (
            <div className="text-[10px] text-green-400 mt-0.5">Your stake: {formatEther(homeStakedAmount)} STT</div>
          )}
          {totalPool > 0 && (
            <div className="text-[10px] text-gray-600">
              {Math.round((homePool.totalStaked / totalPool) * 100)}% of pool
            </div>
          )}
        </button>

        <button
          onClick={() => handleSelectTeam(awayTeam.id)}
          disabled={!canStake || !isConnected || (!!lockedTeam && lockedTeam !== awayTeam.id)}
          className={`rounded-md border p-3 text-center transition-colors duration-200 ${
            selectedTeam === awayTeam.id
              ? "border-agent-red/50 bg-agent-red/10"
              : (lockedTeam && lockedTeam !== awayTeam.id)
                ? "border-white/5 bg-white/[0.01] opacity-40"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
          } ${!canStake || !isConnected || (!!lockedTeam && lockedTeam !== awayTeam.id) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="mb-1 flex justify-center"><FlagIcon teamId={awayTeam.id} size={32} /></div>
          <div className="text-xs font-medium text-gray-300">{awayTeam.name}</div>
          <div className="text-[10px] text-gray-500 mt-1">
            {awayPool.totalStaked.toFixed(3)} STT staked
          </div>
          {awayStakedAmount > 0n && (
            <div className="text-[10px] text-green-400 mt-0.5">Your stake: {formatEther(awayStakedAmount)} STT</div>
          )}
          {totalPool > 0 && (
            <div className="text-[10px] text-gray-600">
              {Math.round((awayPool.totalStaked / totalPool) * 100)}% of pool
            </div>
          )}
        </button>
      </div>

      {/* Strategy panels, one per team, enabled when team is selected */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StrategyPanel
            matchId={matchId}
            teamId={homeTeam.id}
            teamName={homeTeam.name}
            teamFlag={homeTeam.flag}
            matchStatus={matchStatus}
            disabled={selectedTeam !== homeTeam.id}
            disabledReason={selectedTeam !== homeTeam.id ? "Select Brazil above to set strategy" : undefined}
            userId={address ?? "anonymous"}
          />
          <StrategyPanel
            matchId={matchId}
            teamId={awayTeam.id}
            teamName={awayTeam.name}
            teamFlag={awayTeam.flag}
            matchStatus={matchStatus}
            disabled={selectedTeam !== awayTeam.id}
            disabledReason={selectedTeam !== awayTeam.id ? "Select England above to set strategy" : undefined}
            userId={address ?? "anonymous"}
          />
        </div>
      )}

      {/* Amount input */}
      {canStake && selectedTeam && (
      <div className="mb-4">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
          Amount (STT)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!canStake || !isConnected}
            className="input-field flex-1"
            placeholder="0.001"
          />
          <button
            onClick={() => setAmount("0.005")}
            disabled={!canStake || !isConnected}
            className="btn-secondary px-3 py-2"
          >
            0.005
          </button>
          <button
            onClick={() => setAmount("0.01")}
            disabled={!canStake || !isConnected}
            className="btn-secondary px-3 py-2"
          >
            0.01
          </button>
        </div>
        <p className={`mt-1 text-[10px] ${exceedsStakeCap ? "text-red-400" : "text-gray-500"}`}>
          Max {MAX_STAKE_PER_USER_PER_MATCH_STT.toFixed(2)} STT per wallet per match.
        </p>
      </div>
      )}

      {/* Stake button */}
      {canStake && (
        <button
          onClick={handleStake}
          disabled={!selectedTeam || !isConnected || !stakeDataLoaded || isPending || isConfirming || blockingOtherTeam || exceedsStakeCap}
          className="btn-primary w-full"
        >
          {!isConnected
            ? "Connect wallet to stake"
            : !stakeDataLoaded
              ? "Loading on-chain data..."
              : blockingOtherTeam
                ? `${lockedTeamName} locked, add to your existing stake`
                : exceedsStakeCap
                  ? `Max ${MAX_STAKE_PER_USER_PER_MATCH_STT.toFixed(2)} STT per match`
                  : isPending || isConfirming
                    ? isConfirming
                      ? "Confirming on Somnia..."
                      : "Sign in wallet..."
                    : selectedTeam
                      ? `Stake ${amount} STT on ${
                          selectedTeam === homeTeam.id ? homeTeam.name : awayTeam.name
                        }`
                      : "Select a team to stake"}
        </button>
      )}

      {/* Transaction status */}
      {hash && (
        <div className="mt-3 rounded-md border border-agent-blue/20 bg-agent-blue/10 p-2 text-center text-xs">
          <a
            href={`https://shannon-explorer.somnia.network/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-agent-blue hover:underline"
          >
            View tx on Somnia Explorer
          </a>
          {isConfirming && (
            <p className="text-gray-400 mt-1">Waiting for confirmation...</p>
          )}
          {isSuccess && (
            <p className="text-green-400 mt-1">Staked successfully on Somnia Testnet!</p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-center text-xs text-red-400">
          {typeof error === "string" ? error : (error as any).message?.includes("User rejected")
            ? "Transaction rejected in wallet"
            : (error as any).message?.slice(0, 150) ?? String(error)}
        </div>
      )}

      {/* Reward info */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <h4 className="section-label mb-2 text-[10px]">
          On-Chain Settlement Model
        </h4>
        <div className="space-y-1.5 text-[10px] text-gray-500">
          <div className="flex justify-between">
            <span>Winning supporters keep stake</span>
            <span className="text-green-400">100%</span>
          </div>
          <div className="flex justify-between">
            <span>Losing pool or sponsor bonus</span>
            <span className="text-green-400">80%</span>
          </div>
          <div className="flex justify-between">
            <span>Distribution rule</span>
            <span className="text-green-400">Pro-rata / MVP bonus</span>
          </div>
          <div className="flex justify-between font-bold text-gray-400 pt-1 border-t border-white/5">
            <span>One team per match</span>
            <span className="text-gold">Enforced on-chain</span>
          </div>
        </div>
      </div>
    </div>
  );
}
