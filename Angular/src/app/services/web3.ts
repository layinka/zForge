import { Injectable, signal } from '@angular/core';

import { watchAccount,getEnsAddress,  getEnsName, fetchBlockNumber,  createConfig, injected, getChainId,
   watchChainId, getBalance, getBlockNumber, getPublicClient, getWalletClient, 
   reconnect} from '@wagmi/core';

import {AppKitNetwork, hardhat, mainnet} from '@reown/appkit/networks';   

import { getAccount, readContract,  fetchToken } from '@wagmi/core';

import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
// import ROUTER_ABI from '../../assets/abis/router.json';
import { Address, createPublicClient, erc20Abi, FallbackTransport, getContract, http } from 'viem';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { AppKit, createAppKit } from '@reown/appkit';
import { coreDao,coreTestnet2 } from '@wagmi/core/chains';
// import { QueryClient } from '@tanstack/react-query';

// const queryClient = new QueryClient()


export const ALL_CHAINS: AppKitNetwork[] = [ hardhat, coreDao,coreTestnet2 ];

const projectId = environment.walletConnectProjectId;

const metadata = {
  name: 'stellar-fusion',
  description: 'Stellar Fusion +',
  url: 'https://stellar-fusion.app', // url must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

 const supportedChains:[AppKitNetwork, ...AppKitNetwork[]] = (environment.production===true? [coreDao, coreTestnet2, hardhat]: [coreDao, coreTestnet2, hardhat])
 
export const wagmiAdapter = new WagmiAdapter({
  networks: supportedChains,
  projectId,
  transports:{
    [coreDao.id]: http(),
    [coreTestnet2.id]: http(),
    [hardhat.id]: http()

  }
  
  // ssr: true
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const chains: Record<number, AppKitNetwork> = {
  
  1116: coreDao,
  1114: coreTestnet2,
  31337: hardhat
} 

export const useNativeChainCoinList = [
  
]

export function getMultiCallAddress(chainId: number){
  let multicall=chains[chainId].contracts?.multicall3?.address;
  if(chainId===31337){
    multicall="0x4C0eCEa6778C911A0F6806492Fca37C98c3a43Bd";
  }
  if(!multicall){
    throw new Error("Multicall address not found for chainId: " + chainId);
  }
  return multicall;
}


@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  chains: AppKitNetwork[] = supportedChains;
  // 1. Define constants
  projectId = environment.walletConnectProjectId;
  

  // Chain ID signal
  public chainId$ = signal<number | undefined>(undefined);
  
  public get chainId(): number | undefined {
    return this.chainId$();
  }
  

  unwatchNetwork : any;

  public account$ = signal<Address | undefined>(undefined);

  public get account(){
    
    return this.account$();
  }

  unwatchAccount : any;
  

  appKit!: AppKit;

  constructor() {
    

    this.appKit = createAppKit({
      adapters: [wagmiAdapter],
      networks: supportedChains,
      // defaultNetwork: celo,
      metadata: metadata,
      projectId,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#8725ac',
      },
      // enableInjected: true,
      features: {
        analytics: true,
        swaps: false,
        email: true,
        // socials: true,
        onramp: true
        // emailShowWallets: true
      }
    })

    reconnect(wagmiAdapter.wagmiConfig).then(()=>{
      const chainId = getChainId(wagmiAdapter.wagmiConfig);
      if(chainId){
        console.log("W 1 ChainId: ", chainId);
        this.chainId$.set(chainId);
      }
      const address = getAccount(wagmiAdapter.wagmiConfig);
      console.log("W 1 Address: ", address.address);
      if(address && address.isConnected){
        
        this.account$.set(address.address);
      }
    });

    // setTimeout(() => {
    //   const chainId = getChainId(wagmiAdapter.wagmiConfig);
    //   if(chainId){
    //     console.log("W 1 ChainId: ", chainId);
    //     this.chainId$.set(chainId);
    //   }
    // }, 300);

    

    //Update chainId on change
    this.unwatchNetwork = watchChainId(wagmiAdapter.wagmiConfig,      
      {
        onChange:  async (chainId) => {

          console.log("ChainId changed to: ", chainId);
          
          if(chainId ){
            
            this.chainId$.set(chainId );

          }else{
            this.chainId$.set(undefined);
          }
        },
      }
    )

    this.unwatchAccount = watchAccount(wagmiAdapter.wagmiConfig, {
      onChange: (account) => {
        
        if(account && account.isConnected){
          this.account$.set(account.address);
        }else{
          this.account$.set(undefined);
        }
        
      }
    }) 

  }


  async getAccountInfo() {
    return getAccount(wagmiConfig);
  }

  async getBalanceNativeCurrency(account: Address) {
    return await getBalance(wagmiConfig,{
      address: account,      
    });
  }


  async getBalanceERC20(tokenAddress: `0x${string}`, account: `0x${string}`) {
    return await getBalance(wagmiConfig,{
      address: account,
       
      token: tokenAddress
    });
  }

  async getTokenInfo(tokenAddress: `0x${string}`, chainId?: number|undefined, formatUnits: any | undefined = undefined) {
    return await fetchToken(wagmiConfig,{
      address: tokenAddress,
      chainId,
      formatUnits
    });
  }
 

  

  async fetchBlockNumber(){
    const blockNumber = await getBlockNumber(
      wagmiConfig,
      {
        chainId: this.chainId
      }
    )
    return blockNumber
  }


  async getERC20Allowance(tokenAddress: `0x${string}`, contractToApprove: `0x${string}`, account: `0x${string}`, chainId? :number) {
    
    const allowance = await readContract(wagmiConfig, {
      address: tokenAddress,
      abi: erc20Abi,
      chainId,
      functionName: 'allowance',
      args: [account, contractToApprove]
    })
    
    return allowance;
  }

  async fetchTotalSupply(tokenAddress: string){
    const t= await this.getTokenInfo(tokenAddress as `0x${string}`)
    if(t){
      return t.totalSupply.value
    }

    return undefined
  }


  async checkTokenApproval(
    tokenAddress: `0x${string}`, 
    owner: `0x${string}`, 
    spender: `0x${string}`, 
    amount: bigint
  ): Promise<boolean> {
    try {
      const approvedAmount = await readContract(wagmiConfig, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender]
      });

      return approvedAmount >= amount;
    } catch (error) {
      console.error('Error checking token approval:', error);
     
    }
    return false;
  }

  /**
   * Returns the explorer URL for a transaction hash on the current or specified chain.
   * @param txHash The transaction hash (with or without 0x prefix)
   * @param chainId Optional chain ID; defaults to the current chain
   * @returns The full explorer URL for the transaction, or empty string if not available
   */
  public getExplorerTxUrl(txHash: string, chainId?: number): string {
    const id = chainId ?? this.chainId;
    if (!id || !txHash) return '';
    const chain = this.chains.find(c => c.id === id);
    const explorerUrl: string | undefined = chain?.blockExplorers?.default?.url;
    if (!explorerUrl) return '';
    return `${explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;
  }

}
