


// import { Wallet, utils } from 'ethers';
// const { normalizeHardhatNetworkAccountsConfig } = require("hardhat/internal/core/providers/util")

// const { BN, bufferToHex, privateToAddress, toBuffer } = require("ethereumjs-util")

export async function generateMnemonic (taskArguments, hre, runSuper) {

  const  { Wallet,randomBytes,  Mnemonic } = hre.ethers;
  
  
  const wallet = Wallet.fromPhrase(
    Mnemonic.entropyToPhrase(randomBytes(32))
  )

  // ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
  
  console.log('wallet.address:', wallet.address)
  console.log('wallet.mnemonic.phrase:', wallet.mnemonic.phrase)
  console.log('wallet.privateKey:', wallet.privateKey)

//   const networkConfig = hre.config.networks["mainnet"]

//   console.log(networkConfig.accounts)

//   const accounts = normalizeHardhatNetworkAccountsConfig(networkConfig.accounts)

//   console.log("Accounts")
//   console.log("========")

//   for (const [index, account] of accounts.entries()) {
//     const address = bufferToHex(privateToAddress(toBuffer(account.privateKey)))
//     const privateKey = bufferToHex(toBuffer(account.privateKey))
//     const balance = new BN(account.balance).div(new BN(10).pow(new BN(18))).toString(10)
//     console.log(`Account #${index}: ${address} (${balance} ETH)
// Private Key: ${privateKey}
// `)
//   }
}


