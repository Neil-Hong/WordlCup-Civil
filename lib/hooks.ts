"use client";

import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { TeamVaultABI, PredictionABI, RewardABI, CONTRACTS, TEAM_IDS, MATCH_IDS } from "./contracts";
import { useState, useEffect } from "react";

export const MAX_STAKE_PER_USER_PER_MATCH_STT = 0.01;

// ── Staking Hooks ──

export function useStake(matchId: string, teamId: string) {
  const { address } = useAccount();
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const numericTeamId = TEAM_IDS[teamId] ?? 1;
  const [amount, setAmount] = useState("0.001");

  const { writeContract, data: hash, isPending, error: wagmiError } = useWriteContract();
  const [localError, setLocalError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const error = localError || (wagmiError ? (wagmiError as any).shortMessage || wagmiError.message : null);

  const stake = () => {
    if (!address) return;
    setLocalError(null);
    // Validate amount
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setLocalError("Invalid stake amount. Must be > 0 STT.");
      return;
    }
    if (val > MAX_STAKE_PER_USER_PER_MATCH_STT) {
      setLocalError(`Max stake is ${MAX_STAKE_PER_USER_PER_MATCH_STT} STT per user per match.`);
      return;
    }
    // Validate team
    if (!TEAM_IDS[teamId]) {
      setLocalError(`Unknown team: ${teamId}`);
      return;
    }
    writeContract({
      address: CONTRACTS.teamVault,
      abi: TeamVaultABI,
      functionName: "stake",
      args: [BigInt(numericTeamId), BigInt(numericMatchId)],
      value: parseEther(amount),
    });
  };

  return { stake, hash, isPending, isConfirming, isSuccess, error, amount, setAmount };
}

export function useMatchTotalStaked(matchId: string, homeTeamId: string, awayTeamId: string) {
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const homeNumeric = TEAM_IDS[homeTeamId] ?? 1;
  const awayNumeric = TEAM_IDS[awayTeamId] ?? 2;

  const { data: homeData } = useReadContract({
    address: CONTRACTS.teamVault,
    abi: TeamVaultABI,
    functionName: "matchTeamStaked",
    args: [BigInt(numericMatchId), BigInt(homeNumeric)],
    query: { refetchInterval: 5000 },
  });

  const { data: awayData } = useReadContract({
    address: CONTRACTS.teamVault,
    abi: TeamVaultABI,
    functionName: "matchTeamStaked",
    args: [BigInt(numericMatchId), BigInt(awayNumeric)],
    query: { refetchInterval: 5000 },
  });

  return {
    homeStaked: homeData ? formatEther(homeData as bigint) : "0",
    awayStaked: awayData ? formatEther(awayData as bigint) : "0",
    homeRaw: (homeData as bigint) ?? 0n,
    awayRaw: (awayData as bigint) ?? 0n,
  };
}

export function useUserStake(matchId: string, teamId: string) {
  return useUserStakeRead(matchId, teamId).data;
}

export function useUserStakeRead(matchId: string, teamId: string) {
  const { address } = useAccount();
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const numericTeamId = TEAM_IDS[teamId] ?? 1;

  const read = useReadContract({
    address: CONTRACTS.teamVault,
    abi: TeamVaultABI,
    functionName: "getUserStake",
    args: [address ?? "0x0000000000000000000000000000000000000000", BigInt(numericMatchId), BigInt(numericTeamId)],
    query: { refetchInterval: 5000, enabled: !!address },
  });

  return {
    ...read,
    data: read.data as [bigint, bigint, bigint] | undefined,
  };
}

// Check which team the user is locked to (persistent on-chain, never cleared)
export function useUserTeamChoice(matchId: string) {
  const { address } = useAccount();
  const numericMatchId = MATCH_IDS[matchId] ?? 1;

  const { data, isLoading } = useReadContract({
    address: CONTRACTS.teamVault,
    abi: TeamVaultABI,
    functionName: "userTeamChoice",
    args: [BigInt(numericMatchId), address ?? "0x0000000000000000000000000000000000000000"],
    query: { refetchInterval: 5000, enabled: !!address },
  });

  const choice = data as bigint | undefined;
  // Find team id string from numeric id
  const teamId = choice && choice > 0n
    ? Object.entries(TEAM_IDS).find(([, v]) => v === Number(choice))?.[0] ?? null
    : null;

  return { teamChoice: teamId, isLoading };
}

// ── Prediction Hooks ──

export function useMatchResult(matchId: string) {
  const numericMatchId = MATCH_IDS[matchId] ?? 1;

  const { data } = useReadContract({
    address: CONTRACTS.prediction,
    abi: PredictionABI,
    functionName: "results",
    args: [BigInt(numericMatchId)],
    query: { refetchInterval: 5000 },
  });

  if (!data) return null;
  const result = data as unknown as [number, number, number, boolean];
  const [homeScore, awayScore, winner, finalized] = result;
  return finalized ? { homeScore, awayScore, winner, finalized } : null;
}

// ── Reward Hooks ──

export function useCalculateReward(matchId: string, teamId: string, enabled = true) {
  const { address } = useAccount();
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const numericTeamId = TEAM_IDS[teamId] ?? 1;

  const { data } = useReadContract({
    address: CONTRACTS.reward,
    abi: RewardABI,
    functionName: "calculateReward",
    args: [address ?? "0x0000000000000000000000000000000000000000", BigInt(numericMatchId), BigInt(numericTeamId)],
    query: { refetchInterval: 5000, enabled: !!address && enabled },
  });

  return data as [reward: bigint, stakeReturned: bigint, settlementBonus: bigint, redistributionBps: bigint] | undefined;
}

export function useRewardClaimed(matchId: string, teamId: string, enabled = true) {
  const { address } = useAccount();
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const numericTeamId = TEAM_IDS[teamId] ?? 1;

  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.reward,
    abi: RewardABI,
    functionName: "claimed",
    args: [BigInt(numericMatchId), address ?? "0x0000000000000000000000000000000000000000", BigInt(numericTeamId)],
    query: { refetchInterval: 5000, enabled: !!address && enabled },
  });

  return { claimed: data as boolean | undefined, isLoading, error };
}

export function useRewardBalance() {
  return useBalance({
    address: CONTRACTS.reward,
    query: { refetchInterval: 5000 },
  });
}

export function useClaimReward(matchId: string, teamId: string) {
  const numericMatchId = MATCH_IDS[matchId] ?? 1;
  const numericTeamId = TEAM_IDS[teamId] ?? 1;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = () => {
    writeContract({
      address: CONTRACTS.reward,
      abi: RewardABI,
      functionName: "claimReward",
      args: [BigInt(numericMatchId), BigInt(numericTeamId)],
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}
