import { Injectable, signal } from '@angular/core';
import { Web3Service } from './web3';
import { TokenInfo, SYTokenInfo, BlockchainService } from './blockchain.service';

export interface AvailableToken {
  address: string;
  name: string;
  symbol: string;
  isYieldBearing: boolean;
  apy?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  // Available tokens for wrapping
  private readonly AVAILABLE_TOKENS: AvailableToken[] = [
    {
      address: '0x...', // Will be updated with actual MockStCORE address
      name: 'Staked CORE',
      symbol: 'stCORE',
      isYieldBearing: true,
      apy: 5.0
    }
    // Add more tokens here as needed
  ];

  // Signals for reactive UI
  public availableTokens = signal<AvailableToken[]>(this.AVAILABLE_TOKENS);
  public userTokens = signal<TokenInfo[]>([]);
  public syTokens = signal<SYTokenInfo[]>([]);
  public ptTokens = signal<TokenInfo[]>([]);
  public ytTokens = signal<TokenInfo[]>([]);
  public isLoading = signal(false);

  constructor(
    private blockchainService: BlockchainService,
    private web3Service: Web3Service
  ) {
    // Subscribe to connection changes to refresh balances
    this.web3Service.account$.subscribe(account => {
      if (account) {
        this.refreshAllBalances();
      } else {
        this.clearBalances();
      }
    });
  }

  async refreshAllBalances(): Promise<void> {
    if (!this.blockchainService.isWalletConnected) return;

    this.isLoading.set(true);
    
    try {
      await Promise.all([
        this.refreshUserTokens(),
        this.refreshSYTokens(),
        this.refreshPTYTTokens()
      ]);
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshUserTokens(): Promise<void> {
    try {
      const tokens: TokenInfo[] = [];
      
      for (const availableToken of this.AVAILABLE_TOKENS) {
        const tokenInfo = await this.blockchainService.getTokenInfo(availableToken.address);
        tokens.push(tokenInfo);
      }
      
      this.userTokens.set(tokens);
    } catch (error) {
      console.error('Error refreshing user tokens:', error);
    }
  }

  async refreshSYTokens(): Promise<void> {
    try {
      const syTokenAddresses = await this.blockchainService.getAllSYTokens();
      const syTokens: SYTokenInfo[] = [];
      
      for (const address of syTokenAddresses) {
        const syTokenInfo = await this.blockchainService.getSYTokenInfo(address);
        syTokens.push(syTokenInfo);
      }
      
      this.syTokens.set(syTokens);
    } catch (error) {
      console.error('Error refreshing SY tokens:', error);
    }
  }

  async refreshPTYTTokens(): Promise<void> {
    try {
      const syTokens = this.syTokens();
      const ptTokens: TokenInfo[] = [];
      const ytTokens: TokenInfo[] = [];
      
      for (const syToken of syTokens) {
        // Get PT token info
        const ptTokenInfo = await this.blockchainService.getTokenInfo(syToken.ptAddress);
        ptTokens.push({
          ...ptTokenInfo,
          name: `PT-${syToken.name.replace('SY-', '')}`,
          symbol: `PT-${syToken.symbol.replace('SY-', '')}`
        });
        
        // Get YT token info
        const ytTokenInfo = await this.blockchainService.getTokenInfo(syToken.ytAddress);
        ytTokens.push({
          ...ytTokenInfo,
          name: `YT-${syToken.name.replace('SY-', '')}`,
          symbol: `YT-${syToken.symbol.replace('SY-', '')}`
        });
      }
      
      this.ptTokens.set(ptTokens);
      this.ytTokens.set(ytTokens);
    } catch (error) {
      console.error('Error refreshing PT/YT tokens:', error);
    }
  }

  private clearBalances(): void {
    this.userTokens.set([]);
    this.syTokens.set([]);
    this.ptTokens.set([]);
    this.ytTokens.set([]);
  }

  // Helper methods
  getTokenByAddress(address: string): AvailableToken | undefined {
    return this.AVAILABLE_TOKENS.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    );
  }

  getUserTokenBySymbol(symbol: string): TokenInfo | undefined {
    return this.userTokens().find(token => 
      token.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  getSYTokenByUnderlying(underlyingAddress: string): SYTokenInfo | undefined {
    return this.syTokens().find(token => 
      token.underlying.toLowerCase() === underlyingAddress.toLowerCase()
    );
  }

  getPTTokenByAddress(address: string): TokenInfo | undefined {
    return this.ptTokens().find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    );
  }

  getYTTokenByAddress(address: string): TokenInfo | undefined {
    return this.ytTokens().find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    );
  }

  // Calculate total portfolio value (mock implementation)
  getTotalPortfolioValue(): number {
    const syValue = this.syTokens().reduce((sum, token) => 
      sum + parseFloat(token.balance), 0
    );
    
    const ptValue = this.ptTokens().reduce((sum, token) => 
      sum + parseFloat(token.balance), 0
    );
    
    const ytValue = this.ytTokens().reduce((sum, token) => 
      sum + parseFloat(token.balance), 0
    );
    
    return syValue + ptValue + ytValue;
  }

  // Get claimable yield across all YT tokens
  getTotalClaimableYield(): number {
    return this.syTokens().reduce((sum, token) => 
      sum + parseFloat(token.claimableYield), 0
    );
  }

  // Check if user has sufficient balance for operation
  hasSufficientBalance(tokenAddress: string, amount: string): boolean {
    const token = this.userTokens().find(t => 
      t.address.toLowerCase() === tokenAddress.toLowerCase()
    ) || this.syTokens().find(t => 
      t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!token) return false;
    
    return parseFloat(token.balance) >= parseFloat(amount);
  }

  // Format APY for display
  formatAPY(apy: number): string {
    return `${apy.toFixed(2)}%`;
  }

  // Format time until maturity
  formatMaturity(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = timestamp - now;
    
    if (timeLeft <= 0) return 'Matured';
    
    return this.blockchainService.formatTimeToMaturity(timeLeft);
  }

  // Check if token has matured
  hasMatured(timestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return timestamp <= now;
  }

  // Update token addresses after deployment
  updateTokenAddresses(addresses: { [key: string]: string }): void {
    this.AVAILABLE_TOKENS.forEach(token => {
      if (addresses[token.symbol]) {
        token.address = addresses[token.symbol];
      }
    });
    
    this.availableTokens.set([...this.AVAILABLE_TOKENS]);
  }
}
