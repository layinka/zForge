import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
// import { NgxSpinnerService } from 'ngx-spinner';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenService, AvailableToken } from '../../services/token.service';
import { AppToastService } from '@app/services/app-toast.service';

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

  constructor(
    public blockchainService: BlockchainService,
    public tokenService: TokenService,
    public toastService: AppToastService,
    // private spinner: NgxSpinnerService
  ) {}

  ngOnInit() {
    if (this.blockchainService.isConnected()) {
      this.tokenService.refreshAllBalances();
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
