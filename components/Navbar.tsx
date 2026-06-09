"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useAccount();

  const links = [
    { href: "/", label: "Matches" },
    { href: "/results", label: "Results" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#07100b]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/30 bg-gold/10 font-mono text-sm font-semibold text-gold">
            WC
          </div>
          <div>
            <span className="block text-base font-semibold tracking-tight text-white">
              WorldCup Civil
            </span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-gray-500">
              Somnia agent settlement
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-white/[0.07] text-white"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="ml-2 flex items-center gap-3 border-l border-white/[0.08] pl-3">
            {isConnected && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-gray-500">Somnia Testnet</span>
              </div>
            )}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="address"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
