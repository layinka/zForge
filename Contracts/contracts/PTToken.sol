// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SYToken.sol";

/**
 * @title PTToken
 * @dev Principal Token representing the principal component of SY tokens
 */
contract PTToken is ERC20, Ownable {
    SYToken public immutable syToken;
    uint256 public immutable maturity;
    bool public redeemable;
    
    event Redeem(address indexed user, uint256 ptAmount, uint256 underlyingAmount);
    
    modifier onlyAfterMaturity() {
        require(block.timestamp >= maturity, "Token has not matured yet");
        _;
    }
    
    modifier onlyBeforeMaturity() {
        require(block.timestamp < maturity, "Token has matured");
        _;
    }
    
    constructor(
        address _syToken,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_syToken != address(0), "Invalid SY token address");
        
        syToken = SYToken(_syToken);
        maturity = syToken.maturity();
        redeemable = false;
    }
    
    /**
     * @dev Mint PT tokens (only callable by SYFactory)
     */
    function mint(address to, uint256 amount) external onlyOwner onlyBeforeMaturity {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn PT tokens (only callable by SYFactory)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    /**
     * @dev Enable redemption after maturity
     */
    function enableRedemption() external onlyOwner onlyAfterMaturity {
        redeemable = true;
    }
    
    /**
     * @dev Redeem PT tokens for underlying tokens after maturity
     */
    function redeem(uint256 amount) external onlyAfterMaturity {
        require(redeemable, "Redemption not enabled");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient PT balance");
        
        // Burn PT tokens
        _burn(msg.sender, amount);
        
        // Transfer underlying tokens from SY contract
        syToken.underlyingToken().transfer(msg.sender, amount);
        
        emit Redeem(msg.sender, amount, amount);
    }
    
    /**
     * @dev Check if token has matured
     */
    function hasMatured() external view returns (bool) {
        return block.timestamp >= maturity;
    }
    
    /**
     * @dev Get time until maturity
     */
    function timeToMaturity() external view returns (uint256) {
        if (block.timestamp >= maturity) {
            return 0;
        }
        return maturity - block.timestamp;
    }
    
    /**
     * @dev Get redemption rate (always 1:1 for PT)
     */
    function getRedemptionRate() external pure returns (uint256) {
        return 1e18; // 1:1 ratio
    }
}
