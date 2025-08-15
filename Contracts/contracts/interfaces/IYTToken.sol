// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IYTToken
 * @dev Interface for Yield Token (YT) representing the yield component of SY tokens
 */
interface IYTToken is IERC20 {
    // Custom errors
    error TokenHasExpired();
    error InvalidSYTokenAddress();
    error NoYieldToClaim();
    
    // Events
    event YieldClaimed(address indexed user, uint256 yieldAmount);
    
    // State variables
    // function syToken() external view returns (address);
    function maturity() external view returns (uint256);
    
    // Functions
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function getClaimableYield(address user) external view returns (uint256);
    function claimYield() external;
    function hasExpired() external view returns (bool);
    function timeToExpiry() external view returns (uint256);
    function getTotalYieldClaimed(address user) external view returns (uint256);
    function lastClaimTime(address user) external view returns (uint256);
    function totalYieldClaimed(address user) external view returns (uint256);
}
