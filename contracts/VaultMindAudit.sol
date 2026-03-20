// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract VaultMindAudit {
    struct AuditEntry {
        bytes32 decisionHash;
        address agent;
        uint256 timestamp;
        uint256 blockNumber;
    }

    AuditEntry[] public audits;
    mapping(address => uint256) public auditCountByAgent;

    event AuditRecorded(
        uint256 indexed index,
        bytes32 indexed decisionHash,
        address indexed agent,
        uint256 timestamp
    );

    function recordAudit(bytes32 decisionHash) external {
        uint256 idx = audits.length;
        audits.push(AuditEntry({
            decisionHash: decisionHash,
            agent: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        auditCountByAgent[msg.sender]++;
        emit AuditRecorded(idx, decisionHash, msg.sender, block.timestamp);
    }

    function getAudit(uint256 index) external view returns (
        bytes32 decisionHash,
        address agent,
        uint256 timestamp,
        uint256 blockNumber
    ) {
        require(index < audits.length, "Index out of bounds");
        AuditEntry storage entry = audits[index];
        return (entry.decisionHash, entry.agent, entry.timestamp, entry.blockNumber);
    }

    function getAuditCount() external view returns (uint256) {
        return audits.length;
    }

    function getLatestAudit() external view returns (
        bytes32 decisionHash,
        address agent,
        uint256 timestamp,
        uint256 blockNumber
    ) {
        require(audits.length > 0, "No audits recorded");
        AuditEntry storage entry = audits[audits.length - 1];
        return (entry.decisionHash, entry.agent, entry.timestamp, entry.blockNumber);
    }
}
