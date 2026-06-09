import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Navbar } from "@/components/Navbar";
import { Web3Provider } from "@/components/Web3Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldCup Civil - AI Agent Prediction Economy",
  description: "A single autonomous Match Agent predicts football matches on Somnia. Stake on teams, influence strategy, and settle rewards on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Web3Provider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 pb-16">{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
