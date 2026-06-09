// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Reward
 * @notice Calculates and pays settlement rewards.
 *         Winning supporters receive their stake plus either a pro-rata share
 *         of 80% of the losing team pool, or a sponsor bonus from the
 *         prefunded reward pool when early MVP liquidity is one-sided.
 *         Draws return stake only.
 *
 *         Designed for Somnia (EVM-compatible L1).
 */

interface ITeamVault {
    function stakes(address user, uint256 matchId, uint256 teamId)
        external
        view
        returns (
            uint256 amount,
            uint256 timestamp,
            uint256 matchId_
        );

    function matchTeamStaked(uint256 matchId, uint256 teamId)
        external
        view
        returns (uint256);
}

interface IPrediction {
    function results(uint256 matchId)
        external
        view
        returns (
            uint8 homeScore,
            uint8 awayScore,
            uint256 winner,
            bool finalized
        );

    function matchTeams(uint256 matchId)
        external
        view
        returns (
            uint256 homeTeamId,
            uint256 awayTeamId,
            bool set
        );
}

contract Reward {
    // ── State ──

    address public owner;
    ITeamVault public vault;
    IPrediction public prediction;

    // Settlement constants (basis points: 10000 = 100%).
    // When there is no opposing pool, the same BPS is used as a sponsor bonus
    // against the user's winning stake, paid from the prefunded Reward balance.
    uint256 public constant LOSING_POOL_REDISTRIBUTION_BPS = 8000;

    // matchId -> user -> teamId -> claimed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public claimed;

    // ── Events ──

    event RewardClaimed(
        address indexed user,
        uint256 indexed matchId,
        uint256 indexed teamId,
        uint256 rewardAmount
    );

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ── Constructor ──

    constructor(address _vault, address _prediction) {
        owner = msg.sender;
        vault = ITeamVault(_vault);
        prediction = IPrediction(_prediction);
    }

    // ── Reward Calculation ──

    /**
     * @notice Calculate the reward for a specific user stake
     * @param user The staker address
     * @param matchId The match identifier
     * @param teamId The team the user staked on
     * @return reward Total settlement amount paid to the user
     * @return stakeReturned Original stake returned
     * @return settlementBonus Pro-rata losing-pool share or MVP sponsor bonus
     * @return redistributionBps Losing-pool redistribution rate
     */
    function calculateReward(
        address user,
        uint256 matchId,
        uint256 teamId
    )
        external
        view
        returns (
            uint256 reward,
            uint256 stakeReturned,
            uint256 settlementBonus,
            uint256 redistributionBps
        )
    {
        (uint256 stakedAmount, , ) = vault.stakes(
            user,
            matchId,
            teamId
        );
        require(stakedAmount > 0, "No stake found");

        (, , uint256 winner, bool finalized) = prediction.results(matchId);
        require(finalized, "Match not finalized");

        redistributionBps = LOSING_POOL_REDISTRIBUTION_BPS;

        if (winner == 0) {
            return (stakedAmount, stakedAmount, 0, redistributionBps);
        }

        if (teamId != winner) {
            return (0, 0, 0, redistributionBps);
        }

        (uint256 homeTeamId, uint256 awayTeamId, bool teamsSet) = prediction.matchTeams(matchId);
        require(teamsSet, "Match teams not set");

        uint256 losingTeamId = winner == homeTeamId ? awayTeamId : homeTeamId;
        uint256 winningPool = vault.matchTeamStaked(matchId, winner);
        uint256 losingPool = vault.matchTeamStaked(matchId, losingTeamId);

        stakeReturned = stakedAmount;
        if (losingPool > 0) {
            uint256 redistributedPool = (losingPool * redistributionBps) / 10000;
            settlementBonus = winningPool > 0
                ? (redistributedPool * stakedAmount) / winningPool
                : 0;
        } else {
            // MVP sponsor bonus: if liquidity is one-sided, the prefunded
            // Reward contract still pays winning users a meaningful bonus.
            settlementBonus = (stakedAmount * redistributionBps) / 10000;
        }

        reward = stakeReturned + settlementBonus;
        return (reward, stakeReturned, settlementBonus, redistributionBps);
    }

    /**
     * @notice Claim rewards for a specific stake
     * @param matchId The match identifier
     * @param teamId The team the user staked on
     */
    function claimReward(uint256 matchId, uint256 teamId) external {
        require(!claimed[matchId][msg.sender][teamId], "Already claimed");

        (uint256 reward, , , ) = this.calculateReward(
            msg.sender,
            matchId,
            teamId
        );
        require(reward > 0, "No reward to claim");

        claimed[matchId][msg.sender][teamId] = true;

        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "Transfer failed");

        emit RewardClaimed(msg.sender, matchId, teamId, reward);
    }

    // Allow contract to receive ETH for reward pool
    receive() external payable {}

    /**
     * @notice Fund the reward pool
     */
    function fundPool() external payable {}

}
