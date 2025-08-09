// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SYToken.sol";
import "./PTToken.sol";
import "./YTToken.sol";

/**
 * @title SYFactory
 * @dev Main factory contract for creating and managing SY, PT, and YT tokens
 */
contract SYFactory_single_maturity is Ownable, ReentrancyGuard {
    struct TokenPair {
        address pt;
        address yt;
        bool exists;
    }
    
    mapping(address => TokenPair) public syTokenPairs; // SY token => PT/YT pair
    mapping(address => address) public underlyingToSY; // underlying => SY token
    
    address[] public allSYTokens;
    
    event SYTokenCreated(
        address indexed underlying,
        address indexed syToken,
        uint256 maturity,
        uint256 yieldRate
    );
    
    event TokensSplit(
        address indexed user,
        address indexed syToken,
        uint256 amount,
        address ptToken,
        address ytToken
    );
    
    event TokensMerged(
        address indexed user,
        address indexed syToken,
        uint256 amount,
        address ptToken,
        address ytToken
    );
    
    event PTRedeemed(
        address indexed user,
        address indexed ptToken,
        uint256 amount
    );
    
    event YieldClaimed(
        address indexed user,
        address indexed ytToken,
        uint256 yieldAmount
    );
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Create a new SY token for an underlying asset
     */
    function createSYToken(
        address underlying,
        uint256 maturity,
        string memory name,
        string memory symbol,
        uint256 yieldRate
    ) external onlyOwner returns (address) {
        require(underlying != address(0), "Invalid underlying token");
        require(maturity > block.timestamp, "Maturity must be in the future");
        require(underlyingToSY[underlying] == address(0), "SY token already exists");
        
        // Create SY token
        SYToken syToken = new SYToken(
            underlying,
            maturity,
            name,
            symbol,
            yieldRate
        );
        
        // Create PT and YT tokens
        string memory ptName = string(abi.encodePacked("PT-", name));
        string memory ptSymbol = string(abi.encodePacked("PT-", symbol));
        string memory ytName = string(abi.encodePacked("YT-", name));
        string memory ytSymbol = string(abi.encodePacked("YT-", symbol));
        
        PTToken ptToken = new PTToken(address(syToken), ptName, ptSymbol);
        YTToken ytToken = new YTToken(address(syToken), ytName, ytSymbol);
        
        // Store the pair
        syTokenPairs[address(syToken)] = TokenPair({
            pt: address(ptToken),
            yt: address(ytToken),
            exists: true
        });
        
        underlyingToSY[underlying] = address(syToken);
        allSYTokens.push(address(syToken));
        
        emit SYTokenCreated(underlying, address(syToken), maturity, yieldRate);
        
        return address(syToken);
    }
    
    /**
     * @dev Wrap underlying tokens into SY tokens
     */
    function wrap(address underlying, uint256 amount) external nonReentrant returns (address) {
        address syTokenAddress = underlyingToSY[underlying];
        require(syTokenAddress != address(0), "SY token does not exist");
        
        SYToken syToken = SYToken(syTokenAddress);
        
        // Transfer underlying tokens to this contract first
        IERC20(underlying).transferFrom(msg.sender, address(this), amount);
        
        // Approve SY token to spend underlying tokens
        IERC20(underlying).approve(address(syToken), amount);
        
        // Wrap tokens
        syToken.wrap(amount);
        
        // Transfer SY tokens to user
        syToken.transfer(msg.sender, amount);
        
        return syTokenAddress;
    }
    
    /**
     * @dev Split SY tokens into PT and YT tokens
     */
    function split(address syTokenAddress, uint256 amount) external nonReentrant returns (address, address) {
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        require(pair.exists, "Token pair does not exist");
        
        SYToken syToken = SYToken(syTokenAddress);
        PTToken ptToken = PTToken(pair.pt);
        YTToken ytToken = YTToken(pair.yt);
        
        require(!syToken.hasMatured(), "SY token has matured");
        require(syToken.balanceOf(msg.sender) >= amount, "Insufficient SY balance");
        
        // Burn SY tokens
        syToken.transferFrom(msg.sender, address(this), amount);
        
        // Mint PT and YT tokens
        ptToken.mint(msg.sender, amount);
        ytToken.mint(msg.sender, amount);
        
        emit TokensSplit(msg.sender, syTokenAddress, amount, pair.pt, pair.yt);
        
        return (pair.pt, pair.yt);
    }
    
    /**
     * @dev Merge PT and YT tokens back into SY tokens
     */
    function merge(address syTokenAddress, uint256 amount) external nonReentrant returns (address) {
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        require(pair.exists, "Token pair does not exist");
        
        PTToken ptToken = PTToken(pair.pt);
        YTToken ytToken = YTToken(pair.yt);
        SYToken syToken = SYToken(syTokenAddress);
        
        require(ptToken.balanceOf(msg.sender) >= amount, "Insufficient PT balance");
        require(ytToken.balanceOf(msg.sender) >= amount, "Insufficient YT balance");
        
        // Burn PT and YT tokens
        ptToken.burn(msg.sender, amount);
        ytToken.burn(msg.sender, amount);
        
        // Transfer SY tokens to user
        syToken.transfer(msg.sender, amount);
        
        emit TokensMerged(msg.sender, syTokenAddress, amount, pair.pt, pair.yt);
        
        return syTokenAddress;
    }
    
    /**
     * @dev Redeem PT tokens for underlying after maturity
     */
    function redeemPT(address ptTokenAddress) external nonReentrant {
        PTToken ptToken = PTToken(ptTokenAddress);
        require(ptToken.hasMatured(), "PT token has not matured");
        
        uint256 balance = ptToken.balanceOf(msg.sender);
        require(balance > 0, "No PT tokens to redeem");
        
        ptToken.redeem(balance);
        
        emit PTRedeemed(msg.sender, ptTokenAddress, balance);
    }
    
    /**
     * @dev Claim yield from YT tokens
     */
    function claimYT(address ytTokenAddress) external nonReentrant {
        YTToken ytToken = YTToken(ytTokenAddress);
        require(!ytToken.hasExpired(), "YT token has expired");
        
        uint256 claimableYield = ytToken.getClaimableYield(msg.sender);
        require(claimableYield > 0, "No yield to claim");
        
        ytToken.claimYield();
        
        emit YieldClaimed(msg.sender, ytTokenAddress, claimableYield);
    }
    
    /**
     * @dev Get PT and YT token addresses for a SY token
     */
    function getTokenPair(address syToken) external view returns (address pt, address yt) {
        TokenPair memory pair = syTokenPairs[syToken];
        require(pair.exists, "Token pair does not exist");
        return (pair.pt, pair.yt);
    }
    
    /**
     * @dev Get all SY tokens
     */
    function getAllSYTokens() external view returns (address[] memory) {
        return allSYTokens;
    }
    
    /**
     * @dev Get SY token for underlying asset
     */
    function getSYToken(address underlying) external view returns (address) {
        return underlyingToSY[underlying];
    }
}
