import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute } from '@angular/router';
import { BlockchainService, SYTokenInfo } from '../../services/blockchain.service';
import { TokenService } from '../../services/token.service';
import { AppToastService } from '../../services/app-toast.service';

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
  parseFloat = parseFloat;
  
  // Selected SY token for filtering PT/YT tokens
  selectedSYToken = signal<SYTokenInfo | null>(null);
  
  // Computed signals for filtered PT/YT tokens
  filteredPTTokens = computed(() => {
    const ptTokens = this.tokenService.ptTokens();
    const selectedSY = this.selectedSYToken();
    
    if (!selectedSY) {
      return ptTokens.filter(token => parseFloat(token.balance || '0') > 0);
    }
    
    // Filter by SY token's PT address and non-zero balance
    return ptTokens.filter(token => 
      token.address.toLowerCase() === selectedSY.ptAddress.toLowerCase() &&
      parseFloat(token.balance || '0') > 0
    );
  });
  
  filteredYTTokens = computed(() => {
    const ytTokens = this.tokenService.ytTokens();
    const selectedSY = this.selectedSYToken();
    
    if (!selectedSY) {
      return ytTokens.filter(token => parseFloat(token.balance || '0') > 0);
    }
    
    // Filter by SY token's YT address and non-zero balance
    return ytTokens.filter(token => 
      token.address.toLowerCase() === selectedSY.ytAddress.toLowerCase() &&
      parseFloat(token.balance || '0') > 0
    );
  });
  
  // Computed signal for available SY tokens for merging (with non-zero balance)
  availableSYTokensForMerge = computed(() => {
    return this.tokenService.syTokens().filter(token => 
      parseFloat(token.balance || '0') > 0
    );
  });
  
  // New properties for staking results
  stakingResult = signal<{
    underlying: string;
    maturity: string;
    syTokenInfo?: SYTokenInfo;
    underlyingTokenInfo?: any;
    showCelebration: boolean;
  } | null>(null);
  
  private route = inject(ActivatedRoute);
  private toastService = inject(AppToastService);

  constructor(
    public blockchainService: BlockchainService,
    public tokenService: TokenService
  ) {}

  async ngOnInit() {
    if (this.blockchainService.isConnected()) {
      this.tokenService.refreshAllBalances();
    }
    
    // Check for staking result route parameters
    const underlying = this.route.snapshot.paramMap.get('u');
    const maturity = this.route.snapshot.paramMap.get('m');
    
    if (underlying && maturity) {
      await this.loadStakingResult(underlying, maturity);
      // Set the selected SY token based on route parameters
      await this.setSelectedSYTokenFromParams(underlying, maturity);
    }
  }
  
  private async setSelectedSYTokenFromParams(underlying: string, maturity: string) {
    // Wait for tokens to be loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const syTokens = this.tokenService.syTokens();
    const matchingSYToken = syTokens.find(token => 
      token.underlying.toLowerCase() === underlying.toLowerCase() &&
      token.maturity.toString() === maturity
    );
    
    if (matchingSYToken) {
      this.selectedSYToken.set(matchingSYToken);
    }
  }
  
  // Method to manually select SY token for filtering
  selectSYToken(syToken: SYTokenInfo | null) {
    this.selectedSYToken.set(syToken);
  }
  
  // Handle SY token filter change from dropdown
  onSYTokenFilterChange(syTokenAddress: string) {
    if (!syTokenAddress) {
      this.selectedSYToken.set(null);
      return;
    }
    
    const syToken = this.tokenService.syTokens().find(token => 
      token.address === syTokenAddress
    );
    
    this.selectedSYToken.set(syToken || null);
  }
  
  // Format maturity timestamp to readable date
  formatMaturity(maturity: number): string {
    return this.tokenService.formatMaturity(maturity);
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
    
    return (ptToken && ytToken && parseFloat(ptToken.balance) > 0 && parseFloat(ytToken.balance) > 0) || false;
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

  // New methods for staking results
  async loadStakingResult(underlying: string, maturity: string) {
    try {
      // Get SY token address for this underlying and maturity
      const syTokenAddress = await this.blockchainService.getSYTokenByMaturity(underlying, BigInt(maturity));
      
      if (syTokenAddress && syTokenAddress !== '0x0000000000000000000000000000000000000000') {
        // Load SY token info and underlying token info
        const [syTokenInfo, underlyingTokenInfo] = await Promise.all([
          this.blockchainService.getSYTokenInfo(syTokenAddress),
          this.blockchainService.getTokenInfo(underlying)
        ]);
        
        this.stakingResult.set({
          underlying,
          maturity,
          syTokenInfo,
          underlyingTokenInfo,
          showCelebration: true
        });
        
        // Show success message
        this.toastService.show('Success!', 'Your tokens have been successfully staked!');
        
        // Hide celebration after 5 seconds
        setTimeout(() => {
          const current = this.stakingResult();
          if (current) {
            this.stakingResult.set({ ...current, showCelebration: false });
          }
        }, 5000);
        
        // Refresh balances to show new PT/YT tokens
        await this.tokenService.refreshAllBalances();
      }
    } catch (error) {
      console.error('Error loading staking result:', error);
      this.toastService.error('Error', 'Failed to load staking information');
    }
  }

  formatMaturityDate(maturity: string): string {
    const date = new Date(Number(maturity) * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  }

  calculateAPY(yieldRate: bigint): number {
    return Number(yieldRate) / 100; // Convert basis points to percentage
  }

  dismissStakingResult() {
    this.stakingResult.set(null);
  }
}
