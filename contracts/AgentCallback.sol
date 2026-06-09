// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── Platform structs (complex version — matches actual callback) ──

enum ConsensusType { Majority, Threshold }

enum ResponseStatus {
    None, Pending, Success, Failed, TimedOut
}

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

interface IAgentRequester {
    function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes calldata payload)
        external payable returns (uint256 requestId);
    function getRequestDeposit() external view returns (uint256);
}

interface ILLMAgent {
    function inferString(string calldata prompt, string calldata system, bool chainOfThought, string[] calldata allowedValues)
        external returns (bytes memory);
}

contract AgentCallback {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;

    address public owner;

    struct StoredResult {
        string textResponse;
        bytes rawResult;
        int256 numericResponse;
        uint8 status;
        uint256 timestamp;
        bool fulfilled;
        uint256 responseCount;
        uint8 firstValidatorStatus;
    }

    mapping(uint256 => StoredResult) public results;
    uint256 public lastRequestId;
    uint256 public resultCount;

    event InferenceRequested(uint256 indexed requestId);
    event InferenceResult(uint256 indexed requestId, uint8 status, string text);

    constructor() { owner = msg.sender; }

    function requestInference(string calldata prompt, string calldata system)
        external payable returns (uint256 requestId)
    {
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            prompt, system, false, new string[](0)
        );

        // Send ALL received value to the platform as deposit
        require(msg.value > 0, "Must send STT for agent execution");

        requestId = PLATFORM.createRequest{value: msg.value}(
            LLM_AGENT_ID, address(this), this.handleResponse.selector, payload
        );
        lastRequestId = requestId;
        emit InferenceRequested(requestId);
    }

    function handleResponse(
        uint256 requestId,
        Response[] calldata responses,
        ResponseStatus status,
        Request calldata /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");

        string memory textResp = "";
        bytes memory rawBytes;
        uint8 firstValStatus = 99;

        if (responses.length > 0) {
            rawBytes = responses[0].result;
            firstValStatus = uint8(responses[0].status);

            if (status == ResponseStatus.Success && rawBytes.length > 0) {
                // Try multiple decode strategies
                // Strategy 1: abi.decode as string
                try this.tryDecodeString(rawBytes) returns (string memory s) {
                    textResp = s;
                } catch {
                    // Strategy 2: raw bytes to string
                    textResp = string(rawBytes);
                }
            }
        }

        results[requestId] = StoredResult({
            textResponse: textResp,
            rawResult: rawBytes,
            numericResponse: 0,
            status: uint8(status),
            timestamp: block.timestamp,
            fulfilled: true,
            responseCount: responses.length,
            firstValidatorStatus: firstValStatus
        });
        resultCount++;

        emit InferenceResult(requestId, uint8(status), textResp);
    }

    function tryDecodeString(bytes calldata data) external pure returns (string memory) {
        return abi.decode(data, (string));
    }

    function isFulfilled(uint256 requestId) external view returns (bool) {
        return results[requestId].fulfilled;
    }

    function getResult(uint256 requestId) external view returns (StoredResult memory) {
        require(results[requestId].fulfilled, "Not fulfilled");
        return results[requestId];
    }

    function getDepositRequired() external view returns (uint256) {
        return PLATFORM.getRequestDeposit();
    }

    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    receive() external payable {}
}
