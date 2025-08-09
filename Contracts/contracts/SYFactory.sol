// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SYToken.sol";
import "./PTToken.sol";
import "./YTToken.sol";
// import "hardhat/console.sol";

/**
 * @title SYFactory - Yield Tokenization Factory
 * @dev Enhanced factory contract for creating and managing yield-bearing tokens with user-chosen maturities
 * 
 * This contract provides three main user flows for yield tokenization:
 * 
 * 1. SY TOKENS ONLY (wrapWithMaturity):
 *    - For users who want simple yield-bearing exposure
 *    - SY tokens automatically earn yield until maturity
 *    - Single token to manage, composable with other DeFi protocols
 *    - Can be split later when market conditions are favorable
 *    - Use cases: yield farming, liquidity provision, collateral, hold-and-earn strategies
 * 
 * 2. PT + YT TOKENS (wrapAndSplit):
 *    - For users who want to separate principal and yield
 *    - Most common flow for advanced yield strategies
 *    - Single transaction combines wrap + split for gas efficiency
 *    - Use cases: yield trading, arbitrage, portfolio diversification, risk management
 * 
 * 3. EXISTING SY TOKENS (split):
 *    - For users who already hold SY tokens from other sources
 *    - Allows timing strategies and partial splitting
 *    - Use cases: received SY tokens, market timing, partial position management
 * 
 * TOKEN TYPES:
 * - SY (Standardized Yield): Yield-bearing tokens that represent principal + yield
 * - PT (Principal Token): Fixed-value tokens redeemable for underlying at maturity
 * - YT (Yield Token): Tokens that capture all yield generated until maturity
 * 
 * ARCHITECTURE:
 * - Multi-maturity support: Multiple SY tokens per underlying with different maturities
 * - User-chosen maturities: Users can create custom maturity periods
 * - Atomic operations: wrapAndSplit ensures all-or-nothing execution
 * - Gas optimization: Combined operations reduce transaction costs
 */
contract SYFactory is Ownable, ReentrancyGuard {
    // Custom errors
    error InvalidUnderlyingToken();
    error MaturityTooSoon();
    error MaturityTooFar();
    error MaturityAlreadyExists();
    error InsufficientFee();
    error SYTokenDoesNotExist();
    error SYTokenHasMatured();
    error NoMaturityOptionsAvailable();
    error NoValidMaturityOptionsAvailable();
    error TokenPairDoesNotExist();
    error InsufficientSYBalance();
    error InsufficientPTBalance();
    error InsufficientYTBalance();
    error PTTokenHasNotMatured();
    error NoPTTokensToRedeem();
    error YTTokenHasExpired();
    error NoYieldToClaim();
    
    struct TokenPair {
        address pt;
        address yt;
        bool exists;
    }
    
    struct MaturityOption {
        uint256 maturity;
        address syToken;
        bool active;
    }
    
    // New mapping structure: underlying => maturity => SY token address
    mapping(address => mapping(uint256 => address)) public underlyingToSYByMaturity;
    
    // Track all maturity options for each underlying
    mapping(address => uint256[]) public availableMaturities;
    // mapping(address => mapping(uint256 => bool)) public maturityExists;
    
    // Keep existing mappings for backward compatibility
    mapping(address => TokenPair) public syTokenPairs; // SY token => PT/YT pair
    address[] public allSYTokens;
    address[] public underlyingTokens; // Track all underlying tokens
    
    // Configuration
    uint256 public constant MIN_MATURITY_DURATION = 1 days;
    uint256 public constant MAX_MATURITY_DURATION = 100 * 365 days; // 100 years
    uint256 public maturityCreationFee = 0; // Fee in wei to create new maturity option
    
    event SYTokenCreated(
        address indexed underlying,
        address indexed syToken,
        uint256 maturity,
        uint256 yieldRate,
        address indexed creator
    );
    
    event MaturityOptionAdded(
        address indexed underlying,
        uint256 maturity,
        address indexed syToken
    );
    
    event TokensWrapped(
        address indexed user,
        address indexed underlying,
        address indexed syToken,
        uint256 amount,
        uint256 maturity
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
     * @dev Create a new SY token for an underlying asset with specific maturity
     * @param underlying The underlying asset address
     * @param maturity The maturity timestamp
     * @param name Token name
     * @param symbol Token symbol  
     * @param yieldRate Annual yield rate in basis points
     */
    function createSYToken(
        address underlying,
        uint256 maturity,
        string memory name,
        string memory symbol,
        uint256 yieldRate
    ) external payable nonReentrant returns (address) {
        if (underlying == address(0)) revert InvalidUnderlyingToken();
        if (maturity <= block.timestamp + MIN_MATURITY_DURATION) revert MaturityTooSoon();
        if (maturity > block.timestamp + MAX_MATURITY_DURATION) revert MaturityTooFar();
        if (underlyingToSYByMaturity[underlying][maturity] != address(0)) revert MaturityAlreadyExists();
        if (msg.value < maturityCreationFee) revert InsufficientFee();
        
        // Create SY token
        SYToken syToken = new SYToken(
            underlying,
            maturity,
            string(abi.encodePacked("Standardized Yield ", name)),
            string(abi.encodePacked("SY-", symbol)) ,
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
        
        // Update mappings
        underlyingToSYByMaturity[underlying][maturity] = address(syToken);
        availableMaturities[underlying].push(maturity);
        // maturityExists[underlying][maturity] = true;
        allSYTokens.push(address(syToken));
        
        // Add underlying token to list if it's the first time
        if (availableMaturities[underlying].length == 1) {
            underlyingTokens.push(underlying);
        }
        
        emit SYTokenCreated(underlying, address(syToken), maturity, yieldRate, msg.sender);
        emit MaturityOptionAdded(underlying, maturity, address(syToken));
        
        return address(syToken);
    }
    
    /**
     * @dev Get all available maturities for an underlying asset
     */
    function getAvailableMaturities(address underlying) external view returns (uint256[] memory) {
        return availableMaturities[underlying];
    }
    
    /**
     * @dev Get SY token address for specific underlying and maturity
     */
    function getSYTokenByMaturity(address underlying, uint256 maturity) external view returns (address) {
        return underlyingToSYByMaturity[underlying][maturity];
    }

    /**
     * @dev Get PT and YT token addresses for a SY token
     */
    function getTokenPairByStToken(address syToken) external view returns (address pt, address yt) {
        TokenPair memory pair = syTokenPairs[syToken];
        require(pair.exists, "Token pair does not exist");
        return (pair.pt, pair.yt);
    }
    
    /**
     * @dev Check if a maturity option exists for an underlying
     */
    function hasMaturityOption(address underlying, uint256 maturity) external view returns (bool) {
        return underlyingToSYByMaturity[underlying][maturity] != address(0);
    }
    
    /**
     * @dev Get all underlying tokens that have SY tokens created
     */
    function getAllUnderlyingTokens() external view returns (address[] memory) {
        return underlyingTokens;
    }
    
    /**
     * @dev Wrap underlying tokens into SY tokens with specific maturity
     * 
     * This function creates SY tokens without splitting them into PT + YT.
     * SY tokens are yield-bearing and represent the full value (principal + yield).
     * 
     * USE CASES FOR wrapWithMaturity() (SY tokens only):
     * - Yield Farming: SY tokens automatically earn yield without complexity
     * - Simpler Strategy: Single token exposure instead of managing PT + YT separately
     * - Lower Gas: No additional split transaction required
     * - Liquidity Provision: Use SY tokens in AMM pools or lending protocols
     * - Hold and Earn: Set-and-forget yield earning strategy
     * - Collateral: Use SY tokens as collateral in other DeFi protocols
     * - Future Flexibility: Keep SY tokens to split later when market conditions change
     * 
     * BENEFITS OF SY TOKENS:
     * - Automatic yield accrual (no claiming required)
     * - Single token to manage
     * - Can be split later using split() function
     * - Full exposure to underlying asset performance
     * - Composable with other DeFi protocols
     * 
     * @param underlying The underlying token address to wrap
     * @param amount The amount of underlying tokens to wrap
     * @param maturity The maturity timestamp for the SY token
     * @return syTokenAddress The address of the created SY token
     */
    function wrapWithMaturity(
        address underlying, 
        uint256 amount, 
        uint256 maturity
    ) external nonReentrant returns (address) {
        address syTokenAddress = underlyingToSYByMaturity[underlying][maturity];
        if (syTokenAddress == address(0)) revert SYTokenDoesNotExist();
        
        SYToken syToken = SYToken(syTokenAddress);
        if (syToken.hasMatured()) revert SYTokenHasMatured();
        
        // Direct call - SYToken handles all transfers internally
        // User → SYToken (no factory middleman)
        syToken.wrapFrom(msg.sender, amount);
        
        emit TokensWrapped(msg.sender, underlying, syTokenAddress, amount, maturity);
        
        return syTokenAddress;
    }

    /**
     * @dev Split SY tokens into PT and YT tokens
     * 
     * USE CASES FOR split() (separate from wrapAndSplit):
     * - Users who already hold SY tokens and want to split them later
     * - Users who received SY tokens from other sources (transfers, rewards, etc.)
     * - Timing strategies: wrap first, split when market conditions are favorable
     * - Partial splitting: split only a portion of held SY tokens
     */
    function split(address syTokenAddress, uint256 amount) public nonReentrant returns (address, address) {
        return _split(syTokenAddress, amount, msg.sender, msg.sender);
    }
    
    /**
     * @dev Internal split function that can handle different token holders and recipients
     * @param syTokenAddress Address of the SY token to split
     * @param amount Amount of SY tokens to split
     * @param tokenHolder Address that currently holds the SY tokens
     * @param recipient Address that will receive the PT and YT tokens
     */
    function _split(address syTokenAddress, uint256 amount, address tokenHolder, address recipient) internal returns (address, address) {
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        if (!pair.exists) revert TokenPairDoesNotExist();
        
        SYToken syToken = SYToken(syTokenAddress);
        PTToken ptToken = PTToken(pair.pt);
        YTToken ytToken = YTToken(pair.yt);
        
        if (syToken.hasMatured()) revert SYTokenHasMatured();
        
        // Debug: Check balance before split
        uint256 currentBalance = syToken.balanceOf(tokenHolder);
        // console.log("_split: tokenHolder address: %s, currentBalance %d", tokenHolder, currentBalance);
        // console.log("_split: required amount: %d", amount);
        
        if (currentBalance < amount) {
            // console.log("_split: ERROR!");
            revert InsufficientSYBalance(); // Debug: This will show if error is from _split
        }
        
        // if (syToken.balanceOf(tokenHolder) < amount) revert InsufficientSYBalance();
        
        // Burn SY tokens from token holder
        if (tokenHolder == address(this)) {
            // If factory holds the tokens, use burnFrom
            syToken.burnFrom(address(this), amount);
        } else {
            // If user holds the tokens, transfer to factory (effectively burning)
            syToken.transferFrom(tokenHolder, address(this), amount);
        }
        
        // Mint PT and YT tokens to recipient
        ptToken.mint(recipient, amount);
        ytToken.mint(recipient, amount);
        
        emit TokensSplit(recipient, syTokenAddress, amount, pair.pt, pair.yt);
        
        return (pair.pt, pair.yt);
    }
    
    
    
    
    /**
     * @dev Wrap underlying tokens and immediately split into PT + YT tokens
     * 
     * This is a convenience function that combines wrapWithMaturity() + split() into a single transaction.
     * It's the most common user flow for yield tokenization strategies.
     * 
     * USE CASES FOR wrapAndSplit():
     * - Yield Trading: Sell YT tokens for upfront yield, keep PT for principal protection
     * - Separate Strategies: Trade PT and YT tokens independently on secondary markets
     * - Arbitrage: Take advantage of pricing differences between PT/YT vs SY tokens
     * - Portfolio Diversification: Hold different risk profiles (PT = principal, YT = yield)
     * - Gas Efficiency: Single transaction instead of wrap() + split()
     * 
     * BENEFITS:
     * - Single transaction (lower gas cost)
     * - Single approval required
     * - Atomic operation (all or nothing)
     * - Better user experience
     * 
     * @param underlying The underlying token address to wrap
     * @param amount The amount of underlying tokens to wrap and split
     * @param maturity The maturity timestamp for the SY token
     * @return syTokenAddress The SY token address (for reference)
     * @return ptTokenAddress The PT token address
     * @return ytTokenAddress The YT token address
     */
    function wrapAndSplit(
        address underlying, 
        uint256 amount, 
        uint256 maturity
    ) external nonReentrant returns (address, address, address) {
        // Get SY token address for the specified maturity
        address syTokenAddress = underlyingToSYByMaturity[underlying][maturity];
        if (syTokenAddress == address(0)) revert SYTokenDoesNotExist();
        
        SYToken syToken = SYToken(syTokenAddress);
        if (syToken.hasMatured()) revert SYTokenHasMatured();
        
        // Get PT/YT token pair for this SY token
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        if (!pair.exists) revert TokenPairDoesNotExist();
        
        // Step 1: Transfer underlying tokens from user to factory
        IERC20 underlyingToken = IERC20(underlying);
        underlyingToken.transferFrom(msg.sender, address(this), amount);
        // console.log("wrapAndSplit: Transferred underlying tokens from user to factory");
        
        // Step 2: Mint SY tokens to factory (temporary accounting)
        syToken.mintTo(address(this), amount);
        // console.log("wrapAndSplit: Minted SY tokens to factory, amount:", amount);
        // console.log("wrapAndSplit: Factory SY balance after mint:", syToken.balanceOf(address(this)));
        
        // Step 3: Use internal split function (factory holds SY, user gets PT+YT)
        // console.log("wrapAndSplit: About to call _split");
        _split(syTokenAddress, amount, address(this), msg.sender);
        
        // Emit wrap event (split event emitted by _split)
        emit TokensWrapped(msg.sender, underlying, syTokenAddress, amount, maturity);
        
        return (syTokenAddress, pair.pt, pair.yt);
    }
    
    
    /**
     * @dev Merge PT and YT tokens back into SY tokens
     */
    function merge(address syTokenAddress, uint256 amount) external nonReentrant returns (address) {
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        if (!pair.exists) revert TokenPairDoesNotExist();
        
        SYToken syToken = SYToken(syTokenAddress);
        PTToken ptToken = PTToken(pair.pt);
        YTToken ytToken = YTToken(pair.yt);
        
        if (syToken.hasMatured()) revert SYTokenHasMatured();
        if (ptToken.balanceOf(msg.sender) < amount) revert InsufficientPTBalance();
        if (ytToken.balanceOf(msg.sender) < amount) revert InsufficientYTBalance();
        
        // Burn PT and YT tokens
        ptToken.burn(msg.sender, amount);
        ytToken.burn(msg.sender, amount);
        
        // Mint SY tokens to user
        syToken.mintTo(msg.sender, amount);
        
        emit TokensMerged(msg.sender, syTokenAddress, amount, pair.pt, pair.yt);
        
        return syTokenAddress;
    }
    
    /**
     * @dev Redeem PT tokens for underlying after maturity
     */
    function redeemPT(address ptTokenAddress) external nonReentrant {
        PTToken ptToken = PTToken(ptTokenAddress);
        if (!ptToken.hasMatured()) revert PTTokenHasNotMatured();
        
        uint256 balance = ptToken.balanceOf(msg.sender);
        if (balance == 0) revert NoPTTokensToRedeem();
        
        ptToken.redeem(balance);
        
        emit PTRedeemed(msg.sender, ptTokenAddress, balance);
    }
    
    /**
     * @dev Claim yield from YT tokens
     */
    function claimYT(address ytTokenAddress) external nonReentrant {
        YTToken ytToken = YTToken(ytTokenAddress);
        if (ytToken.hasExpired()) revert YTTokenHasExpired();
        
        uint256 yieldAmount = ytToken.getClaimableYield(msg.sender);
        if (yieldAmount == 0) revert NoYieldToClaim();
        
        ytToken.claimYield();
        
        emit YieldClaimed(msg.sender, ytTokenAddress, yieldAmount);
    }
    
    /**
     * @dev Get all SY tokens
     */
    function getAllSYTokens() external view returns (address[] memory) {
        return allSYTokens;
    }
    
    /**
     * @dev Set maturity creation fee (only owner)
     */
    function setMaturityCreationFee(uint256 _fee) external onlyOwner {
        maturityCreationFee = _fee;
    }
    
    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Get maturity info for an underlying asset
     */
    function getMaturityInfo(address underlying) external view returns (
        uint256[] memory maturities,
        address[] memory syTokens,
        bool[] memory active
    ) {
        uint256[] memory availMaturities = availableMaturities[underlying];
        uint256 length = availMaturities.length;
        
        maturities = new uint256[](length);
        syTokens = new address[](length);
        active = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 maturity = availMaturities[i];
            maturities[i] = maturity;
            syTokens[i] = underlyingToSYByMaturity[underlying][maturity];
            active[i] = maturity > block.timestamp;
        }
    }
}
