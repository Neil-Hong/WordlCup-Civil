"use client";

interface FlagIconProps {
  teamId: string;
  size?: number;
  className?: string;
}

function BrazilFlag({ size }: { size: number }) {
  const width = size;
  const height = Math.round(size * 0.68);
  return (
    <span
      className="relative inline-block overflow-hidden rounded shadow-sm bg-[#009c3b]"
      style={{ width, height }}
      aria-label="Brazil flag"
      role="img"
    >
      <span
        className="absolute left-1/2 top-1/2 block bg-[#ffdf00]"
        style={{
          width: width * 0.56,
          height: width * 0.56,
          transform: "translate(-50%, -50%) rotate(45deg)",
        }}
      />
      <span
        className="absolute left-1/2 top-1/2 block rounded-full bg-[#002776]"
        style={{
          width: width * 0.3,
          height: width * 0.3,
          transform: "translate(-50%, -50%)",
        }}
      />
    </span>
  );
}

function EnglandFlag({ size }: { size: number }) {
  const width = size;
  const height = Math.round(size * 0.68);
  return (
    <span
      className="relative inline-block overflow-hidden rounded shadow-sm bg-white"
      style={{ width, height }}
      aria-label="England flag"
      role="img"
    >
      <span
        className="absolute left-0 top-1/2 block w-full bg-[#cf081f]"
        style={{ height: Math.max(2, height * 0.18), transform: "translateY(-50%)" }}
      />
      <span
        className="absolute left-1/2 top-0 block h-full bg-[#cf081f]"
        style={{ width: Math.max(2, width * 0.14), transform: "translateX(-50%)" }}
      />
    </span>
  );
}

function TricolorFlag({
  size,
  colors,
  vertical = true,
  label,
}: {
  size: number;
  colors: string[];
  vertical?: boolean;
  label: string;
}) {
  const width = size;
  const height = Math.round(size * 0.68);
  return (
    <span
      className={`inline-flex overflow-hidden rounded shadow-sm ${vertical ? "flex-row" : "flex-col"}`}
      style={{ width, height }}
      aria-label={label}
      role="img"
    >
      {colors.map((color) => (
        <span key={color} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

export function FlagIcon({ teamId, size = 40, className = "" }: FlagIconProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: Math.round(size * 0.68) }}>
      {teamId === "brazil" ? (
        <BrazilFlag size={size} />
      ) : teamId === "england" ? (
        <EnglandFlag size={size} />
      ) : teamId === "argentina" ? (
        <TricolorFlag size={size} colors={["#75aadb", "#ffffff", "#75aadb"]} vertical={false} label="Argentina flag" />
      ) : teamId === "france" ? (
        <TricolorFlag size={size} colors={["#0055a4", "#ffffff", "#ef4135"]} label="France flag" />
      ) : teamId === "germany" ? (
        <TricolorFlag size={size} colors={["#000000", "#dd0000", "#ffce00"]} vertical={false} label="Germany flag" />
      ) : teamId === "spain" ? (
        <TricolorFlag size={size} colors={["#aa151b", "#f1bf00", "#aa151b"]} vertical={false} label="Spain flag" />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded bg-white/10 text-[10px] font-bold text-gray-300"
          style={{ width: size, height: Math.round(size * 0.68) }}
        >
          {teamId.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function getCountryCode(teamId: string): string {
  const codes: Record<string, string> = {
    argentina: "ar",
    france: "fr",
    brazil: "br",
    england: "gb",
    germany: "de",
    spain: "es",
  };
  return codes[teamId] ?? "xx";
}
