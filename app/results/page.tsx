"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlagIcon } from "@/components/FlagIcon";
import type { MatchResult } from "@/lib/types";
import { TEAMS } from "@/lib/store";

export default function ResultsPage() {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/results")
      .then((res) => res.json())
      .then((data) => setResults(data.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalDistributed = results.reduce(
    (sum, r) =>
      sum + r.rewards.reduce((s, reward) => s + reward.rewardFromLosingPool, 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold text-white mb-3">
          Results & Rewards
        </h1>
        <p className="text-gray-400 text-sm">
          Match outcomes, supporter treasuries, and on-chain settlement distributions.
        </p>
        {totalDistributed > 0 && (
          <div className="mt-4 inline-block px-4 py-2 rounded-full bg-gold/10 border border-gold/20">
            <span className="text-xs text-gold font-bold">
              {totalDistributed.toFixed(0)} tokens distributed
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-gray-500">No results yet.</p>
          <p className="text-gray-600 text-sm mt-1">
            Start and complete matches to see results here.
          </p>
          <Link href="/" className="mt-4 inline-block btn-primary text-sm">
            Go to Matches
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {results.map((result) => {
            // Look up match info from store or use IDs
            const [homeTeam, awayTeam] = [TEAMS.brazil, TEAMS.england];

            return (
              <div key={result.matchId} className="glass-panel p-6">
                {/* Match header */}
                <div className="flex items-center justify-between mb-6">
                  <Link
                    href={`/match/${result.matchId}`}
                    className="text-sm text-gray-400 hover:text-gold transition-colors"
                  >
                    Match #{result.matchId}
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    Finished
                  </span>
                </div>

                {/* Score */}
                <div className="mx-auto mb-6 grid max-w-xl grid-cols-[1fr_10rem_1fr] items-start gap-6">
                  <div className="text-center">
                    <FlagIcon teamId={homeTeam.id} size={40} />
                    <div className="text-sm text-gray-300 mt-1">
                      {homeTeam.name}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-3xl font-bold tabular-nums text-white">
                      {result.homeScore} - {result.awayScore}
                    </div>
                    {result.winner && (
                      <div className="text-xs text-gold text-center mt-1">
                        Agent settled for {result.winner === homeTeam.id
                          ? homeTeam.name
                          : awayTeam.name}
                      </div>
                    )}
                    {!result.winner && (
                      <div className="text-xs text-gray-500 text-center mt-1">
                        Agent predicted draw
                      </div>
                    )}
                    {result.actualHomeScore !== undefined && result.actualAwayScore !== undefined && (
                      <div className="text-[10px] text-gray-600 text-center mt-1">
                        Sim FT: {result.actualHomeScore}-{result.actualAwayScore}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <FlagIcon teamId={awayTeam.id} size={40} />
                    <div className="text-sm text-gray-300 mt-1">
                      {awayTeam.name}
                    </div>
                  </div>
                </div>

                {/* Pool info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">
                      <FlagIcon teamId={homeTeam.id} size={16} /> {homeTeam.name} Pool
                    </div>
                    <div className="text-xl font-bold text-agent-blue">{result.homePool.toFixed(3)} STT</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">
                      <FlagIcon teamId={awayTeam.id} size={16} /> {awayTeam.name} Pool
                    </div>
                    <div className="text-xl font-bold text-agent-red">{result.awayPool.toFixed(3)} STT</div>
                  </div>
                </div>

                {/* Rewards */}
                {result.rewards.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Reward Payouts ({result.rewards.length} stakers)
                    </h4>
                    <div className="space-y-2">
                      {result.rewards.slice(0, 5).map((r, i) => {
                        const team =
                          r.teamId === homeTeam.id ? homeTeam : awayTeam;
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">
                                {r.userId.slice(0, 10)}...
                              </span>
                              <span>
                                <FlagIcon teamId={team.id} size={16} />
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-gray-500">Stake: {r.stakeAmount.toFixed(3)}</span>
                              <span className="text-gray-500">Share: {r.poolShare.toFixed(1)}%</span>
                              <span className="text-green-400">+{r.rewardFromLosingPool.toFixed(3)}</span>
                              <span className="font-bold text-gold">{r.totalReturned.toFixed(3)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {result.rewards.length > 5 && (
                        <div className="text-center text-xs text-gray-600 py-1">
                          +{result.rewards.length - 5} more payouts
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
