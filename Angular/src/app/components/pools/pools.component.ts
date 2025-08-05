import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenService } from '../../services/token.service';
import { FormsModule, NgModel } from '@angular/forms';

interface PoolInfo {
  id: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  tvl: number;
  apy: number;
  volume24h: number;
  fee: number;
  type: 'PT' | 'YT';
}

@Component({
  selector: 'app-pools',
  standalone: true,
  imports: [CommonModule, NgbModule,  FormsModule],
  templateUrl: './pools.component.html',
  styleUrl: './pools.component.scss'
})
export class PoolsComponent implements OnInit {
  selectedFilter = 'all';
  searchQuery = '';
  
  // Mock pool data
  ptPools = signal<PoolInfo[]>([
    {
      id: '0x1234...5678',
      token0: 'PT-stCORE',
      token1: 'CORE',
      token0Symbol: 'PT-stCORE',
      token1Symbol: 'CORE',
      tvl: 450000,
      apy: 12.5,
      volume24h: 25000,
      fee: 0.3,
      type: 'PT'
    },
    {
      id: '0x2345...6789',
      token0: 'PT-stCORE',
      token1: 'USDC',
      token0Symbol: 'PT-stCORE',
      token1Symbol: 'USDC',
      tvl: 320000,
      apy: 8.7,
      volume24h: 18000,
      fee: 0.3,
      type: 'PT'
    }
  ]);

  ytPools = signal<PoolInfo[]>([
    {
      id: '0x3456...7890',
      token0: 'YT-stCORE',
      token1: 'CORE',
      token0Symbol: 'YT-stCORE',
      token1Symbol: 'CORE',
      tvl: 280000,
      apy: 15.2,
      volume24h: 32000,
      fee: 0.3,
      type: 'YT'
    },
    {
      id: '0x4567...8901',
      token0: 'YT-stCORE',
      token1: 'USDC',
      token0Symbol: 'YT-stCORE',
      token1Symbol: 'USDC',
      tvl: 190000,
      apy: 11.8,
      volume24h: 15000,
      fee: 0.3,
      type: 'YT'
    }
  ]);

  userPositions = signal<Array<{
    poolId: string;
    poolName: string;
    liquidity: number;
    share: number;
    earnedFees: number;
  }>>([]);

  constructor(
    public blockchainService: BlockchainService,
    public tokenService: TokenService
  ) {}

  ngOnInit() {
    if (this.blockchainService.isConnected()) {
      this.loadUserPositions();
    }
  }

  filteredPools() {
    const allPools = [...this.ptPools(), ...this.ytPools()];
    
    let filtered = allPools;
    
    // Filter by type
    if (this.selectedFilter !== 'all') {
      filtered = filtered.filter(pool => pool.type === this.selectedFilter);
    }
    
    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(pool => 
        pool.token0Symbol.toLowerCase().includes(query) ||
        pool.token1Symbol.toLowerCase().includes(query) ||
        pool.id.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

  openTradeModal(pool: PoolInfo) {
    // In a real implementation, this would open a trading modal or redirect to DEX
    const dexUrl = `https://app.uniswap.org/#/swap?inputCurrency=${pool.token0}&outputCurrency=${pool.token1}`;
    window.open(dexUrl, '_blank');
  }

  openLiquidityModal(pool: PoolInfo) {
    // In a real implementation, this would open a liquidity provision modal
    const dexUrl = `https://app.uniswap.org/#/add/${pool.token0}/${pool.token1}`;
    window.open(dexUrl, '_blank');
  }

  private loadUserPositions() {
    // Mock user positions - in real implementation, fetch from blockchain
    this.userPositions.set([
      {
        poolId: '0x1234...5678',
        poolName: 'PT-stCORE/CORE',
        liquidity: 5000,
        share: 1.11,
        earnedFees: 125.50
      }
    ]);
  }
}
