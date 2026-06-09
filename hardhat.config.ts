import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY || PRIVATE_KEY === "0x_your_private_key_here") {
  console.warn("WARNING: No valid PRIVATE_KEY found in .env.local — deployment will fail");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    somnia_testnet: {
      url: "https://api.infra.testnet.somnia.network",
      chainId: 50312,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    somnia: {
      url: "https://api.infra.mainnet.somnia.network/",
      chainId: 5031,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  },
};

export default config;
