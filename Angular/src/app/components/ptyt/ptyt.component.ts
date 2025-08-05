import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenService } from '../../services/token.service';

@Component({
  selector: 'app-ptyt',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './ptyt.component.html',
  styleUrl: './ptyt.component.scss'
})
export class PtytComponent implements OnInit {
  selectedSYForMerge = '';
  mergeAmount = '';
  isProcessing = signal(false);
  parseFloat=parseFloat;

  constructor(
    public blockchainService: BlockchainService,
    public tokenService: TokenService
  ) {}

  ngOnInit() {
    if (this.blockchainService.isConnected()) {
      this.tokenService.refreshAllBalances();
    }
  }

  async redeemPT(ptTokenAddress: string) {
    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      await this.blockchainService.redeemPT(ptTokenAddress);
      await this.tokenService.refreshAllBalances();
    } catch (error: any) {
      console.error('Error redeeming PT:', error);
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  async claimYield(ytTokenAddress: string) {
    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      await this.blockchainService.claimYT(ytTokenAddress);
      await this.tokenService.refreshAllBalances();
    } catch (error: any) {
      console.error('Error claiming yield:', error);
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  async claimAllYield() {
    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      const ytTokens = this.tokenService.ytTokens();
      for (const ytToken of ytTokens) {
        if (!this.isYTExpired(ytToken.address) && parseFloat(this.getYTClaimableYield(ytToken.address)) > 0) {
          await this.blockchainService.claimYT(ytToken.address);
        }
      }
      await this.tokenService.refreshAllBalances();
    } catch (error: any) {
      console.error('Error claiming all yield:', error);
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  async mergePTYT() {
    if (!this.selectedSYForMerge || !this.mergeAmount) return;

    this.isProcessing.set(true);
    // this.spinner.show();

    try {
      await this.blockchainService.mergePTYT(this.selectedSYForMerge, this.mergeAmount);
      await this.tokenService.refreshAllBalances();
      
      // Reset form
      this.mergeAmount = '';
    } catch (error: any) {
      console.error('Error merging PT/YT:', error);
    } finally {
      this.isProcessing.set(false);
      // this.spinner.hide();
    }
  }

  setMaxMergeAmount() {
    this.mergeAmount = this.getMaxMergeAmount();
  }

  getMaxMergeAmount(): string {
    if (!this.selectedSYForMerge) return '0';
    
    const syToken = this.tokenService.syTokens().find(t => t.address === this.selectedSYForMerge);
    if (!syToken) return '0';
    
    const ptToken = this.tokenService.ptTokens().find(t => t.address === syToken.ptAddress);
    const ytToken = this.tokenService.ytTokens().find(t => t.address === syToken.ytAddress);
    
    if (!ptToken || !ytToken) return '0';
    
    return Math.min(parseFloat(ptToken.balance), parseFloat(ytToken.balance)).toString();
  }

  canMerge(syTokenAddress: string): boolean {
    const syToken = this.tokenService.syTokens().find(t => t.address === syTokenAddress);
    if (!syToken) return false;
    
    const ptToken = this.tokenService.ptTokens().find(t => t.address === syToken.ptAddress);
    const ytToken = this.tokenService.ytTokens().find(t => t.address === syToken.ytAddress);
    
    return (ptToken && ytToken && parseFloat(ptToken.balance) > 0 && parseFloat(ytToken.balance) > 0)|| false;
  }

  getPTMaturity(ptTokenAddress: string): string {
    const syToken = this.tokenService.syTokens().find(t => t.ptAddress === ptTokenAddress);
    return syToken ? this.tokenService.formatMaturity(syToken.maturity) : 'N/A';
  }

  isPTMatured(ptTokenAddress: string): boolean {
    const syToken = this.tokenService.syTokens().find(t => t.ptAddress === ptTokenAddress);
    return syToken ? syToken.hasMatured : false;
  }

  getYTClaimableYield(ytTokenAddress: string): string {
    const syToken = this.tokenService.syTokens().find(t => t.ytAddress === ytTokenAddress);
    return syToken ? this.blockchainService.formatBalance(syToken.claimableYield) : '0';
  }

  getYTExpiry(ytTokenAddress: string): string {
    const syToken = this.tokenService.syTokens().find(t => t.ytAddress === ytTokenAddress);
    return syToken ? this.tokenService.formatMaturity(syToken.maturity) : 'N/A';
  }

  isYTExpired(ytTokenAddress: string): boolean {
    const syToken = this.tokenService.syTokens().find(t => t.ytAddress === ytTokenAddress);
    return syToken ? syToken.hasMatured : false;
  }
}
