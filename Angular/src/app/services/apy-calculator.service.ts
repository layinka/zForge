import { Injectable } from '@angular/core';

export interface YieldCalculation {
  yieldRatePerBlock: number;
  apy: number;
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  blocksPerDay: number;
  blocksPerYear: number;
}

export interface ChainConfig {
  averageBlockTime: number; // seconds
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApyCalculatorService {
  
  // Common blockchain configurations
  private readonly chainConfigs: Record<number, ChainConfig> = {
    1114: { averageBlockTime: 3, name: 'Core Testnet' },    // Core testnet
    1116: { averageBlockTime: 3, name: 'Core Mainnet' },    // Core mainnet
    31337: { averageBlockTime: 12, name: 'Hardhat Local' },  // Local hardhat
    1: { averageBlockTime: 12, name: 'Ethereum' },           // Ethereum
    137: { averageBlockTime: 2, name: 'Polygon' },           // Polygon
    56: { averageBlockTime: 3, name: 'BSC' }                 // Binance Smart Chain
  };

  constructor() {}

  /**
   * Calculate comprehensive yield information from yieldRatePerBlock
   * @param yieldRatePerBlock Yield rate per block in basis points (1 = 0.001%)
   * @param chainId Chain ID to determine block time (optional)
   * @param customBlockTime Custom block time in seconds (optional)
   * @returns Complete yield calculation object
   */
  calculateYieldMetrics(
    yieldRatePerBlock: number, 
    chainId?: number, 
    customBlockTime?: number
  ): YieldCalculation {
    // Determine block time
    const blockTime = customBlockTime || 
                     (chainId && this.chainConfigs[chainId]?.averageBlockTime) || 
                     12; // Default to 12 seconds
    
    // Calculate blocks per time period
    const blocksPerDay = Math.floor(24 * 60 * 60 / blockTime);
    const blocksPerWeek = blocksPerDay * 7;
    const blocksPerMonth = blocksPerDay * 30.44; // Average month
    const blocksPerYear = Math.floor(365.25 * 24 * 60 * 60 / blockTime);
    
    // Convert basis points to decimal (1 basis point = 0.001% = 0.00001)
    const yieldPerBlock = yieldRatePerBlock / 100000;
    
    // Calculate compound yields
    const dailyYield = Math.pow(1 + yieldPerBlock, blocksPerDay) - 1;
    const weeklyYield = Math.pow(1 + yieldPerBlock, blocksPerWeek) - 1;
    const monthlyYield = Math.pow(1 + yieldPerBlock, blocksPerMonth) - 1;
    const apy = Math.pow(1 + yieldPerBlock, blocksPerYear) - 1;
    
    return {
      yieldRatePerBlock,
      apy: apy * 100, // Convert to percentage
      dailyYield: dailyYield * 100,
      weeklyYield: weeklyYield * 100,
      monthlyYield: monthlyYield * 100,
      blocksPerDay: Math.round(blocksPerDay),
      blocksPerYear: blocksPerYear
    };
  }

  /**
   * Calculate simple APY from yield rate per block
   * @param yieldRatePerBlock Yield rate per block in basis points
   * @param chainId Chain ID for block time lookup
   * @returns APY as percentage
   */
  calculateAPY(yieldRatePerBlock: number, chainId?: number): number {
    return this.calculateYieldMetrics(yieldRatePerBlock, chainId).apy;
  }

  /**
   * Calculate expected yield for a specific amount and time period
   * @param principal Principal amount
   * @param yieldRatePerBlock Yield rate per block in basis points
   * @param days Number of days
   * @param chainId Chain ID for block time lookup
   * @returns Expected yield amount
   */
  calculateExpectedYield(
    principal: number, 
    yieldRatePerBlock: number, 
    days: number, 
    chainId?: number
  ): number {
    const blockTime = (chainId && this.chainConfigs[chainId]?.averageBlockTime) || 12;
    const blocksInPeriod = Math.floor(days * 24 * 60 * 60 / blockTime);
    const yieldPerBlock = yieldRatePerBlock / 100000;
    
    // Compound yield calculation
    const totalYield = principal * (Math.pow(1 + yieldPerBlock, blocksInPeriod) - 1);
    return totalYield;
  }

  /**
   * Format APY for display
   * @param apy APY as percentage
   * @param decimals Number of decimal places
   * @returns Formatted APY string
   */
  formatAPY(apy: number, decimals: number = 2): string {
    if (apy === 0 || isNaN(apy)) return 'N/A';
    return `${apy.toFixed(decimals)}%`;
  }

  /**
   * Format yield rate per block for display
   * @param rate Yield rate per block in basis points
   * @returns Formatted rate string
   */
  formatYieldRate(rate: number): string {
    if (rate === 0 || isNaN(rate)) return 'N/A';
    const percentage = (rate / 100000) * 100;
    return `${rate} bp (${percentage.toFixed(3)}% per block)`;
  }

  /**
   * Get chain configuration
   * @param chainId Chain ID
   * @returns Chain configuration or default
   */
  getChainConfig(chainId: number): ChainConfig {
    return this.chainConfigs[chainId] || { averageBlockTime: 12, name: 'Unknown' };
  }

  /**
   * Calculate blocks until a specific date
   * @param targetDate Target date
   * @param chainId Chain ID for block time lookup
   * @returns Number of blocks until target date
   */
  calculateBlocksUntilDate(targetDate: Date, chainId?: number): number {
    const now = new Date();
    const secondsUntil = Math.max(0, (targetDate.getTime() - now.getTime()) / 1000);
    const blockTime = (chainId && this.chainConfigs[chainId]?.averageBlockTime) || 12;
    return Math.floor(secondsUntil / blockTime);
  }

  /**
   * Calculate yield until maturity for PT/YT tokens
   * @param principal Principal amount
   * @param yieldRatePerBlock Yield rate per block in basis points
   * @param maturityDate Maturity date
   * @param chainId Chain ID for block time lookup
   * @returns Expected yield until maturity
   */
  calculateYieldUntilMaturity(
    principal: number,
    yieldRatePerBlock: number,
    maturityDate: Date,
    chainId?: number
  ): number {
    const blocksUntilMaturity = this.calculateBlocksUntilDate(maturityDate, chainId);
    const yieldPerBlock = yieldRatePerBlock / 100000;
    
    // Compound yield until maturity
    return principal * (Math.pow(1 + yieldPerBlock, blocksUntilMaturity) - 1);
  }

  /**
   * Compare APYs between different yield rates
   * @param rates Array of yield rates per block
   * @param chainId Chain ID for block time lookup
   * @returns Array of APYs for comparison
   */
  compareAPYs(rates: number[], chainId?: number): { rate: number; apy: number }[] {
    return rates.map(rate => ({
      rate,
      apy: this.calculateAPY(rate, chainId)
    }));
  }
}
