// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IPTToken
 * @dev Interface for Principal Token (PT) representing the principal component of SY tokens
 */
interface IPTToken is IERC20 {
    // Custom errors
    error TokenHasNotMaturedYet();
    error TokenHasMatured();
    error InvalidSYTokenAddress();
    error InsufficientPTBalance();
    error RedemptionNotEnabled();
    error AmountMustBeGreaterThanZero();
    
    // Events
    event Redeem(address indexed user, uint256 ptAmount, uint256 underlyingAmount);
    
    // State variables
    // function syToken() external view returns (address);
    function maturity() external view returns (uint256);
    function redeemable() external view returns (bool);
    
    // Functions
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function enableRedemption() external;
    function redeem(uint256 amount) external;
    function hasMatured() external view returns (bool);
    function timeToMaturity() external view returns (uint256);
    function getRedemptionRate() external pure returns (uint256);
}
