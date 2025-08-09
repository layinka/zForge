// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SYToken.sol";
import "./PTToken.sol";
import "./YTToken.sol";

/**
 * @title SYFactory with User-Chosen Maturity
 * @dev Enhanced factory contract allowing users to choose their own maturity periods
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
    mapping(address => mapping(uint256 => bool)) public maturityExists;
    
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
        if (maturityExists[underlying][maturity]) revert MaturityAlreadyExists();
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
        maturityExists[underlying][maturity] = true;
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
        return maturityExists[underlying][maturity];
    }
    
    /**
     * @dev Get all underlying tokens that have SY tokens created
     */
    function getAllUnderlyingTokens() external view returns (address[] memory) {
        return underlyingTokens;
    }
    
    /**
     * @dev Wrap underlying tokens into SY tokens with specific maturity
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
     * @dev Backward compatibility: wrap with default/first available maturity
     */
    function wrap(address underlying, uint256 amount) external nonReentrant returns (address) {
        uint256[] memory maturities = availableMaturities[underlying];
        if (maturities.length == 0) revert NoMaturityOptionsAvailable();
        
        // Use the first available maturity that hasn't expired
        uint256 selectedMaturity = 0;
        for (uint256 i = 0; i < maturities.length; i++) {
            if (maturities[i] > block.timestamp) {
                selectedMaturity = maturities[i];
                break;
            }
        }
        if (selectedMaturity == 0) revert NoValidMaturityOptionsAvailable();
        
        // Direct internal call to avoid external call overhead
        address syTokenAddress = underlyingToSYByMaturity[underlying][selectedMaturity];
        SYToken syToken = SYToken(syTokenAddress);
        syToken.wrapFrom(msg.sender, amount);
        
        emit TokensWrapped(msg.sender, underlying, syTokenAddress, amount, selectedMaturity);
        
        return syTokenAddress;
    }
    
    /**
     * @dev Split SY tokens into PT and YT tokens
     */
    function split(address syTokenAddress, uint256 amount) external nonReentrant returns (address, address) {
        TokenPair memory pair = syTokenPairs[syTokenAddress];
        if (!pair.exists) revert TokenPairDoesNotExist();
        
        SYToken syToken = SYToken(syTokenAddress);
        PTToken ptToken = PTToken(pair.pt);
        YTToken ytToken = YTToken(pair.yt);
        
        if (syToken.hasMatured()) revert SYTokenHasMatured();
        if (syToken.balanceOf(msg.sender) < amount) revert InsufficientSYBalance();
        
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
