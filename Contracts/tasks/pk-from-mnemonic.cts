

export async function pkFromMnemonic (taskArguments, hre, runSuper) {

  const  { Wallet, utils, HDNodeWallet, Mnemonic } = hre.ethers;
  console.log('hre tehers: ', utils)
  const { mnemonic } = taskArguments
  if(!mnemonic){
    throw new Error('No Mnemonic given. Specify a mnemonic with the flag --mnemonic ')
  }

  const w = Wallet.fromPhrase(mnemonic);
  console.log('W: ', w)
  console.log('WPK: ', w.privateKey)

  var mnemonicC = Mnemonic.fromPhrase(mnemonic)
  const hdNode = HDNodeWallet.fromMnemonic(mnemonicC, `m/44'/60'/0'/0`);// `m/44'/818'/0'/0` - Meter Derv path
  for (let i = 0; i < 5; i++) {
    const accountHdNode = hdNode.derivePath(`${i}`);// This returns a new HDNode
    console.log('accountHdNode ', accountHdNode)
    console.log('WPK: ', accountHdNode.privateKey)
    // const wallet = Wallet.fromMnemonic(
    //   mnemonic
    // )
    try{
      const wallet = new Wallet(accountHdNode)
    console.log('Wallet ', i+1)
    console.log('==== ')
    console.log('wallet.address:', wallet.address)
    console.log('wallet.mnemonic.phrase:', wallet.mnemonic.phrase)
    console.log('wallet.privateKey:', wallet.privateKey)
    console.log('------ ')
    }catch(eerr){

    }
    
  }
  // const secondAccount = hdNode.derivePath(`m/44'/60'/0'/0/1`); // This returns a new HDNode
  // const thirdAccount = hdNode.derivePath(`m/44'/60'/0'/0/2`);
  
  // const wallet = Wallet.fromMnemonic(
  //   mnemonic
  // )
  
  // console.log('wallet.address:', wallet.address)
  // console.log('wallet.mnemonic.phrase:', wallet.mnemonic.phrase)
  // console.log('wallet.privateKey:', wallet.privateKey)

}


