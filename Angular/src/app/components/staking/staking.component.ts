import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService, TokenInfo } from '../../services/blockchain.service';
import { TokenService } from '../../services/token.service';
import { AppToastService } from '../../services/app-toast.service';
import { Web3Service } from '../../services/web3';
import { formatUnits, parseUnits } from 'viem';
import { environment } from 'src/environments/environment';
import { ErrorDecoder } from '../../utils/error-decoder';

interface MaturityOption {
  maturity: bigint;
  syTokenAddress: string;
  apy: number;
  daysToMaturity: number;
  maturityDate: Date;
}

@Component({
  selector: 'app-staking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staking.component.html',
  styleUrl: './staking.component.scss'
})
export class StakingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private blockchainService = inject(BlockchainService);
  private tokenService = inject(TokenService);
  private toastService = inject(AppToastService);
  private web3Service = inject(Web3Service);

  // Signals
  underlyingToken = signal<TokenInfo | null>(null);
  maturityOptions = signal<MaturityOption[]>([]);
  selectedMaturity = signal<MaturityOption | null>(null);
  depositAmount = signal<string>('');
  isLoading = signal<boolean>(false);
  currentStep = signal<number>(1);
  userBalance = signal<string>('0');
  allowance = signal<string>('0');

  // Computed
  isWalletConnected = computed(() => !!this.web3Service.account$());
  hasInsufficientBalance = computed(() => {
    const amount = this.depositAmount();
    const balance = this.userBalance();
    if (!amount || !balance) return false;
    try {
      const amountBigInt = parseUnits(amount, this.underlyingToken()?.decimals || 18);
      const balanceBigInt = parseUnits(balance, this.underlyingToken()?.decimals || 18);
      return amountBigInt > balanceBigInt;
    } catch {
      return false;
    }
  });

  needsApproval = computed(() => {
    const amount = this.depositAmount();
    const allowanceAmount = this.allowance();
    if (!amount || !allowanceAmount) return false;
    try {
      const amountBigInt = parseUnits(amount, this.underlyingToken()?.decimals || 18);
      const allowanceBigInt = parseUnits(allowanceAmount, this.underlyingToken()?.decimals || 18);
      return amountBigInt > allowanceBigInt;
    } catch {
      return false;
    }
  });

  canProceed = computed(() => {
    return this.selectedMaturity() && 
           this.depositAmount() && 
           !this.hasInsufficientBalance() && 
           this.isWalletConnected();
  });

  async ngOnInit() {
    const tokenAddress = this.route.snapshot.paramMap.get('tokenAddress');
    if (!tokenAddress) {
      this.router.navigate(['/tokenize']);
      return;
    }

    await this.loadTokenData(tokenAddress);
  }

  async loadTokenData(tokenAddress: string) {
    this.isLoading.set(true);
    try {
      // Load token info
      const tokenInfo = await this.blockchainService.getTokenInfo(tokenAddress);
      this.underlyingToken.set(tokenInfo);

      // Load user balance
      const balance = await this.blockchainService.getTokenBalance(tokenAddress);
      this.userBalance.set(balance);

      // Load maturity options
      const maturities = await this.blockchainService.getAvailableMaturities(tokenAddress);
      const maturityInfo = await this.blockchainService.getMaturityInfo(tokenAddress);

      const options: MaturityOption[] = [];
      for (let i = 0; i < maturities.length; i++) {
        const maturity = BigInt(maturities[i]);
        const syTokenAddress = maturityInfo.syTokens[i];
        
        if (syTokenAddress && syTokenAddress !== '0x0000000000000000000000000000000000000000') {
          try {
            const syTokenInfo = await this.blockchainService.getSYTokenInfo(syTokenAddress);
            const maturityDate = new Date(Number(maturity) * 1000);
            const daysToMaturity = Math.ceil((maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const apy = Number(syTokenInfo.yieldRate) / 100; // Convert basis points to percentage

            options.push({
              maturity,
              syTokenAddress,
              apy,
              daysToMaturity,
              maturityDate
            });
          } catch (error) {
            console.warn(`Failed to load SY token info for ${syTokenAddress}:`, error);
          }
        }
      }

      this.maturityOptions.set(options);
    } catch (error) {
      console.error('Error loading token data:', error);
      this.toastService.error('Error', 'Failed to load token data');
      this.router.navigate(['/tokenize']);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectMaturity(option: MaturityOption) {
    this.selectedMaturity.set(option);
    this.currentStep.set(2);
  }

  

  async approveFactoryToken() {
    const token = this.underlyingToken();
    const selectedMat = this.selectedMaturity();
    const amount = this.depositAmount();
    
    if (!token || !selectedMat || !amount) return;
    try {
      await this.blockchainService.approveToken(
        token.address,
        environment.contracts[this.web3Service.chainId!].syFactory as `0x${string}`,// selectedMat.syTokenAddress,
        amount.toString()// type is actually a number 
      );
      
      this.toastService.show('Success', 'Token approved successfully');
    } catch (error) {
      console.error('Error approving token:', error);
      this.toastService.error('Error', 'Failed to approve token');
    } finally {
      
    }
  }

  async depositToken() {
    const token = this.underlyingToken();
    const selectedMat = this.selectedMaturity();
    const amount = this.depositAmount();
    
    if (!token || !selectedMat || !amount) return;

    this.isLoading.set(true);
    try {
      const allowance = await this.blockchainService.getAllowance(token.address, environment.contracts[this.web3Service.chainId!].syFactory as `0x${string}`);
      console.log('Allowance:', environment.contracts[this.web3Service.chainId!].syFactory as `0x${string}`, allowance);
      console.log('Amount:', amount);
      if (parseFloat(allowance) < parseFloat(amount)) {
        await this.approveFactoryToken();
      }
      // Call the wrap function on SYFactory
      await this.blockchainService.wrapAndSplit(
        token.address,
        amount.toString(),
        selectedMat.maturity
      );
      
      this.toastService.show('Success', 'Tokens staked successfully!');
      
      // Navigate to PTYT details page with route parameters
      this.router.navigate(['/ptyt', token.address, selectedMat.maturity.toString()]);
    } catch (error) {
      console.error('Error depositing token:', error);
      
      // Try to decode Solidity custom error
      const decodedError = ErrorDecoder.extractErrorFromException(error);
      
      if (decodedError) {
        console.log('🔍 Decoded Solidity Error:');
        console.log(`  Error Name: ${decodedError.errorName}`);
        console.log(`  Error Message: ${decodedError.errorMessage}`);
        console.log(`  Error Signature: ${decodedError.signature}`);
        console.log(`  Raw Data: ${decodedError.rawData}`);
        
        // Show user-friendly error message
        this.toastService.error('Transaction Failed', decodedError.errorMessage);
      } else {
        // Fallback for non-custom errors
        let errorMessage = 'Failed to deposit token';
        
        if (error && typeof error === 'object') {
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          } else if ('reason' in error && typeof error.reason === 'string') {
            errorMessage = error.reason;
          }
        }
        
        console.log('❌ Non-custom error:', errorMessage);
        this.toastService.error('Error', errorMessage);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  formatMaturityDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  }

  setMaxAmount() {
    this.depositAmount.set(this.userBalance());
  }

  goBack() {
    if (this.currentStep() === 2) {
      this.currentStep.set(1);
      this.selectedMaturity.set(null);
    } else {
      this.router.navigate(['/tokenize']);
    }
  }
}
