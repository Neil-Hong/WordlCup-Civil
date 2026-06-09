"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { somniaTestnet } from "@/lib/chains";

const config = getDefaultConfig({
  appName: "WorldCup Civil",
  projectId: "worldcup-civil-mvp",
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http("https://dream-rpc.somnia.network/"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider coolMode>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
