import { Component, effect, OnInit, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
// import { NgxSpinnerService } from 'ngx-spinner';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenService, AvailableToken } from '../../services/token.service';
import { AppToastService } from '@app/services/app-toast.service';
import { Web3Service } from '@app/services/web3';

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  apy: number;
  maturities: { maturity: bigint; syTokenAddress: string; }[];
}

@Component({
  selector: 'app-tokenize',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './tokenize.component.html',
  styleUrl: './tokenize.component.scss'
})
export class TokenizeComponent implements OnInit {
  selectedToken = '';
  wrapAmount = '';
  selectedSYToken = '';
  splitAmount = '';
  isProcessing = signal(false);
  availableTokens = signal<TokenInfo[]>([]);

  constructor(
    public blockchainService: BlockchainService,
    public tokenService: TokenService,
    public toastService: AppToastService,
    public web3Service: Web3Service,
    // private spinner: NgxSpinnerService
  ) {
    effect(() => {
      const account = this.web3Service.account$();
      console.log('TKN Account signal changed:', account);
      untracked(() => {
        if (account) {
          this.tokenService.refreshAllBalances();
          this.loadAvailableTokens();
        } 
      });
    });
  }

  ngOnInit() {
    
  }

  async loadAvailableTokens() {
    try {
      // Get all underlying tokens from SYFactory
      const underlyingTokens = await this.blockchainService.getAllUnderlyingTokens();
      
      const tokens: TokenInfo[] = [];
      
      for (const underlyingAddress of underlyingTokens) {
        try {
          // Get token info (name, symbol)
          const tokenInfo = await this.blockchainService.getTokenInfo(underlyingAddress);
          
          // Get available maturities for this underlying token
          const maturities = await this.blockchainService.getAvailableMaturities(underlyingAddress);
          
          // Get maturity info (SY token addresses and active status)
          const maturityInfo = await this.blockchainService.getMaturityInfo(underlyingAddress);
          
          // Build maturity options with SY token addresses
          const maturityOptions = maturities.map((maturity, index) => ({
            maturity: BigInt(maturity),
            syTokenAddress: maturityInfo.syTokens[index] || '0x0'
          })).filter(option => option.syTokenAddress !== '0x0');
          
          if (maturityOptions.length > 0) {
            // Calculate APY from the first available SY token's yield rate
            let apy = 0;
            try {
              const firstSYToken = maturityOptions[0].syTokenAddress;
              const syTokenInfo = await this.blockchainService.getSYTokenInfo(firstSYToken);
              console.log('SY Token Info:', syTokenInfo);
              // Convert yield rate (basis points) to APY percentage
              // yieldRate is in basis points (1 basis point = 0.01%)
              apy = Number(syTokenInfo.yieldRate) / 100; // Convert basis points to percentage
            } catch (apyError) {
              console.warn('Could not calculate APY for token:', tokenInfo.symbol, apyError);
              apy = 0;
            }
            
            tokens.push({
              address: underlyingAddress,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              apy: apy,
              maturities: maturityOptions
            });
          }
        } catch (tokenError) {
          console.warn('Error processing underlying token:', underlyingAddress, tokenError);
        }
      }
      
      this.availableTokens.set(tokens);
    } catch (error) {
      console.error('Error loading available tokens:', error);
      this.toastService.error('Error', 'Failed to load available tokens');
    }
  }

  formatMaturityPeriod(maturity: bigint): string {
    const now = Math.floor(Date.now() / 1000);
    const maturitySeconds = Number(maturity);
    const diffSeconds = maturitySeconds - now;
    
    if (diffSeconds <= 0) return 'Expired';
    
    const days = Math.floor(diffSeconds / (24 * 60 * 60));
    const months = Math.floor(days / 30);
    
    if (months >= 12) {
      const years = Math.floor(months / 12);
      return `${years}Y`;
    } else if (months >= 1) {
      return `${months}M`;
    } else {
      return `${days}D`;
    }
  }

  selectToken(token: TokenInfo) {
    this.selectedToken = token.address;
    // Scroll to wrap section
    const wrapSection = document.querySelector('.row.g-4');
    if (wrapSection) {
      wrapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async wrapAsset() {
    if (!this.selectedToken || !this.wrapAmount) return;

    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      // Check if approval is needed
      if (this.needsApproval()) {
        await this.blockchainService.approveToken(
          this.selectedToken,
          this.blockchainService.getCurrentChainContracts().syFactory, // SY Factory address
          this.wrapAmount.toString()
        );
      }

      await this.blockchainService.wrapToken(this.selectedToken, this.wrapAmount.toString());
      await this.tokenService.refreshAllBalances();
      this.toastService.show('Wrap successful', 'Your asset has been wrapped into SY tokens');
      
      // Reset form
      this.wrapAmount = '';
      
    } catch (error: any) {
      console.error('Error wrapping asset:', error);
      this.toastService.error('Wrap failed', 'Failed to wrap asset');
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  async splitSYToken() {
    if (!this.selectedSYToken || !this.splitAmount) return;

    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      await this.blockchainService.splitSYToken(this.selectedSYToken, this.splitAmount);
      await this.tokenService.refreshAllBalances();
      
      // Reset form
      this.splitAmount = '';
      
    } catch (error: any) {
      console.error('Error splitting SY token:', error);
      // Handle error (show toast)
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  setMaxAmount() {
    const balance = this.getTokenBalance(this.selectedToken);
    this.wrapAmount = balance;
  }

  setMaxSYAmount() {
    const balance = this.getSYTokenBalance(this.selectedSYToken);
    this.splitAmount = balance;
  }

  getTokenBalance(tokenAddress: string): string {
    const chainData = this.tokenService.getChainDataReadonly(this.blockchainService.currentChainId ?? 1114);
    const tokenBalance = chainData?.tokenBalances[tokenAddress];
    return tokenBalance ? this.blockchainService.formatBalance(tokenBalance) : '0';
  }

  getSYTokenBalance(syTokenAddress: string): string {
    const syToken = this.tokenService.syTokens().find(t => t.address === syTokenAddress);
    return syToken ? this.blockchainService.formatBalance(syToken.balance) : '0';
  }

  getSelectedTokenAPY(): string {
    const token = this.tokenService.getTokenByAddress(this.selectedToken);
    return token?.apy ? this.tokenService.formatAPY(token.apy) : 'N/A';
  }

  getSelectedSYMaturity(): string {
    const syToken = this.tokenService.syTokens().find(t => t.address === this.selectedSYToken);
    return syToken ? this.tokenService.formatMaturity(syToken.maturity) : 'N/A';
  }

  needsApproval(): boolean {
    // Simplified - in real implementation, check actual allowance
    return true;
  }

  /**
   * Get APY for a MockYieldToken contract
   * @param tokenAddress Address of the MockYieldToken contract
   * @returns Promise resolving to APY percentage string
   */
  async getTokenAPY(tokenAddress: string): Promise<string> {
    try {
      const { apy } = await this.blockchainService.getYieldTokenAPY(tokenAddress);
      return apy.toFixed(2) + '%';
    } catch (error) {
      console.error('Error getting token APY:', error);
      return 'N/A';
    }
  }

  /**
   * Get detailed yield information for a MockYieldToken
   * @param tokenAddress Address of the MockYieldToken contract
   * @returns Promise resolving to yield information object
   */
  async getYieldInfo(tokenAddress: string): Promise<{yieldRatePerBlock: number, apy: string, blocksPerDay: number}> {
    try {
      const { yieldRatePerBlock, apy } = await this.blockchainService.getYieldTokenAPY(tokenAddress);
      
      // Core blockchain has ~12 second blocks
      const blocksPerDay = this.blockchainService.calculateBlocksPerYear(12) / 365.25;
      
      return {
        yieldRatePerBlock,
        apy: apy.toFixed(2) + '%',
        blocksPerDay: Math.round(blocksPerDay)
      };
    } catch (error) {
      console.error('Error getting yield info:', error);
      return {
        yieldRatePerBlock: 0,
        apy: 'N/A',
        blocksPerDay: 0
      };
    }
  }

  /**
   * Calculate expected daily yield for a given amount
   * @param tokenAddress Address of the MockYieldToken contract
   * @param amount Amount of tokens
   * @returns Promise resolving to expected daily yield string
   */
  async calculateDailyYield(tokenAddress: string, amount: number): Promise<string> {
    try {
      const { yieldRatePerBlock } = await this.blockchainService.getYieldTokenAPY(tokenAddress);
      
      // Convert basis points to decimal
      const yieldPerBlock = yieldRatePerBlock / 100000;
      
      // Core blockchain: ~12 second blocks = 7200 blocks per day
      const blocksPerDay = 24 * 60 * 60 / 12;
      
      // Calculate daily yield
      const dailyYield = amount * yieldPerBlock * blocksPerDay;
      
      return dailyYield.toFixed(6);
    } catch (error) {
      console.error('Error calculating daily yield:', error);
      return '0';
    }
  }
}
