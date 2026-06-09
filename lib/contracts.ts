// ── Contract ABIs ──

export const TeamVaultABI = [
  // userTeamChoice(matchId, user) -> teamId (persistent, never cleared)
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "address", name: "user" },
    ],
    name: "userTeamChoice",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }, { type: "uint256" }],
    name: "matchTeamStaked",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Staking
  {
    inputs: [
      { type: "uint256", name: "teamId" },
      { type: "uint256", name: "matchId" },
    ],
    name: "stake",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "teamId" },
    ],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "teamId" },
    ],
    name: "getUserStake",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "uint256", name: "amount" },
          { type: "uint256", name: "timestamp" },
          { type: "uint256", name: "matchId" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "teamA" },
      { type: "uint256", name: "teamB" },
    ],
    name: "getMatchTotalStaked",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    type: "event",
    name: "Staked",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "teamId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "teamId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

export const PredictionABI = [
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "homeTeamId" },
      { type: "uint256", name: "awayTeamId" },
    ],
    name: "setMatchTeams",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "uint8", name: "homeScore" },
      { type: "uint8", name: "awayScore" },
    ],
    name: "finalizeMatchResult",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }],
    name: "results",
    outputs: [
      { type: "uint8", name: "homeScore" },
      { type: "uint8", name: "awayScore" },
      { type: "uint256", name: "winner" },
      { type: "bool", name: "finalized" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    type: "event",
    name: "MatchFinalized",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: false, name: "homeScore", type: "uint8" },
      { indexed: false, name: "awayScore", type: "uint8" },
      { indexed: false, name: "winner", type: "uint256" },
    ],
  },
] as const;

export const RewardABI = [
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "address", name: "user" },
      { type: "uint256", name: "teamId" },
    ],
    name: "claimed",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "teamId" },
    ],
    name: "calculateReward",
    outputs: [
      { type: "uint256", name: "reward" },
      { type: "uint256", name: "stakeReturned" },
      { type: "uint256", name: "settlementBonus" },
      { type: "uint256", name: "redistributionBps" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "matchId" },
      { type: "uint256", name: "teamId" },
    ],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "fundPool",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "teamId", type: "uint256" },
      { indexed: false, name: "rewardAmount", type: "uint256" },
    ],
  },
] as const;

// ── Team ID mapping (matches lib/store.ts TEAMS order) ──

export const TEAM_IDS: Record<string, number> = {
  argentina: 1,
  france: 2,
  brazil: 3,
  england: 4,
  germany: 5,
  spain: 6,
};

export const MATCH_IDS: Record<string, number> = {
  match_1: 1,
  match_2: 2,
  match_3: 3,
};

// ── Contract addresses (populated after deployment) ──

export const CONTRACTS = {
  teamVault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  prediction: (process.env.NEXT_PUBLIC_PREDICTION_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  reward: (process.env.NEXT_PUBLIC_REWARD_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
};
