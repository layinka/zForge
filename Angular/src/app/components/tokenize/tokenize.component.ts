import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
// import { NgxSpinnerService } from 'ngx-spinner';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenService, AvailableToken } from '../../services/token.service';

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
          this.wrapAmount
        );
      }

      await this.blockchainService.wrapToken(this.selectedToken, this.wrapAmount);
      await this.tokenService.refreshAllBalances();
      
      // Reset form
      this.wrapAmount = '';
      
    } catch (error: any) {
      console.error('Error wrapping asset:', error);
      // Handle error (show toast)
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
}
