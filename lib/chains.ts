import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network/"] },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});

export const somnia = defineChain({
  id: 5031,
  name: "Somnia",
  nativeCurrency: { name: "SOMI", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.infra.mainnet.somnia.network/"] },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://explorer.somnia.network",
    },
  },
});
