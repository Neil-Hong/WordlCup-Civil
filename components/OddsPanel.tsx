"use client";

import { FlagIcon } from "./FlagIcon";
import { useMatchTotalStaked } from "@/lib/hooks";

interface OddsPanelProps {
  matchId: string;
  homeTeam: { id: string; name: string; flag: string; color: string };
  awayTeam: { id: string; name: string; flag: string; color: string };
  homeWinRate: number;
  awayWinRate: number;
}

function ProbabilityBar({
  label,
  probability,
  color,
  staked,
  total,
}: {
  label: string;
  probability: number;
  color: string;
  staked: number;
  total: number;
}) {
  const stakePct = total > 0 ? (staked / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className="text-lg font-bold text-white">
          {Math.round(probability * 100)}%
        </span>
      </div>

      {/* AI Probability */}
      <div className="h-2 overflow-hidden rounded-sm bg-white/[0.06]">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${probability * 100}%`, backgroundColor: color }}
        />
      </div>

      {/* Stake distribution */}
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>AI Agent prediction</span>
        <span>{(staked || 0).toFixed(0)} tokens staked</span>
      </div>
    </div>
  );
}

export function OddsPanel({
  matchId,
  homeTeam,
  awayTeam,
  homeWinRate,
  awayWinRate,
}: OddsPanelProps) {
  const { homeStaked, awayStaked, homeRaw, awayRaw } = useMatchTotalStaked(
    matchId, homeTeam.id, awayTeam.id
  );
  const homePoolNum = parseFloat(homeStaked) || 0;
  const awayPoolNum = parseFloat(awayStaked) || 0;
  const totalPool = homePoolNum + awayPoolNum;

  const homeProb = homeWinRate / 100;
  const awayProb = awayWinRate / 100;
  const marketHomeProb = totalPool > 0 ? homePoolNum / totalPool : 0.5;
  const marketAwayProb = totalPool > 0 ? awayPoolNum / totalPool : 0.5;

  return (
    <div className="glass-panel p-5">
      <h3 className="section-label mb-4">
        Prediction Market
      </h3>

      {/* Home team */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FlagIcon teamId={homeTeam.id} size={28} />
          <span className="text-sm font-bold text-white">
            {homeTeam.name}
          </span>
        </div>
        <ProbabilityBar
          label="AI Win Probability"
          probability={homeProb}
          color={homeTeam.color}
          staked={homePoolNum}
          total={totalPool}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-600">VS</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Away team */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FlagIcon teamId={awayTeam.id} size={28} />
          <span className="text-sm font-bold text-white">
            {awayTeam.name}
          </span>
        </div>
        <ProbabilityBar
          label="AI Win Probability"
          probability={awayProb}
          color={awayTeam.color}
          staked={awayPoolNum}
          total={totalPool}
        />
      </div>

      {/* Market vs AI comparison */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <h4 className="section-label mb-2 text-[10px]">
          Market vs AI Divergence
        </h4>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-md bg-white/[0.03] p-2">
            <div className="text-[10px] text-gray-500 mb-0.5">
              {homeTeam.name}
            </div>
            <div className="text-xs">
              <span className="text-agent-blue">
                AI: {Math.round(homeProb * 100)}%
              </span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-gray-400">
                Mkt: {Math.round(marketHomeProb * 100)}%
              </span>
            </div>
          </div>
          <div className="rounded-md bg-white/[0.03] p-2">
            <div className="text-[10px] text-gray-500 mb-0.5">
              {awayTeam.name}
            </div>
            <div className="text-xs">
              <span className="text-agent-red">
                AI: {Math.round(awayProb * 100)}%
              </span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-gray-400">
                Mkt: {Math.round(marketAwayProb * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
