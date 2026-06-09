"use client";

import Link from "next/link";
import { FlagIcon } from "./FlagIcon";
import type { Match } from "@/lib/types";

interface MatchCardProps {
  match: Match & {
    staking?: {
      home: { totalStaked: number; userCount: number };
      away: { totalStaked: number; userCount: number };
    };
    agents?: {
      home: { winProbability: number; confidence: number } | null;
      away: { winProbability: number; confidence: number } | null;
    };
  };
}

function StatusBadge({ status }: { status: Match["status"] }) {
  const styles = {
    upcoming: "bg-white/[0.04] text-gray-300 border-white/10",
    live: "bg-red-500/10 text-red-300 border-red-500/20",
    finished: "bg-white/[0.03] text-gray-500 border-white/10",
  };

  const labels = {
    upcoming: "Upcoming",
    live: "LIVE",
    finished: "Finished",
  };

  return (
    <span
      className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {status === "live" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
      )}
      {labels[status]}
    </span>
  );
}

export function MatchCard({ match }: MatchCardProps) {
  const homeProb = match.agents?.home?.winProbability;
  const awayProb = match.agents?.away?.winProbability;

  return (
    <Link href={`/match/${match.id}`}>
      <div className="glass-panel-hover group cursor-pointer p-5">
        {/* Status + Time */}
        <div className="flex items-center justify-between mb-4">
          <StatusBadge status={match.status} />
          <span className="text-xs text-gray-500">
            {match.status === "live"
              ? `${match.currentMinute}'`
              : match.status === "finished"
                ? "FT"
                : new Date(match.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <FlagIcon teamId={match.homeTeam.id} size={36} />
            <span className="text-sm font-medium text-gray-200">
              {match.homeTeam.name}
            </span>
          </div>

          <div className="flex flex-col items-center px-4">
            {match.status === "upcoming" ? (
              <span className="text-sm font-semibold tracking-[0.18em] text-gray-500">VS</span>
            ) : (
              <span className="font-mono text-2xl font-semibold tabular-nums text-white">
                {match.score.home} - {match.score.away}
              </span>
            )}
            {homeProb != null && awayProb != null && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                <span>{Math.round(homeProb * 100)}%</span>
                <span>-</span>
                <span>{Math.round(awayProb * 100)}%</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <FlagIcon teamId={match.awayTeam.id} size={36} />
            <span className="text-sm font-medium text-gray-200">
              {match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Staking bar */}
        {match.staking && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>
                {match.staking.home.totalStaked.toFixed(0)} staked
              </span>
              <span>
                {match.staking.away.totalStaked.toFixed(0)} staked
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-sm bg-white/[0.06]">
              {(() => {
                const total =
                  match.staking.home.totalStaked +
                  match.staking.away.totalStaked;
                const homePct =
                  total > 0
                    ? (match.staking.home.totalStaked / total) * 100
                    : 50;
                return (
                  <>
                    <div
                      className="h-full bg-agent-blue/60 transition-all duration-500"
                      style={{ width: `${homePct}%` }}
                    />
                    <div
                      className="h-full bg-agent-red/60 transition-all duration-500"
                      style={{ width: `${100 - homePct}%` }}
                    />
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Agent preview */}
        {match.agents?.home && match.agents?.away && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-agent-blue" />
              <span className="text-[10px] text-gray-500">
                AI: {Math.round(match.agents.home.winProbability * 100)}%
              </span>
            </div>
            <span className="text-[10px] text-gray-600">/</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-agent-red" />
              <span className="text-[10px] text-gray-500">
                AI: {Math.round(match.agents.away.winProbability * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
