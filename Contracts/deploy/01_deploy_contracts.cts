import 'hardhat-deploy';
import '@nomicfoundation/hardhat-ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// Convert per-block yield rate to annual yield rate (basis points)
function convertBlockRateToAnnualBasisPoints(yieldRatePerBlock: number, blockTimeSeconds: number): number {
  const blocksPerYear = (365.25 * 24 * 60 * 60) / blockTimeSeconds;
  
  // Compound the per-block rate to get annual rate
  const annualMultiplier = Math.pow(1 + yieldRatePerBlock, blocksPerYear);
  const annualYieldRate = annualMultiplier - 1;
  
  // Convert to basis points (multiply by 10,000)
  return Math.round(annualYieldRate * 10000);
}

const func = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('PWO', Math.pow(1+0.000005, 10518000))
  console.log('PWO 2', Math.pow(1+(80/10000000), 10518000))
  console.log('PWO 3', Math.pow(1+(80/100000000), 10518000))
  

  console.log("Deploying contracts with account:", deployer);

  // Define realistic yield rates (scaled by 1e18 for contract precision)
  const yieldTokens = [
    {
      name: "Staked CORE",
      symbol: "stCORE",
      yieldRatePerBlock: 30,// should be divided by 1e8 // Math.floor(0.000008 * 1e18), // ~80% APY
      address:''
    },
    {
      name: "Staked BTC",
      symbol: "stBTC",
      yieldRatePerBlock: 20,// Math.floor(0.000005 * 1e18), // ~50% APY
      address:''
    },
    {
      name: "Dual Staked CORE and BTC",
      symbol: "dualStake",
      yieldRatePerBlock: 12, // Math.floor(0.000012 * 1e18), // ~120% APY
      address:''
    },
  ]

  const yieldTokenContracts: {symbol: string, address: string}[] = [];

  // Deploy yield tokens sequentially
  for (const yieldToken of yieldTokens) {
    const yieldTokenContract = await deploy("MockYieldToken", {
      from: deployer,
      args: [yieldToken.name, yieldToken.symbol, Math.floor( ( yieldToken.yieldRatePerBlock/1e8) * 1e18)],
      log: true,
      waitConfirmations: 1,
    });
    console.log(`${yieldToken.name} deployed to:`, yieldTokenContract.address);
    const tokenArtifact = await hre.artifacts.readArtifact("MockYieldToken");

    // Save deployment info
    await deployments.save(`yieldToken-${yieldToken.name}`, {
      abi: tokenArtifact.abi,
      address: yieldTokenContract.address,
    });
    yieldTokenContracts.push({
      symbol: yieldToken.symbol,
       address: yieldTokenContract.address
    });
  }

  // // Deploy MockStCORE first
  // const mockStCORE = await deploy("MockYieldEarner", {
  //   from: deployer,
  //   args: [],
  //   log: true,
  //   waitConfirmations: 1,
  // });

  // console.log("MockStCORE deployed to:", mockStCORE.address);

  // Deploy SYFactory
  const syFactory = await deploy("SYFactory", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log("SYFactory deployed to:", syFactory.address);

  

  const factoryContract = await ethers.getContractAt("SYFactory", syFactory.address);
  
  // Process yield tokens sequentially
  for (const yieldToken of yieldTokens) {
    const yieldPerBlock = yieldToken.yieldRatePerBlock/1e8;
    const blocksPerYear = 365.25 * 24 * 60 * 60 / 3;//core is 3 per block
    // Calculate APY from per-block rate
    const annualMultiplier = Math.pow(1 + ((yieldPerBlock)), blocksPerYear);
    const apy = (annualMultiplier - 1) * 100; // Convert to percentage
    console.log(`APY for ${annualMultiplier} ${yieldToken.name}: ${apy.toFixed(2)}%`);

    

    const yieldTokenContractDetails = yieldTokenContracts.find((contract) => contract.symbol === yieldToken.symbol);
    if (!yieldTokenContractDetails) {
      throw new Error(`Yield token contract not found for ${yieldToken.symbol}`);
    }

    let months = [3,6,12];
    for (let i = 0; i < months.length; i++) {
      
      // Create a SY token for stCORE with 6-month maturity and 5% yield
      const maturity = Math.floor(Date.now() / 1000) + (months[i] * 30 * 24 * 60 * 60); 
      const yieldRateBasisPoints = convertBlockRateToAnnualBasisPoints(yieldPerBlock, 3);
      
      // Calculate APY from basis points for display
      const apyFromBasisPoints = yieldRateBasisPoints / 100; // Convert basis points to percentage
      console.log(`Creating SY token for ${yieldToken.name} with ${apyFromBasisPoints.toFixed(2)}% annual yield (${yieldRateBasisPoints} basis points)`);

      const tx = await factoryContract.createSYToken(
        yieldTokenContractDetails.address,
        maturity,
        yieldToken.symbol,
        yieldToken.symbol,
        yieldRateBasisPoints
      );      
      await tx.wait();
      
      const syTokenAddress = await factoryContract.getSYTokenByMaturity(yieldTokenContractDetails.address, maturity);
      console.log(`SY-${yieldToken.symbol} token created at:`, syTokenAddress);

      const [ptAddress, ytAddress] = await factoryContract.getTokenPairByStToken(syTokenAddress);
      console.log(`PT-${yieldToken.symbol} token created at:`, ptAddress);
      console.log(`YT-${yieldToken.symbol} token created at:`, ytAddress);

      // Get ABIs from compiled artifacts since these contracts are deployed by factory
      const syTokenArtifact = await hre.artifacts.readArtifact("SYToken");
      const ptTokenArtifact = await hre.artifacts.readArtifact("PTToken");
      const ytTokenArtifact = await hre.artifacts.readArtifact("YTToken");

      // Save deployment info
      await deployments.save(`SY-${yieldToken.symbol}-${months[i]}M`, {
        abi: syTokenArtifact.abi,
        address: syTokenAddress,
      });

      await deployments.save(`PT-${yieldToken.symbol}-${months[i]}M`, {
        abi: ptTokenArtifact.abi,
        address: ptAddress,
      });

      await deployments.save(`YT-${yieldToken.symbol}-${months[i]}M`, {
        abi: ytTokenArtifact.abi,
        address: ytAddress,
      });
    }
  }

  

  console.log("Deployment completed successfully!");
};

func.tags = ["all", "main"];
export default func;
