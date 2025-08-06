import { Injectable } from '@angular/core';
import { writeContract, readContract } from '@wagmi/core';
import { parseEther, formatEther } from 'viem';
import { environment, ChainContracts } from '../../environments/environment';
import { wagmiAdapter, Web3Service } from './web3';

// Contract ABIs
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

const ERC20_ABI = [
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
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
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
  }
] as const;

@Injectable({ providedIn: 'root' })
export class ContractService {
  constructor(private web3Service: Web3Service) {}

  // Get contracts for current chain
  private getCurrentChainContracts(): ChainContracts {
    const chainId = this.web3Service.chainId || 31337;
    return environment.contracts[chainId] || environment.contracts[31337];
  }

  // SY Factory contract interactions
  async wrapToken(underlying: string, amount: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'wrap',
      args: [underlying as `0x${string}`, parseEther(amount)]
    });
  }

  async splitSYToken(syTokenAddress: string, amount: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'split',
      args: [syTokenAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async mergePTYT(syTokenAddress: string, amount: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'merge',
      args: [syTokenAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async redeemPT(ptTokenAddress: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'redeemPT',
      args: [ptTokenAddress as `0x${string}`]
    });
  }

  async claimYT(ytTokenAddress: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'claimYT',
      args: [ytTokenAddress as `0x${string}`]
    });
  }

  // ERC20 token interactions
  async approveToken(tokenAddress: string, spenderAddress: string, amount: string) {
    return await writeContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress as `0x${string}`, parseEther(amount)]
    });
  }

  async getTokenAllowance(tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<string> {
    const allowance = await readContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`]
    }) as bigint;
    
    return formatEther(allowance);
  }

  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    const balance = await readContract(wagmiAdapter.wagmiConfig, {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`]
    }) as bigint;
    
    return formatEther(balance);
  }

  // Read-only contract calls
  async getSYToken(underlyingAddress: string): Promise<string> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getSYToken',
      args: [underlyingAddress as `0x${string}`]
    }) as string;
  }

  async getTokenPair(syTokenAddress: string): Promise<[string, string]> {
    const result = await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getTokenPair',
      args: [syTokenAddress as `0x${string}`]
    }) as [string, string];
    
    return result;
  }

  async getAllSYTokens(): Promise<string[]> {
    return await readContract(wagmiAdapter.wagmiConfig, {
      address: this.getCurrentChainContracts().syFactory as `0x${string}`,
      abi: SY_FACTORY_ABI,
      functionName: 'getAllSYTokens',
      args: []
    }) as string[];
  }
}
