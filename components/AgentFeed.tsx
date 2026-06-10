"use client";

import { useEffect, useRef, useState } from "react";
import { FlagIcon } from "./FlagIcon";
import type { MatchAgentState } from "@/lib/types";

interface AgentFeedProps {
  matchId: string;
  homeTeam: { id: string; name: string; flag: string; color: string };
  awayTeam: { id: string; name: string; flag: string; color: string };
  initialAgent?: MatchAgentState | null;
}

function TeamStateCard({
  team,
  teamState,
  winRate,
  side,
}: {
  team: { id: string; name: string; flag: string; color: string };
  teamState: {
    attack: number;
    defense: number;
    midfield: number;
    momentum: number;
    supporter: number;
  };
  winRate: number;
  side: "A" | "B";
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-2 mb-2">
        <FlagIcon teamId={team.id} size={22} />
        <span className="text-xs font-semibold text-white">{team.name}</span>
        <span className="text-[10px] text-gray-500 ml-auto">
          Win: {winRate}%
        </span>
      </div>

      {/* Mini win rate bar */}
      <div className="mb-2 h-1.5 overflow-hidden rounded-sm bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${winRate}%`,
            backgroundColor: team.color,
            opacity: 0.7,
          }}
        />
      </div>

      <div className="space-y-0.5">
        <MiniBar label="Attack" value={teamState.attack} color="#ef4444" />
        <MiniBar label="Defense" value={teamState.defense} color="#3b82f6" />
        <MiniBar label="Midfield" value={teamState.midfield} color="#22c55e" />
        <MiniBar label="Momentum" value={teamState.momentum} color="#f0b90b" />
        {/* <MiniBar label="Supporter" value={teamState.supporter} color="#a855f7" /> */}
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-gray-500 w-12">{label}</span>
      <div className="h-0.5 flex-1 overflow-hidden rounded-sm bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${value}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-[8px] text-gray-500 w-5 text-right">{value}</span>
    </div>
  );
}

export function AgentFeed({
  matchId,
  homeTeam,
  awayTeam,
  initialAgent,
}: AgentFeedProps) {
  const [agent, setAgent] = useState<MatchAgentState | null>(
    initialAgent ?? null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent?.narrative.length]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}`);
        const data = await res.json();
        if (data.matchAgent) setAgent(data.matchAgent);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (!agent) {
    return (
      <div className="glass-panel p-8 text-center text-gray-500">
        <p className="text-sm">
          Match Agent will activate once the match starts.
        </p>
        <p className="text-xs mt-1 text-gray-600">
          The autonomous AI Match Agent analyzes both teams and updates
          predictions in real-time.
        </p>
      </div>
    );
  }

  const commentaries = agent.narrative.filter((msg) => msg.trim().length > 0);

  return (
    <div className="glass-panel p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                agent.source === "somnia-llm" ? "#c49b38" : "#8a96a8",
            }}
          />
          <span className="section-label text-[10px]">
            {agent.source === "somnia-llm"
              ? "Somnia LLM Active"
              : "Agent Processing"}
          </span>
        </div>
        <span className="text-[10px] text-gray-500">
          Win Prediction:{" "}
          <span className="text-white font-bold">
            {homeTeam.name} {agent.teamAWinRate}%
          </span>
          {" - "}
          <span className="text-white font-bold">
            {awayTeam.name} {agent.teamBWinRate}%
          </span>
        </span>
        <span className="text-[10px] text-gray-500 ml-auto">
          Confidence: {agent.confidence}%
        </span>
      </div>

      {/* Two team state cards */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <TeamStateCard
          team={homeTeam}
          teamState={agent.teamA}
          winRate={agent.teamAWinRate}
          side="A"
        />
        <TeamStateCard
          team={awayTeam}
          teamState={agent.teamB}
          winRate={agent.teamBWinRate}
          side="B"
        />
      </div>

      {/* Predicted score */}
      {agent.predictedScore && agent.predictedScore !== "?-?" && (
        <div className="text-center mb-4">
          <span className="text-[10px] text-gray-500">Predicted Score: </span>
          <span className="font-mono text-sm font-semibold text-white">
            {agent.predictedScore}
          </span>
        </div>
      )}

      {/* Narrative feed */}
      <div>
        <h4 className="section-label mb-2 text-[10px]">Agent Commentary</h4>
        <div
          ref={scrollRef}
          className="space-y-2 max-h-44 overflow-y-auto pr-1"
        >
          {commentaries.map((msg, i) => {
            const isSomnia = msg.startsWith("[Somnia AI]");
            const isLocalAgent = msg.startsWith("[Match Agent]");
            return (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${
                  isSomnia
                    ? "border-gold/20 bg-gold/10 text-gray-100"
                    : "border-white/10 bg-white/[0.03] text-gray-200"
                }`}
              >
                <span
                  className={`mr-1 font-mono text-[9px] font-semibold ${
                    isSomnia ? "text-gold" : "text-gray-500"
                  }`}
                >
                  {isSomnia ? "SOMNIA:" : "AGENT:"}
                </span>
                {msg
                  .replace("[Somnia AI] ", "")
                  .replace("[Match Agent] ", "")
                  .replace(isLocalAgent ? "" : /^\[[^\]]+\]\s*/, "")}
              </div>
            );
          })}
          {commentaries.length === 0 && (
            <p className="text-[10px] text-gray-600 italic">
              Waiting for Match Agent input...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
