// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SYToken
 * @dev Standardized Yield Token that wraps yield-bearing assets
 */
contract SYToken is ERC20, Ownable, ReentrancyGuard {
    IERC20 public immutable underlyingToken;
    uint256 public immutable maturity;
    uint256 public yieldRate; // Annual yield rate in basis points (e.g., 500 = 5%)
    uint256 public lastYieldUpdate;
    uint256 public totalYieldAccrued;
    
    mapping(address => uint256) public lastClaimTime;
    
    event Wrap(address indexed user, uint256 underlyingAmount, uint256 syAmount);
    event Unwrap(address indexed user, uint256 syAmount, uint256 underlyingAmount);
    event YieldClaimed(address indexed user, uint256 yieldAmount);
    
    constructor(
        address _underlyingToken,
        uint256 _maturity,
        string memory _name,
        string memory _symbol,
        uint256 _yieldRate
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_underlyingToken != address(0), "Invalid underlying token");
        require(_maturity > block.timestamp, "Maturity must be in the future");
        
        underlyingToken = IERC20(_underlyingToken);
        maturity = _maturity;
        yieldRate = _yieldRate;
        lastYieldUpdate = block.timestamp;
    }
    
    /**
     * @dev Wrap underlying tokens into SY tokens
     */
    function wrap(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(block.timestamp < maturity, "Token has matured");
        
        underlyingToken.transferFrom(msg.sender, address(this), amount);
        
        // Update yield before minting
        _updateYield();
        
        // Mint SY tokens 1:1 with underlying
        _mint(msg.sender, amount);
        lastClaimTime[msg.sender] = block.timestamp;
        
        emit Wrap(msg.sender, amount, amount);
    }
    
    /**
     * @dev Unwrap SY tokens back to underlying tokens
     */
    function unwrap(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient SY balance");
        
        _updateYield();
        
        // Burn SY tokens
        _burn(msg.sender, amount);
        
        // Transfer underlying tokens back
        underlyingToken.transfer(msg.sender, amount);
        
        emit Unwrap(msg.sender, amount, amount);
    }
    
    /**
     * @dev Calculate claimable yield for a user
     */
    function getClaimableYield(address user) public view returns (uint256) {
        if (balanceOf(user) == 0 || lastClaimTime[user] == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - lastClaimTime[user];
        uint256 annualYield = (balanceOf(user) * yieldRate) / 10000;
        uint256 yieldAmount = (annualYield * timeElapsed) / 365 days;
        
        return yieldAmount;
    }
    
    /**
     * @dev Claim accumulated yield
     */
    function claimYield() external nonReentrant {
        require(block.timestamp < maturity, "Token has matured");
        
        uint256 yieldAmount = getClaimableYield(msg.sender);
        require(yieldAmount > 0, "No yield to claim");
        
        lastClaimTime[msg.sender] = block.timestamp;
        totalYieldAccrued += yieldAmount;
        
        // Mint yield as new SY tokens
        _mint(msg.sender, yieldAmount);
        
        emit YieldClaimed(msg.sender, yieldAmount);
    }
    
    /**
     * @dev Update global yield accumulation
     */
    function _updateYield() internal {
        if (block.timestamp > lastYieldUpdate && totalSupply() > 0) {
            uint256 timeElapsed = block.timestamp - lastYieldUpdate;
            uint256 globalYield = (totalSupply() * yieldRate * timeElapsed) / (10000 * 365 days);
            totalYieldAccrued += globalYield;
            lastYieldUpdate = block.timestamp;
        }
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
     * @dev Override transfer to update yield tracking
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        if (from != address(0) && lastClaimTime[from] == 0) {
            lastClaimTime[from] = block.timestamp;
        }
        if (to != address(0) && lastClaimTime[to] == 0) {
            lastClaimTime[to] = block.timestamp;
        }
        
        super._update(from, to, value);
    }
}
