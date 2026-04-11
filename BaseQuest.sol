// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BaseQuest
/// @notice On-chain görev takibi ve selam sistemi
/// @dev Builder: bc_vkks0kwl
contract BaseQuest {

    struct Profile {
        uint256 greetsSent;
        uint256 greetsReceived;
        uint256 score;
        bool deployedContract;
        bool verifiedContract;
        bool interactedContract;
        uint256 joinedAt;
    }

    address public owner;
    address public oracle;

    mapping(address => Profile) public profiles;
    mapping(address => mapping(address => bool)) public hasGreeted;
    address[] public allUsers;
    mapping(address => bool) public isRegistered;

    uint256 public constant SCORE_DEPLOY     = 100;
    uint256 public constant SCORE_VERIFY     = 75;
    uint256 public constant SCORE_INTERACT   = 50;
    uint256 public constant SCORE_GREET_SENT = 10;
    uint256 public constant SCORE_GREET_RECV = 15;

    event UserRegistered(address indexed user, uint256 timestamp);
    event ContractDeployed(address indexed user, address contractAddress, uint256 timestamp);
    event ContractVerified(address indexed user, uint256 timestamp);
    event ContractInteracted(address indexed user, uint256 timestamp);
    event GreetSent(address indexed from, address indexed to, string message, uint256 timestamp);
    event ScoreUpdated(address indexed user, uint256 newScore);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyOracle() { require(msg.sender == oracle, "not oracle"); _; }
    modifier registered() {
        if (!isRegistered[msg.sender]) _register(msg.sender);
        _;
    }

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    function _register(address user) internal {
        isRegistered[user] = true;
        profiles[user].joinedAt = block.timestamp;
        allUsers.push(user);
        emit UserRegistered(user, block.timestamp);
    }

    function register() external {
        require(!isRegistered[msg.sender], "already registered");
        _register(msg.sender);
    }

    function completeDeployTask(address deployedContract) external registered {
        Profile storage p = profiles[msg.sender];
        require(!p.deployedContract, "already done");
        require(deployedContract != address(0), "invalid address");
        uint256 size;
        assembly { size := extcodesize(deployedContract) }
        require(size > 0, "not a contract");
        p.deployedContract = true;
        p.score += SCORE_DEPLOY;
        emit ContractDeployed(msg.sender, deployedContract, block.timestamp);
        emit ScoreUpdated(msg.sender, p.score);
    }

    function completeVerifyTask(address user) external onlyOracle {
        require(isRegistered[user], "not registered");
        Profile storage p = profiles[user];
        require(p.deployedContract, "deploy first");
        require(!p.verifiedContract, "already done");
        p.verifiedContract = true;
        p.score += SCORE_VERIFY;
        emit ContractVerified(user, block.timestamp);
        emit ScoreUpdated(user, p.score);
    }

    function completeInteractTask() external registered {
        Profile storage p = profiles[msg.sender];
        require(p.verifiedContract, "verify first");
        require(!p.interactedContract, "already done");
        p.interactedContract = true;
        p.score += SCORE_INTERACT;
        emit ContractInteracted(msg.sender, block.timestamp);
        emit ScoreUpdated(msg.sender, p.score);
    }

    function greet(address to, string calldata message) external registered {
        require(to != msg.sender, "cannot greet yourself");
        require(to != address(0), "invalid address");
        require(bytes(message).length <= 100, "message too long");
        require(!hasGreeted[msg.sender][to], "already greeted this user");
        if (!isRegistered[to]) _register(to);
        hasGreeted[msg.sender][to] = true;
        Profile storage sender = profiles[msg.sender];
        Profile storage receiver = profiles[to];
        sender.greetsSent++;
        sender.score += SCORE_GREET_SENT;
        receiver.greetsReceived++;
        receiver.score += SCORE_GREET_RECV;
        emit GreetSent(msg.sender, to, message, block.timestamp);
        emit ScoreUpdated(msg.sender, sender.score);
        emit ScoreUpdated(to, receiver.score);
    }

    function getProfile(address user) external view returns (Profile memory) {
        return profiles[user];
    }

    function getScore(address user) external view returns (uint256) {
        return profiles[user].score;
    }

    function getUserCount() external view returns (uint256) {
        return allUsers.length;
    }

    function getLeaderboard(uint256 offset, uint256 limit)
        external view returns (address[] memory users, uint256[] memory scores)
    {
        uint256 total = allUsers.length;
        if (offset >= total) return (new address[](0), new uint256[](0));
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 len = end - offset;
        users = new address[](len);
        scores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            users[i] = allUsers[offset + i];
            scores[i] = profiles[allUsers[offset + i]].score;
        }
    }

    function getGreetLevel(address user) external view returns (uint8) {
        uint256 sent = profiles[user].greetsSent;
        if (sent >= 20) return 3;
        if (sent >= 10) return 2;
        if (sent >= 5)  return 1;
        return 0;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }
}
