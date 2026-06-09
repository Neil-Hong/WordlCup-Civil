// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Prediction {
    address public owner;
    address public oracle;

    struct MatchTeams {
        uint256 homeTeamId;
        uint256 awayTeamId;
        bool set;
    }

    struct MatchResult {
        uint8 homeScore;
        uint8 awayScore;
        uint256 winner; // 0=draw, otherwise the actual winning team ID
        bool finalized;
    }

    mapping(uint256 => MatchResult) public results;
    mapping(uint256 => MatchTeams) public matchTeams;

    event MatchFinalized(
        uint256 indexed matchId,
        uint8 homeScore,
        uint8 awayScore,
        uint256 winner
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle || msg.sender == owner, "Only oracle");
        _;
    }

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setMatchTeams(
        uint256 matchId,
        uint256 homeTeamId,
        uint256 awayTeamId
    ) external onlyOracle {
        require(!results[matchId].finalized, "Match already finalized");
        matchTeams[matchId] = MatchTeams({
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            set: true
        });
    }

    function finalizeMatchResult(
        uint256 matchId,
        uint8 homeScore,
        uint8 awayScore
    ) external onlyOracle {
        require(!results[matchId].finalized, "Already finalized");
        require(matchTeams[matchId].set, "Match teams not set");

        MatchTeams memory teams = matchTeams[matchId];
        uint256 winnerId;

        if (homeScore > awayScore) {
            winnerId = teams.homeTeamId;
        } else if (awayScore > homeScore) {
            winnerId = teams.awayTeamId;
        } else {
            winnerId = 0; // draw
        }

        results[matchId] = MatchResult({
            homeScore: homeScore,
            awayScore: awayScore,
            winner: winnerId,
            finalized: true
        });

        emit MatchFinalized(matchId, homeScore, awayScore, winnerId);
    }

}
