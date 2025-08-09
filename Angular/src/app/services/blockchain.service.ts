import { computed, effect, Injectable, signal } from '@angular/core';
import { readContract, writeContract, multicall, waitForTransactionReceipt, simulateContract } from '@wagmi/core';
import { formatEther, parseEther, formatUnits } from 'viem';
import { environment, ChainContracts } from '../../environments/environment';
import { Web3Service, getMultiCallAddress, wagmiAdapter } from './web3';
import { SY_FACTORY_ABI, SY_TOKEN_ABI, PT_TOKEN_ABI, YT_TOKEN_ABI, ERC20_ABI } from '../abis';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
}

export interface SYTokenInfo extends TokenInfo {
  underlying: string;
  maturity: number;
  hasMatured: boolean;
  timeToMaturity: number;
  ptAddress: string;
  ytAddress: string;
  claimableYield: string;
  yieldRate: bigint;
}

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  // Signals for reactive UI (derived from Web3Service)
  public isConnected = computed(() => !!this.web3Service.account$());

  constructor(private web3Service: Web3Service) {
    
  }

  // Convenience getters
  get currentAddress(): string | undefined {
    return this.web3Service.account$();
  }

  get currentChainId(): number | undefined {
    return this.web3Service.chainId$();
  }


  // Get contracts for current chain
  getCurrentChainContracts(): ChainContracts {
    const chainId = this.web3Service.chainId || 31337;
    return environment.contracts[chainId] || environment.contracts[31337];
  }

  // Contract interaction methods
  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    const address = userAddress || this.currentAddress;
    if (!address) throw new Error('No wallet connected');
    
    const balance = await readContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    }) as bigint;
    
    return formatEther(balance);
  }

  async getTokenInfo(tokenAddress: string, userAddress?: string): Promise<TokenInfo> {
    const address = userAddress || this.currentAddress;
    if (!address) throw new Error('No wallet connected');
    
    const [name, symbol, decimals, balance] = await Promise.all([
      readContract(wagmiAdapter.wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name'
      }) as Promise<string>,
      readContract(wagmiAdapter.wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }) as Promise<string>,
      readContract(wagmiAdapter.wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }) as Promise<number>,
      readContract(wagmiAdapter.wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`]
      }) as Promise<bigint>
    ]);

    return {
      address: tokenAddress,
      name,
      symbol,
      balance: formatUnits(balance, decimals),
      decimals
    };
  }

  async getSYTokenInfo(syTokenAddress: string, userAddress?: string): Promise<SYTokenInfo> {
    const address = userAddress || this.currentAddress;
    if (!address) throw new Error('No wallet connected');
    
    // Use multicall3 for efficient batch calls
    const multicallResults = await multicall(wagmiAdapter.wagmiConfig, {
      contracts: [
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`]
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'underlyingToken'
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'maturity'
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'hasMatured'
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'timeToMaturity'
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'getClaimableYield',
          args: [address as `0x${string}`]
        },
        {
          address: this.getCurrentChainContracts().syFactory as `0x${string}`,
          abi: SY_FACTORY_ABI,
          functionName: 'getTokenPairByStToken',
          args: [syTokenAddress as `0x${string}`]
        },
        {
          address: syTokenAddress as `0x${string}`,
          abi: SY_TOKEN_ABI,
          functionName: 'yieldRate'
        }
      ],
      //Todo - Change to work with chain passed in as arg instead of conneted chain
      multicallAddress: getMultiCallAddress(this.web3Service.chainId$() || 31337)
    });

    // Extract results from multicall
    const balance = multicallResults[0].result as bigint;
    const underlying = multicallResults[1].result as string;
    const maturity = multicallResults[2].result as bigint;
    const hasMatured = multicallResults[3].result as boolean;
    const timeToMaturity = multicallResults[4].result as bigint;
    const claimableYield = multicallResults[5].result as bigint;
    const tokenPair = multicallResults[6].result as [string, string];
    const yieldRate = multicallResults[7].result as bigint;

    const [name, symbol, decimals] = await Promise.all([
      readContract(wagmiAdapter.wagmiConfig, {
        address: underlying as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name'
      }) as Promise<string>,
      readContract(wagmiAdapter.wagmiConfig, {
        address: underlying as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }) as Promise<string>,
      readContract(wagmiAdapter.wagmiConfig, {
        address: underlying as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }) as Promise<number>
    ]);

    return {
      address: syTokenAddress,
      name: `SY-${name}`,
      symbol: `SY-${symbol}`,
      balance: formatUnits(balance, decimals),
      decimals,
      underlying,
      maturity: Number(maturity),
      hasMatured,
      timeToMaturity: Number(timeToMaturity),
      ptAddress: tokenPair[0],
      ytAddress: tokenPair[1],
      claimableYield: formatUnits(claimableYield, decimals),
      yieldRate
    };
  }

  async getMaturityInfo(underlyingAddress: string): Promise<{ syTokens: string[] }> {
    try {
      const maturities = await this.getAvailableMaturities(underlyingAddress);
      const syTokens: string[] = [];
      
      for (const maturity of maturities) {
        const syTokenAddress = await readContract(wagmiAdapter.wagmiConfig, {
          address: this.getCurrentChainContracts().syFactory as `0x${string}`,
          abi: SY_FACTORY_ABI,
          functionName: 'getSYTokenByMaturity',
          args: [underlyingAddress as `0x${string}`, BigInt(maturity)]
        }) as string;
        
        syTokens.push(syTokenAddress);
      }
      
      return { syTokens };
    } catch (error) {
      console.error('Error getting maturity info:', error);
      return { syTokens: [] };
    }
  }

  async approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<void> {
    console.log(spenderAddress as `0x${string}`);
    console.log( parseEther(amount.toString()));
   console.log(tokenAddress, spenderAddress, amount, [spenderAddress as `0x${string}`, parseEther(amount)]);
    let hash = await writeContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress as `0x${string}`, parseEther(amount)]
    });
    await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
  }

  // async wrapToken(underlyingAddress: string, amount: string) {
  //   await writeContract(wagmiAdapter.wagmiConfig, {
  //     address: this.getCurrentChainContracts().syFactory as `0x${string}`,
  //     abi: SY_FACTORY_ABI,
  //     functionName: 'wrap',
  //     args: [underlyingAddress as `0x${string}`, parseEther(amount)]
  //   });
  // }

  async splitSYToken(syTokenAddress: string, amount: string): Promise<void> {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'split',
      args: [syTokenAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async mergePTYT(syTokenAddress: string, amount: string): Promise<void> {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'merge',
      args: [syTokenAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async redeemPT(ptTokenAddress: string): Promise<void> {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'redeemPT',
      args: [ptTokenAddress as `0x${string}`]
    });
  }

  async claimYT(ytTokenAddress: string): Promise<void> {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'claimYT',
      args: [ytTokenAddress as `0x${string}`]
    });
  }

  async getAllSYTokens(): Promise<string[]> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getAllSYTokens',
      args: []
    }) as string[];
  }

  async getAllUnderlyingTokens(): Promise<string[]> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getAllUnderlyingTokens' as any
    }) as string[];
  }

  async getAvailableMaturities(underlyingToken: string): Promise<bigint[]> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getAvailableMaturities' as any,
      args: [underlyingToken as `0x${string}`]
    }) as unknown as bigint[];
  }

  async getAllowance(tokenAddress: string, spenderAddress: string, userAddress?: string): Promise<string> {
    const address = userAddress || this.currentAddress;
    if (!address) {
      throw new Error('No wallet connected');
    }

    const allowance = await readContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, spenderAddress as `0x${string}`]
    }) as bigint;

    const tokenInfo = await this.getTokenInfo(tokenAddress);
    return formatUnits(allowance, tokenInfo.decimals);
  }

  async wrapWithMaturity(underlyingAddress: string, amount: string, maturity: bigint): Promise<void> {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'wrapWithMaturity',
      args: [
        underlyingAddress as `0x${string}`,
        parseEther(amount),
        maturity
      ]
    });
  }

  async wrapAndSplit(underlyingAddress: string, amount: string, maturity: bigint): Promise<{ syToken: string, ptToken: string, ytToken: string }> {
    try {
      const hash = await writeContract(wagmiAdapter.wagmiConfig, {
        address: this.getCurrentChainContracts().syFactory as `0x${string}`,
        abi: SY_FACTORY_ABI,
        functionName: 'wrapAndSplit',
        args: [
          underlyingAddress as `0x${string}`,
          parseEther(amount),
          maturity
        ]
      });
      
      await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
      // The function returns (syTokenAddress, ptTokenAddress, ytTokenAddress)
      // For now, we'll return the addresses by querying the contract
      const syTokenAddress = await this.getSYTokenByMaturity(underlyingAddress, maturity);
      const tokenPair = await this.getTokenPairByStToken(syTokenAddress);
      
      return {
        syToken: syTokenAddress,
        ptToken: tokenPair.pt,
        ytToken: tokenPair.yt
      };
    } catch (error: any) {
      // Enhanced error handling to capture raw error data
      console.log('🔍 Raw wagmi error in wrapAndSplit:', error);
      
      // Try to extract raw error data from the RPC response
      if (error?.cause?.cause?.data) {
        console.log('📍 Found raw error data in cause.cause.data:', error.cause.cause.data);
        // Create a new error with the raw data for the ErrorDecoder
        const enhancedError = {
          ...error,
          rawErrorData: error.cause.cause.data
        };
        throw enhancedError;
      }
      
      // If no raw data found, throw the original error
      throw error;
    }
  }

  async getSYTokenByMaturity(underlyingAddress: string, maturity: bigint): Promise<string> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getSYTokenByMaturity',
      args: [underlyingAddress as `0x${string}`, maturity]
    }) as string;
  }

  async getTokenPairByStToken(syTokenAddress: string): Promise<{ pt: string, yt: string }> {
    const result = await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getTokenPairByStToken',
      args: [syTokenAddress as `0x${string}`]
    }) as [string, string];
    
    return {
      pt: result[0],
      yt: result[1]
    };
  }

  // Utility methods
  formatTimeToMaturity(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  formatBalance(balance: string, decimals: number = 18): string {
   //dont chnge for now
    return balance;
  }

  /**
   * Calculate APY from yieldRatePerBlock for MockYieldToken contracts
   * @param yieldRatePerBlock Yield rate per block in basis points (1 = 0.001%)
   * @param blocksPerYear Number of blocks per year (default: Core blockchain ~12s blocks)
   * @returns APY as a percentage
   */
  calculateAPYFromBlockRate(yieldRatePerBlock: number, blocksPerYear: number = 2628000): number {
    // Convert basis points to decimal (1 basis point = 0.001% = 0.00001)
    const yieldPerBlock = yieldRatePerBlock / 100000;
    
    // Calculate compound annual growth
    // APY = (1 + yieldPerBlock)^blocksPerYear - 1
    const apy = Math.pow(1 + yieldPerBlock, blocksPerYear) - 1;
    
    // Return as percentage
    return apy * 100;
  }

  /**
   * Get yield rate and calculate APY for a MockYieldToken
   * @param tokenAddress Address of the MockYieldToken contract
   * @returns Object with yieldRatePerBlock and calculated APY
   */
  async getYieldTokenAPY(tokenAddress: string): Promise<{yieldRatePerBlock: number, apy: number}> {
    try {
      const yieldRatePerBlock = await readContract(wagmiAdapter.wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'yieldRatePerBlock',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }]
          }
        ] as const,
        functionName: 'yieldRatePerBlock'
      }) as bigint;

      const rate = Number(yieldRatePerBlock);
      const apy = this.calculateAPYFromBlockRate(rate);

      return { yieldRatePerBlock: rate, apy };
    } catch (error) {
      console.error('Error getting yield token APY:', error);
      return { yieldRatePerBlock: 0, apy: 0 };
    }
  }

  /**
   * Calculate estimated blocks per year based on average block time
   * @param averageBlockTimeSeconds Average time between blocks in seconds
   * @returns Estimated blocks per year
   */
  calculateBlocksPerYear(averageBlockTimeSeconds: number): number {
    const secondsPerYear = 365.25 * 24 * 60 * 60; // Account for leap years
    return Math.floor(secondsPerYear / averageBlockTimeSeconds);
  }

  /**
   * Get current block number
   * @returns Current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    try {
      const blockNumber = await readContract(wagmiAdapter.wagmiConfig, {
        address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        abi: [
          {
            name: 'number',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }]
          }
        ] as const,
        functionName: 'number'
      }) as bigint;
      
      return Number(blockNumber);
    } catch (error) {
      // Fallback: use block.number from a simple contract call
      console.warn('Could not get block number directly, using fallback');
      return 0;
    }
  }
}

