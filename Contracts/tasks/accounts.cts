import {normalizeHardhatNetworkAccountsConfig } from "hardhat/internal/core/providers/util.js";

import { BN, bufferToHex, privateToAddress, toBuffer } from "ethereumjs-util";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function accounts (taskArguments: any, hre: HardhatRuntimeEnvironment , runSuper: any) {
  const networkConfig = hre.config.networks[hre.network.name??"mainnet"]
  // const networkConfig = hre.config.networks[taskArguments.networkName??"mainnet"]
  // console.log('hre.network:',hre.network)
  // console.log('taskArguments:', taskArguments)
  console.log(networkConfig.accounts)

  //@ts-ignore
  const accounts = normalizeHardhatNetworkAccountsConfig(networkConfig.accounts)

  console.log("Accounts")
  console.log("========")

  for (const [index, account] of accounts.entries()) {
    
    let address ;
    let privateKey ;
    if( typeof account=== 'string'){
      address = bufferToHex(privateToAddress(toBuffer(account)))
      privateKey = bufferToHex(toBuffer(account))
      console.log(`Account #${index}: ${address} 
Private Key: ${privateKey}
`)
    }else{
      address = bufferToHex(privateToAddress(toBuffer(account.privateKey)))
      privateKey = bufferToHex(toBuffer(account.privateKey))
      const balance = new BN(account.balance).div(new BN(10).pow(new BN(18))).toString(10)
      console.log(`Account #${index}: ${address} (${balance} ETH)
Private Key: ${privateKey}
`)
    }
  }
}