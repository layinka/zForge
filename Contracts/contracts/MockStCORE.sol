// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockStCORE
 * @dev Mock staked CORE token for testing purposes with yield generation
 */
contract MockStCORE is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18; // 1M tokens
    
    // Yield tracking
    uint256 public yieldRate = 500; // 5% APY in basis points (5% = 500 bps)
    uint256 public lastYieldUpdate;
    uint256 public accumulatedYieldPerToken;
    
    // User yield tracking
    mapping(address => uint256) public userYieldDebt;
    mapping(address => uint256) public pendingYield;
    
    event YieldDistributed(uint256 totalYield, uint256 yieldPerToken);
    event YieldClaimed(address indexed user, uint256 amount);
    event YieldRateUpdated(uint256 newRate);
    
    constructor() ERC20("Staked CORE", "stCORE") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
        lastYieldUpdate = block.timestamp;
    }
    
    /**
     * @dev Update yield accumulation before any balance changes
     */
    function transfer(address to, uint256 value) public override returns (bool) {
        updateYield();
        _updateUserYield(msg.sender);
        _updateUserYield(to);
        
        bool result = super.transfer(to, value);
        
        // Update yield debt after balance changes
        userYieldDebt[msg.sender] = balanceOf(msg.sender) * accumulatedYieldPerToken / 1e18;
        userYieldDebt[to] = balanceOf(to) * accumulatedYieldPerToken / 1e18;
        
        return result;
    }
    
    /**
     * @dev Update yield accumulation before any balance changes
     */
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        updateYield();
        _updateUserYield(from);
        _updateUserYield(to);
        
        bool result = super.transferFrom(from, to, value);
        
        // Update yield debt after balance changes
        userYieldDebt[from] = balanceOf(from) * accumulatedYieldPerToken / 1e18;
        userYieldDebt[to] = balanceOf(to) * accumulatedYieldPerToken / 1e18;
        
        return result;
    }
    
    /**
     * @dev Update global yield accumulation
     */
    function updateYield() public {
        if (block.timestamp <= lastYieldUpdate || totalSupply() == 0) {
            return;
        }
        
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;
        uint256 yieldToDistribute = totalSupply() * yieldRate * timeElapsed / (365 days * 10000);
        
        if (yieldToDistribute > 0) {
            accumulatedYieldPerToken += yieldToDistribute * 1e18 / totalSupply();
            emit YieldDistributed(yieldToDistribute, accumulatedYieldPerToken);
        }
        
        lastYieldUpdate = block.timestamp;
    }
    
    /**
     * @dev Update pending yield for a user
     */
    function _updateUserYield(address user) internal {
        uint256 userBalance = balanceOf(user);
        if (userBalance > 0) {
            uint256 accumulatedYield = userBalance * accumulatedYieldPerToken / 1e18;
            pendingYield[user] += accumulatedYield - userYieldDebt[user];
        }
    }
    
    /**
     * @dev Get pending yield for a user
     */
    function getPendingYield(address user) external view returns (uint256) {
        uint256 currentAccumulated = accumulatedYieldPerToken;
        
        // Calculate what the accumulated yield would be if updated now
        if (block.timestamp > lastYieldUpdate && totalSupply() > 0) {
            uint256 timeElapsed = block.timestamp - lastYieldUpdate;
            uint256 yieldToDistribute = totalSupply() * yieldRate * timeElapsed / (365 days * 10000);
            currentAccumulated += yieldToDistribute * 1e18 / totalSupply();
        }
        
        uint256 userBalance = balanceOf(user);
        uint256 accumulatedYield = userBalance * currentAccumulated / 1e18;
        return pendingYield[user] + accumulatedYield - userYieldDebt[user];
    }
    
    /**
     * @dev Claim accumulated yield
     */
    function claimYield() external {
        updateYield();
        _updateUserYield(msg.sender);
        
        uint256 yield = pendingYield[msg.sender];
        require(yield > 0, "No yield to claim");
        
        pendingYield[msg.sender] = 0;
        userYieldDebt[msg.sender] = balanceOf(msg.sender) * accumulatedYieldPerToken / 1e18;
        
        _mint(msg.sender, yield);
        emit YieldClaimed(msg.sender, yield);
    }
    
    /**
     * @dev Set yield rate (only owner, for testing)
     */
    function setYieldRate(uint256 _yieldRate) external onlyOwner {
        updateYield();
        yieldRate = _yieldRate;
        emit YieldRateUpdated(_yieldRate);
    }
    
    /**
     * @dev Simulate time passing for testing (advance yield calculation)
     */
    function simulateTimePass(uint256 timeInSeconds) external onlyOwner {
        lastYieldUpdate -= timeInSeconds;
        updateYield();
    }
    
    /**
     * @dev Mint tokens for testing
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet function for testing - anyone can get 1000 tokens
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**18, "Already have enough tokens");
        _mint(msg.sender, 1000 * 10**18);
    }
}
