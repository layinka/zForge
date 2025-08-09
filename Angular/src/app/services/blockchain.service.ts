import { computed, effect, Injectable, signal } from '@angular/core';
import { readContract, writeContract, multicall } from '@wagmi/core';
import { formatEther, parseEther, formatUnits } from 'viem';
import { environment, ChainContracts } from '../../environments/environment';
import { Web3Service, wagmiAdapter } from './web3';

// Contract ABIs (proper ABI format for wagmi)
const SY_FACTORY_ABI = [
  {
    name: 'wrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'underlying', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'split',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'syTokenAddress', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' }
    ]
  },
  {
    name: 'merge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'syTokenAddress', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'redeemPT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ptTokenAddress', type: 'address' }],
    outputs: []
  },
  {
    name: 'claimYT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ytTokenAddress', type: 'address' }],
    outputs: []
  },
  {
    name: 'getSYToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'underlying', type: 'address' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'getTokenPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'syToken', type: 'address' }],
    outputs: [
      { name: 'pt', type: 'address' },
      { name: 'yt', type: 'address' }
    ]
  },
  {
    name: 'getAllSYTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }]
  }
] as const;

const SY_TOKEN_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'underlyingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'maturity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'hasMatured',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'timeToMaturity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getClaimableYield',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  }
] as const;

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
}

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  // Signals for reactive UI (derived from Web3Service)
  public isConnected = computed(() => !!this.web3Service.account);

  constructor(private web3Service: Web3Service) {
    
  }

  // Convenience getters
  get currentAddress(): string | undefined {
    return this.web3Service.account;
  }

  get currentChainId(): number | undefined {
    return this.web3Service.chainId;
  }

  get isWalletConnected(): boolean {
    return !!this.web3Service.account;
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
          functionName: 'getTokenPair',
          args: [syTokenAddress as `0x${string}`]
        }
      ]
    });

    // Extract results from multicall
    const balance = multicallResults[0].result as bigint;
    const underlying = multicallResults[1].result as string;
    const maturity = multicallResults[2].result as bigint;
    const hasMatured = multicallResults[3].result as boolean;
    const timeToMaturity = multicallResults[4].result as bigint;
    const claimableYield = multicallResults[5].result as bigint;
    const tokenPair = multicallResults[6].result as [string, string];

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
      claimableYield: formatUnits(claimableYield, decimals)
    };
  }

  async approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<void> {
    console.log(spenderAddress as `0x${string}`);
    console.log( parseEther(amount.toString()));
   console.log(tokenAddress, spenderAddress, amount, [spenderAddress as `0x${string}`, parseEther(amount)]);
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async wrapToken(underlyingAddress: string, amount: string) {
    await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'wrap',
      args: [underlyingAddress as `0x${string}`, parseEther(amount)]
    });
  }

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

