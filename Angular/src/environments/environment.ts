// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// Type definitions for better TypeScript support
export interface ChainContracts {
  syFactory: string;
  mockStCORE: string;
  ptToken: string;
  ytToken: string;
}


// All contracts organized by chain ID (using types defined at bottom of file)
const ALL_CONTRACTS: Record<number, ChainContracts> = {
  // Hardhat Local Network (Chain ID: 31337)
  31337: {
    syFactory: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319', // Will be updated after deployment
    mockStCORE: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Will be updated after deployment
    ptToken: '0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e', // Will be updated after deployment
    ytToken: '0xbf9fBFf01664500A33080Da5d437028b07DFcC55', // Will be updated after deployment
  },
  // Core DAO Testnet 2 (Chain ID: 1114)
  1114: {
    syFactory: '0xE3cB58467250bd4178d737A87B87dc7AE00Dad62', // Will be updated after deployment
    mockStCORE: '0x9ED133F814534B89c530909b9EfBAf226e6C9A4f', // Will be updated after deployment
    ptToken: '0x...', // Will be updated after deployment
    ytToken: '0x...', // Will be updated after deployment
  },
  // Core DAO Mainnet (Chain ID: 1116)
  1116: {
    syFactory: '0x...', // Will be updated after deployment
    mockStCORE: '0x...', // Will be updated after deployment
    ptToken: '0x...', // Will be updated after deployment
    ytToken: '0x...', // Will be updated after deployment
  },
  
}

export const environment = {
  production: false,
  // Add common environment settings here
  apiUrl: 'http://localhost:3015/api/v1',
  walletConnectProjectId: '6dc075707b4e66bff8df286aab204770',
  
  // Multichain contract configuration
  contracts: ALL_CONTRACTS,
  
  // Default chain for development
  defaultChainId: 31337,
  
  // Add other development environment variables here
};


/*
 * For easier debugging in development, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
