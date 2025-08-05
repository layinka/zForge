import { effect, Injectable, signal, untracked } from '@angular/core';
import { Web3Service } from './web3';
import { TokenInfo, SYTokenInfo, BlockchainService } from './blockchain.service';
import { getCurrentChainContracts, type ChainContracts, type SupportedChainId } from '../../environments/environment';

export interface AvailableToken {
  address: string;
  name: string;
  symbol: string;
  isYieldBearing: boolean;
  apy?: number;
}

// Multichain token storage interfaces
export interface ChainTokenData {
  tokenBalances: Record<string, string>;
  syTokens: SYTokenInfo[];
  ptTokens: TokenInfo[];
  ytTokens: TokenInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  // Multichain token storage - organized by chain ID
  private chainTokenData = signal<Record<number, ChainTokenData>>({});
  
  // Current chain reactive signals
  public tokenBalances = signal<Record<string, string>>({});
  public syTokens = signal<SYTokenInfo[]>([]);
  public ptTokens = signal<TokenInfo[]>([]);
  public ytTokens = signal<TokenInfo[]>([]);
  public isLoading = signal(false);
  
  // Remove currentChainId signal - use web3Service.chainId directly

  constructor(
    private blockchainService: BlockchainService,
    private web3Service: Web3Service
  ) {
        
    // Effect for chain changes
    // effect(() => {
    //   const chainId = this.web3Service.chainId$();
    //   console.log('ChainId signal changed:', chainId);
    //   if (chainId) {
    //     untracked(() => {
    //       this.updateCurrentChainSignals();
    //       // Refresh data for new chain if wallet is connected
    //       if (this.blockchainService.isConnected()) {
    //         this.refreshAllBalances();
    //       }
    //     });
    //   }
    // });
    
    // // Effect for account changes
    // effect(() => {
    //   const account = this.web3Service.account$();
    //   console.log('Account signal changed:', account);
    //   untracked(() => {
    //     if (account) {
    //       this.refreshAllBalances();
    //     } else {
    //       this.clearBalances();
    //     }
    //   });
    // });
     
        
  }
  
  // Get available tokens for current chain
  getAvailableTokens(): AvailableToken[] {
    const chainId = this.web3Service.chainId || 31337;
    console.log('chain: ', chainId);
    const contracts = getCurrentChainContracts(chainId);
    return [
      {
        address: contracts.mockStCORE,
        name: 'Staked CORE',
        symbol: 'stCORE',
        isYieldBearing: true,
        apy: 5.0
      }
      // Add more tokens per chain as needed
    ];
  }
  
  // Update current chain reactive signals from stored data
  private updateCurrentChainSignals(): void {
    if(this.web3Service.chainId) {
      // Use read-only method to avoid signal modifications
      const chainData = this.getChainDataReadonly(this.web3Service.chainId);
      
      if (chainData) {
        this.tokenBalances.set(chainData.tokenBalances);
        this.syTokens.set(chainData.syTokens);
        this.ptTokens.set(chainData.ptTokens);
        this.ytTokens.set(chainData.ytTokens);
      } else {
        // Initialize empty data if chain doesn't exist
        this.tokenBalances.set({});
        this.syTokens.set([]);
        this.ptTokens.set([]);
        this.ytTokens.set([]);
        
        // Create the chain data for future use (outside of effect)
        this.initializeChainData(this.web3Service.chainId);
      }
    }
  }
  
  // Initialize chain data (separate from reading)
  private initializeChainData(chainId: number): void {
    const allChainData = this.chainTokenData();
    if (!allChainData[chainId]) {
      const newChainData = {
        tokenBalances: {},
        syTokens: [],
        ptTokens: [],
        ytTokens: []
      };
      this.chainTokenData.update(data => ({
        ...data,
        [chainId]: newChainData
      }));
    }
  }
  
  // Get chain data (read-only, safe for templates)
  getChainDataReadonly(chainId: number): ChainTokenData | undefined {
    const allChainData = this.chainTokenData();
    return allChainData[chainId];
  }
  
  // Get or create chain data for specific chain (only use in non-template contexts)
  getChainData(chainId: number): ChainTokenData {
    const allChainData = this.chainTokenData();
    if (!allChainData[chainId]) {
      // Initialize empty data for new chain
      const newChainData = {
        tokenBalances: {},
        syTokens: [],
        ptTokens: [],
        ytTokens: []
      };
      this.chainTokenData.update(data => ({
        ...data,
        [chainId]: newChainData
      }));
      return newChainData;
    }
    return allChainData[chainId];
  }
  
  // Store data for specific chain
  private setChainData(chainId: number, data: Partial<ChainTokenData>): void {
    this.chainTokenData.update(allData => ({
      ...allData,
      [chainId]: {
        ...this.getChainData(chainId),
        ...data
      }
    }));
    
    // Update current signals if this is the active chain
    if (chainId === this.web3Service.chainId) {
      this.updateCurrentChainSignals();
    }
  }

  async refreshAllBalances(): Promise<void> {
    if (!this.blockchainService.isConnected()) return;

    this.isLoading.set(true);
    const chainId = this.web3Service.chainId || 31337;
    
    try {
      await Promise.all([
        this.refreshUserTokens(chainId),
        this.refreshSYTokens(chainId),
        this.refreshPTYTTokens(chainId)
      ]);
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshUserTokens(chainId: number): Promise<void> {
    try {
      const balances: Record<string, string> = {};
      const availableTokens = this.getAvailableTokens();
      
      for (const availableToken of availableTokens) {
        const tokenInfo = await this.blockchainService.getTokenInfo(availableToken.address);
        balances[availableToken.address] = tokenInfo.balance;
      }
      
      this.setChainData(chainId, { tokenBalances: balances });
    } catch (error) {
      console.error('Error refreshing user tokens:', error);
    }
  }

  async refreshSYTokens(chainId: number): Promise<void> {
    try {
      const syTokenAddresses = await this.blockchainService.getAllSYTokens();
      const syTokens: SYTokenInfo[] = [];
      
      for (const address of syTokenAddresses) {
        const syTokenInfo = await this.blockchainService.getSYTokenInfo(address);
        syTokens.push(syTokenInfo);
      }
      
      this.setChainData(chainId, { syTokens });
    } catch (error) {
      console.error('Error refreshing SY tokens:', error);
    }
  }

  async refreshPTYTTokens(chainId: number): Promise<void> {
    try {
      const chainData = this.getChainData(chainId);
      const syTokens = chainData.syTokens;
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
      
      this.setChainData(chainId, { ptTokens, ytTokens });
    } catch (error) {
      console.error('Error refreshing PT/YT tokens:', error);
    }
  }

  private clearBalances(): void {
    this.tokenBalances.set({});
    this.syTokens.set([]);
    this.ptTokens.set([]);
    this.ytTokens.set([]);
  }

  // Helper methods
  getTokenByAddress(address: string): AvailableToken | undefined {
    return this.getAvailableTokens().find((token: AvailableToken) => 
      token.address.toLowerCase() === address.toLowerCase()
    );
  }

  getUserTokenBySymbol(symbol: string): TokenInfo | undefined {
    // Find the token in available tokens
    const availableToken = this.getAvailableTokens().find(token => 
      token.symbol.toLowerCase() === symbol.toLowerCase()
    );
    
    if (!availableToken) return undefined;
    
    // Get balance from tokenBalances
    const balance = this.tokenBalances()[availableToken.address] || '0';
    
    return {
      address: availableToken.address,
      name: availableToken.name,
      symbol: availableToken.symbol,
      balance: balance,
      decimals: 18 // Default to 18 decimals for ERC20 tokens
    };
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
    const normalizedAddress = tokenAddress.toLowerCase();
    
    // Check regular token balances first
    const tokenBalance = this.tokenBalances()[tokenAddress];
    if (tokenBalance) {
      return parseFloat(tokenBalance) >= parseFloat(amount);
    }
    
    // Check SY token balances
    const syToken = this.syTokens().find(t => 
      t.address.toLowerCase() === normalizedAddress
    );
    if (syToken) {
      return parseFloat(syToken.balance) >= parseFloat(amount);
    }
    
    // Check PT token balances
    const ptToken = this.ptTokens().find(t => 
      t.address.toLowerCase() === normalizedAddress
    );
    if (ptToken) {
      return parseFloat(ptToken.balance) >= parseFloat(amount);
    }
    
    // Check YT token balances
    const ytToken = this.ytTokens().find(t => 
      t.address.toLowerCase() === normalizedAddress
    );
    if (ytToken) {
      return parseFloat(ytToken.balance) >= parseFloat(amount);
    }
    
    return false;
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
    const availableTokens = this.getAvailableTokens();
    
    availableTokens.forEach(token => {
      if (addresses[token.symbol]) {
        token.address = addresses[token.symbol];
      }
    });
    
    // Update the environment contracts for current chain
    const chainId = this.web3Service.chainId;
    const contracts = getCurrentChainContracts(chainId);
    Object.assign(contracts, addresses);
  }
}
