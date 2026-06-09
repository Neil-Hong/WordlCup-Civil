"use client";

import { FlagIcon } from "./FlagIcon";
import type { Match, MatchEvent } from "@/lib/types";

interface LiveMatchPanelProps {
  match: Match;
  events: MatchEvent[];
}

function EventIcon({ type }: { type: MatchEvent["type"] }) {
  const labels: Record<string, string> = {
    goal: "GOAL",
    red_card: "RED",
    yellow_card: "YC",
    halftime: "HT",
    fulltime: "FT",
    kickoff: "KO",
    time_update: "TIME",
  };

  return (
    <span className="w-10 shrink-0 rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold text-gray-400">
      {labels[type] ?? "EVT"}
    </span>
  );
}

export function LiveMatchPanel({ match, events }: LiveMatchPanelProps) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <div className="glass-panel p-6">
      <div className="mb-5 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              LIVE
            </span>
          )}
          <span className="text-sm text-gray-400">
            {isFinished ? "Full Time" : isLive ? `${match.currentMinute}'` : "Upcoming"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-1 flex-col items-center gap-2">
            <FlagIcon teamId={match.homeTeam.id} size={56} />
            <span className="text-lg font-semibold text-white">{match.homeTeam.name}</span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span className="text-5xl font-semibold tabular-nums text-white">
              {match.score.home}
            </span>
            <span className="text-3xl text-gray-600">-</span>
            <span className="text-5xl font-semibold tabular-nums text-white">
              {match.score.away}
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center gap-2">
            <FlagIcon teamId={match.awayTeam.id} size={56} />
            <span className="text-lg font-semibold text-white">{match.awayTeam.name}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="section-label mb-3">Match Events</h3>
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {events.length === 0 && (
            <p className="text-sm text-gray-600 italic">
              {match.status === "upcoming" ? "Match has not started yet." : "No events recorded."}
            </p>
          )}
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                event.type === "goal"
                  ? "border border-gold/20 bg-gold/10"
                  : event.type === "red_card"
                    ? "border border-red-500/20 bg-red-500/10"
                    : event.type === "fulltime"
                      ? "border border-white/10 bg-white/[0.04]"
                      : "hover:bg-white/[0.03]"
              }`}
            >
              <EventIcon type={event.type} />
              <span className="w-10 font-mono text-xs tabular-nums text-gray-500">
                {event.minute}&apos;
              </span>
              <span className={`flex-1 ${event.type === "goal" ? "font-medium text-gold" : "text-gray-300"}`}>
                {event.description}
              </span>
              {event.side !== "neutral" && (
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-xs ${
                    event.side === "home"
                      ? "bg-agent-blue/15 text-agent-blue"
                      : "bg-agent-red/15 text-agent-red"
                  }`}
                >
                  <FlagIcon
                    teamId={event.side === "home" ? match.homeTeam.id : match.awayTeam.id}
                    size={14}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
