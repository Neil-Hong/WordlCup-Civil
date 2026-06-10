"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";

interface MatchData {
  id: string;
  homeTeam: { id: string; name: string; flag: string; shortName: string; color: string };
  awayTeam: { id: string; name: string; flag: string; shortName: string; color: string };
  status: "upcoming" | "live" | "finished";
  score: { home: number; away: number };
  currentMinute: number;
  startTime: number;
  events: any[];
  staking: {
    home: { totalStaked: number; userCount: number };
    away: { totalStaked: number; userCount: number };
  };
  agents: {
    home: { winProbability: number; confidence: number } | null;
    away: { winProbability: number; confidence: number } | null;
  };
  result: {
    homeScore: number;
    awayScore: number;
    winner: string | null;
    actualHomeScore?: number;
    actualAwayScore?: number;
  } | null;
}

export default function HomePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  const handleStartMatch = async (matchId: string) => {
    setStarting(matchId);
    try {
      await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", matchId }),
      }).then(async (res) => {
        const data = await res.json();
        if (data.matchId) router.push(`/match/${data.matchId}`);
      });
      await fetchMatches();
    } catch {
      // ignore
    } finally {
      setStarting(null);
    }
  };

  const handleReset = async () => {
    await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await fetchMatches();
  };

  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  const finishedMatches = matches.filter((m) => m.status === "finished");

  return (
    <div>
      <div className="grid gap-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <div>
          <p className="section-label mb-3">Somnia Testnet MVP</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          <span className="text-gold">Agent-settled</span>{" "}
          football prediction market
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
          A single autonomous Match Agent analyzes live football matches in real-time on{" "}
          <span className="text-gold font-medium">Somnia Network</span>.
          Connect your wallet, stake STT tokens, and express supporter strategy signals.
          Users influence the agent, but the agent keeps final authority.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-medium text-gold">
            Somnia Testnet
          </span>
          <span className="text-[10px] text-gray-500">
            Chain ID: 50312
          </span>
        </div>
        </div>
        <div className="flex justify-start md:justify-end">
          <button
            onClick={handleReset}
            className="btn-secondary"
          >
            Reset Local View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Live matches */}
          {liveMatches.length > 0 && (
            <section>
              <h2 className="section-label mb-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Live Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming matches */}
          {upcomingMatches.length > 0 && (
            <section>
              <h2 className="section-label mb-4">
                Upcoming Matches
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingMatches.map((match) => (
                  <div key={match.id}>
                    <MatchCard match={match} />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleStartMatch(match.id);
                      }}
                      disabled={starting === match.id}
                      className="mt-3 w-full btn-primary px-4 py-2 text-xs"
                    >
                      {starting === match.id ? "Starting..." : "Start New Demo"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Finished matches */}
          {finishedMatches.length > 0 && (
            <section>
              <h2 className="section-label mb-4">
                Recent Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                {finishedMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          )}

          {matches.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500">No matches available.</p>
              <button
                onClick={handleReset}
                className="mt-4 btn-primary text-sm"
              >
                Initialize Matches
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
