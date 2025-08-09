// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockYieldToken
 * @dev Mock yield token for demo purposes with per-block yield generation
 * @notice Earns 0.001% per block for easy demonstration of yield accumulation
 */
contract MockYieldToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**18; // 1B tokens
    
    // Block-based yield tracking with higher precision
    uint256 public yieldRatePerBlock; // Now supports much smaller values
    uint256 public constant YIELD_PRECISION = 1e18; // 18 decimal precision
    uint256 public lastYieldBlock;
    uint256 public accumulatedYieldPerToken;
    
    // User yield tracking
    mapping(address => uint256) public userYieldDebt;
    mapping(address => uint256) public pendingYield;
    
    event YieldDistributed(uint256 totalYield, uint256 yieldPerToken, uint256 blocksElapsed);
    event YieldClaimed(address indexed user, uint256 amount);
    event YieldRateUpdated(uint256 newRate);
    
    constructor(string memory name, string memory symbol, uint256 _yieldRatePerBlock) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
        _mint(0x4ABda0097D7545dE58608F7E36e0C1cac68b4943, INITIAL_SUPPLY);
        lastYieldBlock = block.number;
        yieldRatePerBlock = _yieldRatePerBlock;
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
     * @dev Update global yield accumulation based on blocks elapsed
     */
    function updateYield() public {
        if (block.number <= lastYieldBlock || totalSupply() == 0) {
            return;
        }
        
        uint256 blocksElapsed = block.number - lastYieldBlock;
        // Use high precision: yieldRatePerBlock is now a decimal scaled by 1e18
        // Example: 0.0000008 per block = 800000000000 (0.0000008 * 1e18)
        uint256 yieldToDistribute = totalSupply() * yieldRatePerBlock * blocksElapsed / YIELD_PRECISION;
        
        if (yieldToDistribute > 0) {
            accumulatedYieldPerToken += yieldToDistribute * 1e18 / totalSupply();
            emit YieldDistributed(yieldToDistribute, accumulatedYieldPerToken, blocksElapsed);
        }
        
        lastYieldBlock = block.number;
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
        if (block.number > lastYieldBlock && totalSupply() > 0) {
            uint256 blocksElapsed = block.number - lastYieldBlock;
            uint256 yieldToDistribute = totalSupply() * yieldRatePerBlock * blocksElapsed / YIELD_PRECISION;
            currentAccumulated += yieldToDistribute * 1e18 / totalSupply();
        }
        
        uint256 userBalance = balanceOf(user);
        uint256 accumulatedYield = userBalance * currentAccumulated / 1e18;
        return pendingYield[user] + accumulatedYield - userYieldDebt[user];
    }
    
    /**
     * @dev Get expected yield for next N blocks
     */
    function getExpectedYieldForBlocks(address user, uint256 blocks) external view returns (uint256) {
        uint256 userBalance = balanceOf(user);
        if (userBalance == 0) return 0;
        
        uint256 yieldForBlocks = userBalance * yieldRatePerBlock * blocks / YIELD_PRECISION;
        return yieldForBlocks;
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
     * @dev Set yield rate per block (only owner, for testing)
     * @param _yieldRatePerBlock New yield rate scaled by 1e18 (e.g., 800000000000 = 0.0000008 per block)
     */
    function setYieldRatePerBlock(uint256 _yieldRatePerBlock) external onlyOwner {
        updateYield();
        yieldRatePerBlock = _yieldRatePerBlock;
        emit YieldRateUpdated(_yieldRatePerBlock);
    }
    
    /**
     * @dev Simulate blocks passing for testing (advance yield calculation)
     */
    function simulateBlocksPass(uint256 blocksToPass) external onlyOwner {
        lastYieldBlock -= blocksToPass;
        updateYield();
    }
    
    /**
     * @dev Mint tokens for testing
     */
    function mint(address to, uint256 amount) external onlyOwner {
        updateYield();
        _updateUserYield(to);
        _mint(to, amount);
        userYieldDebt[to] = balanceOf(to) * accumulatedYieldPerToken / 1e18;
    }
    
    /**
     * @dev Faucet function for testing - anyone can get 1000 tokens
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**18, "Already have enough tokens");
        updateYield();
        _updateUserYield(msg.sender);
        _mint(msg.sender, 1000 * 10**18);
        userYieldDebt[msg.sender] = balanceOf(msg.sender) * accumulatedYieldPerToken / 1e18;
    }
    
    /**
     * @dev Get current block number (for frontend reference)
     */
    function getCurrentBlock() external view returns (uint256) {
        return block.number;
    }
    
    /**
     * @dev Get blocks since last yield update
     */
    function getBlocksSinceLastUpdate() external view returns (uint256) {
        return block.number > lastYieldBlock ? block.number - lastYieldBlock : 0;
    }
    
    /**
     * @dev Get yield rate information for display
     */
    function getYieldInfo() external view returns (
        uint256 ratePerBlock,
        uint256 lastBlock,
        uint256 currentBlock,
        uint256 blocksSinceUpdate
    ) {
        return (
            yieldRatePerBlock,
            lastYieldBlock,
            block.number,
            block.number > lastYieldBlock ? block.number - lastYieldBlock : 0
        );
    }
}
