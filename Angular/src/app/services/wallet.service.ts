import { Injectable, signal, computed, inject } from '@angular/core';
import { Token } from '../models/token.model';
import { ASSETS } from '../constants/asset-list';
import { disconnect } from '@wagmi/core';
import { Web3Service, wagmiConfig } from './web3';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private web3Service = inject(Web3Service);
  
  // Wallet state - reusing web3 service signals
  private _balance = signal<Record<string, string>>({});
  
  // Public signals - delegating to web3 service
  isConnected = computed(() => !!this.web3Service.account);
  account = computed(() => this.web3Service.account || null);
  chainId = computed(() => this.web3Service.chainId || null);
  balance = this._balance.asReadonly();
  
  constructor() {
    // Set up wallet listeners
    this.setupWalletListeners();
  }
  
  /**
   * Set up wallet event listeners
   */
  private setupWalletListeners() {
    // Subscribe to account changes from web3 service
    this.web3Service.account$.subscribe(account => {
      if (account) {
        this.updateBalances(account);
      } else {
        this._balance.set({});
      }
    });
  }
  
  /**
   * Connect wallet - delegates to web3 service AppKit
   */
  async connect() {
    try {
      // Use the web3 service's AppKit to open the connection modal
      this.web3Service.appKit.open();
      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return false;
    }
  }
  
  /**
   * Disconnect wallet
   */
  async disconnect() {
    try {
      await disconnect(wagmiConfig);
      this._balance.set({});
      return true;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      return false;
    }
  }
  
  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.isConnected();
  }
  
  /**
   * Get current account address
   */
  getAddress(): string | null {
    return this.account();
  }
  
  /**
   * Get current chain ID
   */
  getChainId(): number | null {
    return this.chainId();
  }
  
  /**
   * Get token balance
   */
  getTokenBalance(tokenAddress: string): string {
    return this._balance()[tokenAddress.toLowerCase()] || '0';
  }
  
  /**
   * Update token balances using web3 service
   */
  private async updateBalances(account: string) {
    try {
      const balances: Record<string, string> = {};
      
      // Get native ETH balance
      const nativeBalance = await this.web3Service.getBalanceNativeCurrency(account as `0x${string}`);
      balances['0x0000000000000000000000000000000000000000'] = nativeBalance.formatted;
      
      // Get ERC20 token balances for common tokens
      const tokenAddresses = [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      ];
      
      for (const tokenAddress of tokenAddresses) {
        try {
          const tokenBalance = await this.web3Service.getBalanceERC20(
            tokenAddress as `0x${string}`,
            account as `0x${string}`
          );
          balances[tokenAddress.toLowerCase()] = tokenBalance.formatted;
        } catch (error) {
          console.warn(`Failed to fetch balance for token ${tokenAddress}:`, error);
          balances[tokenAddress.toLowerCase()] = '0';
        }
      }
      
      // Add mock Stellar balances (these would come from Stellar network in real implementation)
      balances['XLM'] = '10000';
      balances['USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'] = '5000';
      
      this._balance.set(balances);
    } catch (error) {
      console.error('Failed to update balances:', error);
      // Set empty balances on error
      this._balance.set({});
    }
  }
  
  /**
   * Check if a token is native (e.g., ETH, XLM)
   */
  async isNativeToken(tokenAddress: string): Promise<boolean> {
    const token = ASSETS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    return !!token?.isNative;
  }
  
  /**
   * Get token allowance using web3 service
   */
  async getAllowance(tokenAddress: string, spender?: string): Promise<string> {
    try {
      const account = spender || this.getAddress();
      if (!account) {
        throw new Error('No account connected');
      }
      
      const allowance = await this.web3Service.getERC20Allowance(
        tokenAddress as `0x${string}`,
        spender as `0x${string}`,
        account as `0x${string}`,
        this.getChainId() || undefined
      );
      
      return allowance.toString();
    } catch (error) {
      console.error('Failed to get allowance:', error);
      return '0';
    }
  }
  
  /**
   * Check if token is approved for spending
   */
  async checkTokenApproval(
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<boolean> {
    try {
      const account = this.getAddress();
      if (!account) {
        throw new Error('No account connected');
      }
      
      return await this.web3Service.checkTokenApproval(
        tokenAddress as `0x${string}`,
        account as `0x${string}`,
        spender as `0x${string}`,
        BigInt(amount)
      );
    } catch (error) {
      console.error('Failed to check token approval:', error);
      return false;
    }
  }
  
  /**
   * Approve token spending
   */
  async approveToken(tokenAddress: string, amount: string): Promise<string> {
    // In a real implementation, this would call the token's approve function
    // For now, return a mock transaction hash
    return `0x${Math.random().toString(16).substring(2, 66)}`;
  }
  
  /**
   * Lock tokens in the bridge contract (Ethereum to Stellar)
   */
  async lockTokens(
    tokenAddress: string,
    amount: string,
    targetChain: string,
    targetToken: string,
    targetAddress: string
  ): Promise<string> {
    // In a real implementation, this would call the bridge contract
    // For now, return a mock transaction hash
    return `0x${Math.random().toString(16).substring(2, 66)}`;
  }
  
  /**
   * Burn and transfer tokens (Stellar to Ethereum)
   */
  async burnAndTransfer(
    tokenAddress: string,
    amount: string,
    targetChain: string,
    targetToken: string,
    targetAddress: string
  ): Promise<string> {
    // In a real implementation, this would call the Stellar bridge contract
    // For now, return a mock transaction hash
    return `0x${Math.random().toString(16).substring(2, 66)}`;
  }
  
  /**
   * Swap tokens on the same chain
   */
  async swapTokens(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    recipient: string
  ): Promise<string> {
    // In a real implementation, this would call a DEX router
    // For now, return a mock transaction hash
    return `0x${Math.random().toString(16).substring(2, 66)}`;
  }
  
  /**
   * Switch to a specific network
   */
  async switchNetwork(chainId: number): Promise<boolean> {
    try {
      // Use the web3 service's AppKit to switch networks
      // The network switching will be handled by the wallet provider
      // and the web3 service will automatically update the chainId signal
      this.web3Service.appKit.switchNetwork(this.web3Service.chains.find(c => c.id === chainId)!);
      return true;
    } catch (error) {
      console.error('Failed to switch network:', error);
      return false;
    }
  }
}
