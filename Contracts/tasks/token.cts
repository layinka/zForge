
// const {
//   ethers: {
    
//   },
//   utils: {  },
// } = require("ethers");
import { MINICHEF_ADDRESS } from "@zarclays/zswap-core-sdk";

import fs from "fs";
import { task } from "hardhat/config";
import { accounts } from "./accounts.cts";



task("token:accounts", "Prints the list of accounts", accounts);


// task("feeder:feed", "Feed").setAction(async function (
//   { feedDev },
//   { getNamedAccounts, ethers: { BigNumber }, getChainId }
// ) {
//   const { deployer, dev } = await getNamedAccounts();

//   const feeder = new ethers.Wallet(
//     process.env.FEEDER_PRIVATE_KEY,
//     ethers.provider
//   );

//   await (
//     await feeder.sendTransaction({
//       to: deployer,
//       value: BigNumber.from(1).mul(BigNumber.from(10).pow(18)),
//     })
//   ).wait();
// });

// task("feeder:return", "Return funds to feeder").setAction(async function (
//   { address },
//   { ethers: { getNamedSigners } }
// ) {
//   const { deployer, dev } = await getNamedSigners();

//   await (
//     await deployer.sendTransaction({
//       to: process.env.FEEDER_PUBLIC_KEY,
//       value: await deployer.getBalance(),
//     })
//   ).wait();

//   await (
//     await dev.sendTransaction({
//       to: process.env.FEEDER_PUBLIC_KEY,
//       value: await dev.getBalance(),
//     })
//   ).wait();
// });

task("zswap:mintTo", "Mint ZSwap token to address")
  .addParam("to", "Receiver Address")
  .addParam("amount", "Amount to mint", "10")
  // .addOptionalParam("deadline", MaxUint256)
  .setAction(async function (
    { token, to, amount },
    hre: any,
    runSuper
  ) {
    const zSwap = await hre.ethers.getContract("ZSwapToken");
    //@ts-ignore
    let tx = await zSwap.connect(await hre.ethers.getNamedSigner("deployer")).mint(to, hre.ethers.parseEther(amount));
    await tx.wait()

    console.log('Done')

  });
