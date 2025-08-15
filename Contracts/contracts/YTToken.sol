// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SYToken.sol";
import "./interfaces/IYTToken.sol";

/**
 * @title YTToken
 * @dev Yield Token representing the yield component of SY tokens
 */
contract YTToken is ERC20, Ownable, ReentrancyGuard, IYTToken {
    
    
    SYToken public immutable syToken;
    uint256 public immutable maturity;
    
    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint256) public totalYieldClaimed;
    
    // event YieldClaimed(address indexed user, uint256 yieldAmount);
    
    modifier onlyBeforeMaturity() {
        if (block.timestamp >= maturity) revert TokenHasExpired();
        _;
    }
    
    constructor(
        address _syToken,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_syToken == address(0)) revert InvalidSYTokenAddress();
        
        syToken = SYToken(_syToken);
        maturity = syToken.maturity();
    }
    
    /**
     * @dev Mint YT tokens (only callable by SYFactory)
     */
    function mint(address to, uint256 amount) external onlyOwner onlyBeforeMaturity {
        _mint(to, amount);
        if (lastClaimTime[to] == 0) {
            lastClaimTime[to] = block.timestamp;
        }
    }
    
    /**
     * @dev Burn YT tokens (only callable by SYFactory)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    /**
     * @dev Calculate claimable yield for a user
     */
    function getClaimableYield(address user) public view returns (uint256) {
        if (balanceOf(user) == 0 || lastClaimTime[user] == 0 || block.timestamp >= maturity) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - lastClaimTime[user];
        uint256 yieldRate = syToken.yieldRate();
        uint256 annualYield = (balanceOf(user) * yieldRate) / 10000;
        uint256 yieldAmount = (annualYield * timeElapsed) / 365 days;
        
        return yieldAmount;
    }
    
    /**
     * @dev Claim accumulated yield
     */
    function claimYield() external nonReentrant onlyBeforeMaturity {
        uint256 yieldAmount = getClaimableYield(msg.sender);
        if (yieldAmount == 0) revert NoYieldToClaim();
        
        lastClaimTime[msg.sender] = block.timestamp;
        totalYieldClaimed[msg.sender] += yieldAmount;
        
        // Transfer yield from SY contract (as underlying tokens)
        syToken.underlyingToken().transfer(msg.sender, yieldAmount);
        
        emit YieldClaimed(msg.sender, yieldAmount);
    }
    
    /**
     * @dev Check if token has expired
     */
    function hasExpired() external view returns (bool) {
        return block.timestamp >= maturity;
    }
    
    /**
     * @dev Get time until expiry
     */
    function timeToExpiry() external view returns (uint256) {
        if (block.timestamp >= maturity) {
            return 0;
        }
        return maturity - block.timestamp;
    }
    
    /**
     * @dev Get total yield claimed by user
     */
    function getTotalYieldClaimed(address user) external view returns (uint256) {
        return totalYieldClaimed[user];
    }
    
    /**
     * @dev Override transfer to update yield tracking
     */
    function _update(address from, address to, uint256 value) internal virtual override{
        // Claim any pending yield before transfer
        if (from != address(0) && balanceOf(from) > 0) {
            uint256 pendingYield = getClaimableYield(from);
            if (pendingYield > 0) {
                lastClaimTime[from] = block.timestamp;
                totalYieldClaimed[from] += pendingYield;
                syToken.underlyingToken().transfer(from, pendingYield);
                emit YieldClaimed(from, pendingYield);
            }
        }
        
        if (to != address(0) && lastClaimTime[to] == 0) {
            lastClaimTime[to] = block.timestamp;
        }
        
        super._update(from, to, value);
    }
}
