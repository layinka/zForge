import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService } from '../../services/blockchain.service';
import { ApyCalculatorService, YieldCalculation } from '../../services/apy-calculator.service';

@Component({
  selector: 'app-apy-example',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="apy-dashboard">
      <h3>MockYieldToken APY Calculator</h3>
      
      <!-- Token Selection -->
      <div class="form-group">
        <label>MockYieldToken Address:</label>
        <input 
          type="text" 
          class="form-control" 
          [(ngModel)]="tokenAddress"
          placeholder="0x..."
          (blur)="loadTokenData()"
        >
      </div>
      
      <!-- Current Yield Information -->
      <div class="yield-info-card" *ngIf="yieldData()">
        <h4>Current Yield Information</h4>
        
        <div class="metric-grid">
          <div class="metric">
            <label>Yield Rate per Block:</label>
            <span class="value">{{ apyService.formatYieldRate(yieldData()!.yieldRatePerBlock) }}</span>
          </div>
          
          <div class="metric">
            <label>Annual Percentage Yield (APY):</label>
            <span class="value highlight">{{ apyService.formatAPY(yieldData()!.apy) }}</span>
          </div>
          
          <div class="metric">
            <label>Daily Yield:</label>
            <span class="value">{{ apyService.formatAPY(yieldData()!.dailyYield, 4) }}</span>
          </div>
          
          <div class="metric">
            <label>Weekly Yield:</label>
            <span class="value">{{ apyService.formatAPY(yieldData()!.weeklyYield, 3) }}</span>
          </div>
          
          <div class="metric">
            <label>Monthly Yield:</label>
            <span class="value">{{ apyService.formatAPY(yieldData()!.monthlyYield, 2) }}</span>
          </div>
          
          <div class="metric">
            <label>Blocks per Day:</label>
            <span class="value">{{ yieldData()!.blocksPerDay | number }}</span>
          </div>
        </div>
      </div>
      
      <!-- Yield Calculator -->
      <div class="calculator-card">
        <h4>Yield Calculator</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Token Amount:</label>
            <input 
              type="number" 
              class="form-control" 
              [(ngModel)]="calculatorAmount"
              placeholder="1000"
              (input)="calculateYields()"
            >
          </div>
          
          <div class="form-group">
            <label>Time Period (days):</label>
            <input 
              type="number" 
              class="form-control" 
              [(ngModel)]="timePeriod"
              placeholder="30"
              (input)="calculateYields()"
            >
          </div>
        </div>
        
        <div class="calculation-results" *ngIf="calculatedYield() !== null">
          <h5>Expected Yield Results</h5>
          <div class="result-item">
            <span>Principal Amount:</span>
            <span>{{ calculatorAmount | number:'1.2-2' }} tokens</span>
          </div>
          <div class="result-item">
            <span>Time Period:</span>
            <span>{{ timePeriod }} days</span>
          </div>
          <div class="result-item highlight">
            <span>Expected Yield:</span>
            <span>{{ calculatedYield() | number:'1.6-6' }} tokens</span>
          </div>
          <div class="result-item">
            <span>Final Balance:</span>
            <span>{{ (calculatorAmount + calculatedYield()!) | number:'1.6-6' }} tokens</span>
          </div>
        </div>
      </div>
      
      <!-- APY Comparison -->
      <div class="comparison-card">
        <h4>APY Comparison</h4>
        <p>Compare different yield rates:</p>
        
        <div class="comparison-table">
          <div class="table-header">
            <span>Yield Rate (bp)</span>
            <span>Per Block %</span>
            <span>APY</span>
            <span>Daily Yield</span>
          </div>
          
          <div class="table-row" *ngFor="let comparison of comparisonData">
            <span>{{ comparison.rate }}</span>
            <span>{{ (comparison.rate / 100000 * 100).toFixed(4) }}%</span>
            <span>{{ apyService.formatAPY(comparison.apy) }}</span>
            <span>{{ apyService.formatAPY(comparison.dailyYield, 4) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Maturity Calculator (for PT/YT tokens) -->
      <div class="maturity-card">
        <h4>Yield Until Maturity Calculator</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Maturity Date:</label>
            <input 
              type="datetime-local" 
              class="form-control" 
              [(ngModel)]="maturityDate"
              (change)="calculateMaturityYield()"
            >
          </div>
          
          <div class="form-group">
            <label>Principal Amount:</label>
            <input 
              type="number" 
              class="form-control" 
              [(ngModel)]="maturityAmount"
              placeholder="1000"
              (input)="calculateMaturityYield()"
            >
          </div>
        </div>
        
        <div class="maturity-results" *ngIf="maturityYield() !== null">
          <div class="result-item">
            <span>Blocks Until Maturity:</span>
            <span>{{ blocksUntilMaturity() | number }}</span>
          </div>
          <div class="result-item">
            <span>Days Until Maturity:</span>
            <span>{{ daysUntilMaturity() | number:'1.1-1' }}</span>
          </div>
          <div class="result-item highlight">
            <span>Total Yield Until Maturity:</span>
            <span>{{ maturityYield() | number:'1.6-6' }} tokens</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .apy-dashboard {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .yield-info-card, .calculator-card, .comparison-card, .maturity-card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .metric {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .metric label {
      font-weight: 600;
      color: #6c757d;
      font-size: 0.9rem;
    }
    
    .metric .value {
      font-size: 1.1rem;
      font-weight: 500;
    }
    
    .highlight {
      color: #7c3aed !important;
      font-weight: bold !important;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .form-control {
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .calculation-results, .maturity-results {
      margin-top: 15px;
      padding: 15px;
      background: #e3f2fd;
      border-radius: 6px;
    }
    
    .result-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      padding: 4px 0;
    }
    
    .comparison-table {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    
    .table-header {
      display: contents;
      font-weight: bold;
      background: #e9ecef;
    }
    
    .table-header > span {
      padding: 10px;
      background: #e9ecef;
      border-radius: 4px;
    }
    
    .table-row {
      display: contents;
    }
    
    .table-row > span {
      padding: 8px;
      border-bottom: 1px solid #dee2e6;
    }
  `]
})
export class ApyUsageExampleComponent implements OnInit {
  tokenAddress = '';
  calculatorAmount = 1000;
  timePeriod = 30;
  maturityDate = '';
  maturityAmount = 1000;
  
  yieldData = signal<YieldCalculation | null>(null);
  calculatedYield = signal<number | null>(null);
  maturityYield = signal<number | null>(null);
  blocksUntilMaturity = signal<number>(0);
  daysUntilMaturity = signal<number>(0);
  
  // Comparison data for different yield rates
  comparisonData: Array<{rate: number, apy: number, dailyYield: number}> = [];
  
  constructor(
    private blockchainService: BlockchainService,
    public apyService: ApyCalculatorService
  ) {}
  
  ngOnInit() {
    // Generate comparison data for common yield rates
    this.generateComparisonData();
  }
  
  async loadTokenData() {
    if (!this.tokenAddress) return;
    
    try {
      const { yieldRatePerBlock } = await this.blockchainService.getYieldTokenAPY(this.tokenAddress);
      const chainId = this.blockchainService.currentChainId || 1114;
      
      const yieldMetrics = this.apyService.calculateYieldMetrics(yieldRatePerBlock, chainId);
      this.yieldData.set(yieldMetrics);
      
      // Recalculate dependent values
      this.calculateYields();
      this.calculateMaturityYield();
      
    } catch (error) {
      console.error('Error loading token data:', error);
      this.yieldData.set(null);
    }
  }
  
  calculateYields() {
    const data = this.yieldData();
    if (!data || !this.calculatorAmount || !this.timePeriod) {
      this.calculatedYield.set(null);
      return;
    }
    
    const chainId = this.blockchainService.currentChainId || 1114;
    const yieldAmount = this.apyService.calculateExpectedYield(
      this.calculatorAmount,
      data.yieldRatePerBlock,
      this.timePeriod,
      chainId
    );
    
    this.calculatedYield.set(yieldAmount);
  }
  
  calculateMaturityYield() {
    const data = this.yieldData();
    if (!data || !this.maturityDate || !this.maturityAmount) {
      this.maturityYield.set(null);
      return;
    }
    
    const maturity = new Date(this.maturityDate);
    const chainId = this.blockchainService.currentChainId || 1114;
    
    const blocks = this.apyService.calculateBlocksUntilDate(maturity, chainId);
    const days = (maturity.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    
    this.blocksUntilMaturity.set(blocks);
    this.daysUntilMaturity.set(Math.max(0, days));
    
    if (days > 0) {
      const yieldAmount = this.apyService.calculateYieldUntilMaturity(
        this.maturityAmount,
        data.yieldRatePerBlock,
        maturity,
        chainId
      );
      this.maturityYield.set(yieldAmount);
    } else {
      this.maturityYield.set(0);
    }
  }
  
  private generateComparisonData() {
    // Common yield rates in basis points for comparison
    const rates = [1, 5, 10, 25, 50, 100]; // 0.001% to 0.1% per block
    const chainId = this.blockchainService.currentChainId || 1114;
    
    this.comparisonData = rates.map(rate => {
      const metrics = this.apyService.calculateYieldMetrics(rate, chainId);
      return {
        rate,
        apy: metrics.apy,
        dailyYield: metrics.dailyYield
      };
    });
  }
}
