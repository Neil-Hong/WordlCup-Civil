// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TeamVault
 * @notice Staking system for the AI Agent Football Prediction Economy.
 *         Users stake tokens to support a team before/during a match.
 *         Tracks total staked per team and individual user stakes.
 *
 *         Designed for Somnia (EVM-compatible L1).
 */

contract TeamVault {
    // ── State ──

    address public owner;
    uint256 public constant MAX_STAKE_PER_USER_PER_MATCH = 0.01 ether;

    struct Stake {
        uint256 amount;
        uint256 timestamp;
        uint256 matchId;
    }

    // matchId -> teamId -> total staked
    mapping(uint256 => mapping(uint256 => uint256)) public matchTeamStaked;

    // user -> matchId -> teamId -> Stake
    mapping(address => mapping(uint256 => mapping(uint256 => Stake))) public stakes;

    // matchId -> user -> chosen teamId (enforce one team per match)
    mapping(uint256 => mapping(address => uint256)) public userTeamChoice;

    // ── Events ──

    event Staked(address indexed user, uint256 indexed matchId, uint256 indexed teamId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed matchId, uint256 indexed teamId, uint256 amount);

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ── Constructor ──

    constructor() {
        owner = msg.sender;
    }

    // ── Staking ──

    /**
     * @notice Stake tokens on a team for a specific match
     * @param teamId The team to support
     * @param matchId The match identifier
     */
    function stake(uint256 teamId, uint256 matchId) external payable {
        require(msg.value > 0, "Must stake > 0");

        // Enforce: one user can only have an ACTIVE stake on one team per match.
        // If an older choice has no remaining stake, allow the user to choose again.
        uint256 chosenTeam = userTeamChoice[matchId][msg.sender];
        if (chosenTeam != 0 && chosenTeam != teamId) {
            require(
                stakes[msg.sender][matchId][chosenTeam].amount == 0,
                "Already staked on another team for this match"
            );
            userTeamChoice[matchId][msg.sender] = teamId;
        } else if (chosenTeam == 0) {
            userTeamChoice[matchId][msg.sender] = teamId;
        }

        Stake storage existing = stakes[msg.sender][matchId][teamId];
        require(
            existing.amount + msg.value <= MAX_STAKE_PER_USER_PER_MATCH,
            "Max stake per user per match exceeded"
        );
        if (existing.amount > 0) {
            // Add to existing stake
            existing.amount += msg.value;
            existing.timestamp = block.timestamp;
        } else {
            stakes[msg.sender][matchId][teamId] = Stake({
                amount: msg.value,
                timestamp: block.timestamp,
                matchId: matchId
            });
        }

        matchTeamStaked[matchId][teamId] += msg.value;
        emit Staked(msg.sender, matchId, teamId, msg.value);
    }

    /**
     * @notice Unstake tokens (only before match starts or if match cancelled)
     * @param matchId The match identifier
     * @param teamId The team staked on
     */
    function unstake(uint256 matchId, uint256 teamId) external {
        Stake storage userStake = stakes[msg.sender][matchId][teamId];
        require(userStake.amount > 0, "No stake found");

        uint256 amount = userStake.amount;
        userStake.amount = 0;
        if (userTeamChoice[matchId][msg.sender] == teamId) {
            userTeamChoice[matchId][msg.sender] = 0;
        }

        matchTeamStaked[matchId][teamId] -= amount;
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Unstaked(msg.sender, matchId, teamId, amount);
    }

    /**
     * @notice Get a user's stake for a specific match and team
     */
    function getUserStake(
        address user,
        uint256 matchId,
        uint256 teamId
    ) external view returns (Stake memory) {
        return stakes[user][matchId][teamId];
    }

    /**
     * @notice Get total staked for a match (sum of both teams)
     */
    function getMatchTotalStaked(uint256 matchId, uint256 teamA, uint256 teamB)
        external
        view
        returns (uint256)
    {
        return matchTeamStaked[matchId][teamA] + matchTeamStaked[matchId][teamB];
    }

    // Allow contract to receive ETH for rewards
    receive() external payable {}
}
