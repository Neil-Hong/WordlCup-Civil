"use client";

import { useState, useEffect } from "react";
import { STRATEGY_CONFIGS } from "@/lib/types";
import type { StrategyType } from "@/lib/types";

interface StrategyPanelProps {
  matchId: string;
  teamId: string;
  teamName: string;
  teamFlag: string;
  matchStatus: string;
  disabled?: boolean;
  disabledReason?: string;
  userId: string;
}

export function StrategyPanel({
  matchId,
  teamId,
  teamName,
  teamFlag,
  matchStatus,
  disabled = false,
  disabledReason,
  userId,
}: StrategyPanelProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing strategy on mount
  useEffect(() => {
    if (disabled) return;
    (async () => {
      try {
        const res = await fetch(`/api/strategy?matchId=${matchId}&userId=${userId}`);
        const data = await res.json();
        const s = teamId === data?.home?.teamId ? data.home : data?.away?.teamId === teamId ? data.away : null;
        if (s) {
          setSelectedStrategy(s.strategy);
          setSaved(true);
        }
      } catch {}
    })();
  }, [matchId, teamId, userId, disabled]);

  const handleSelect = (type: StrategyType) => {
    if (saving || disabled) return;
    setSelectedStrategy(type);
    setSaved(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedStrategy || saving || disabled) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, teamId, strategy: selectedStrategy, userId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSaved(true);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (matchStatus === "finished") return null;

  const strategyEntries = Object.entries(STRATEGY_CONFIGS) as [StrategyType, (typeof STRATEGY_CONFIGS)[StrategyType]][];

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{teamFlag}</span>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {teamName} Supporter Strategy
        </h4>
      </div>

      {disabled && disabledReason && (
        <p className="text-[10px] text-gray-500 mb-2 italic">{disabledReason}</p>
      )}
      {!disabled && (
        <p className="text-[10px] text-gray-500 mb-2">
          Your stake-weighted preference is capped at 10%. The Match Agent may accept, soften, or ignore it.
        </p>
      )}

      <div className="grid grid-cols-1 gap-1">
        {strategyEntries.map(([type, cfg]) => {
          const isSelected = selectedStrategy === type;
          const signal =
            cfg.affects === "attack"
              ? "Attack signal"
              : cfg.affects === "defense"
                ? "Defense signal"
                : "Midfield signal";

          return (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              disabled={saving || disabled}
              className={`text-left px-2.5 py-1.5 rounded text-[10px] transition-all border ${
                disabled ? "opacity-40 cursor-not-allowed" : ""
              } ${
                isSelected
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : disabled
                    ? "border-white/5 bg-white/[0.01] text-gray-600"
                    : "border-white/5 bg-white/[0.02] text-gray-400 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{cfg.label}</span>
                <span className="text-[8px] text-gray-500">{signal}</span>
              </div>
            </button>
          );
        })}
      </div>

      {!disabled && (
        <div className="mt-2 flex items-center justify-between">
          <div>
            {saved && <span className="text-[9px] text-green-400">Applied</span>}
            {error && <span className="text-[9px] text-red-400">{error}</span>}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!selectedStrategy || saving || saved}
            className={`text-[9px] px-3 py-1 rounded font-semibold transition-all ${
              !selectedStrategy || saved
                ? "bg-white/5 text-gray-600 cursor-not-allowed"
                : "bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30"
            }`}
          >
            {saving ? "..." : saved ? "Done" : "Apply"}
          </button>
        </div>
      )}
    </div>
  );
}
