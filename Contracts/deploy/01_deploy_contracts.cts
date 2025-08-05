import 'hardhat-deploy';
import '@nomicfoundation/hardhat-ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying contracts with account:", deployer);

  // Deploy MockStCORE first
  const mockStCORE = await deploy("MockStCORE", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log("MockStCORE deployed to:", mockStCORE.address);

  // Deploy SYFactory
  const syFactory = await deploy("SYFactory", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log("SYFactory deployed to:", syFactory.address);

  // Create a SY token for stCORE with 6-month maturity and 5% yield
  const maturity = Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60); // 6 months from now
  const yieldRate = 500; // 5% in basis points

  const factoryContract = await ethers.getContractAt("SYFactory", syFactory.address);
  
  console.log("Creating SY token for stCORE...");
  const tx = await factoryContract.createSYToken(
    mockStCORE.address,
    maturity,
    "Standardized Yield stCORE",
    "SY-stCORE",
    yieldRate
  );
  
  await tx.wait();
  
  const syTokenAddress = await factoryContract.getSYToken(mockStCORE.address);
  console.log("SY-stCORE token created at:", syTokenAddress);
  
  const [ptAddress, ytAddress] = await factoryContract.getTokenPair(syTokenAddress);
  console.log("PT-stCORE token created at:", ptAddress);
  console.log("YT-stCORE token created at:", ytAddress);

  // Get ABIs from compiled artifacts since these contracts are deployed by factory
  const syTokenArtifact = await hre.artifacts.readArtifact("SYToken");
  const ptTokenArtifact = await hre.artifacts.readArtifact("PTToken");
  const ytTokenArtifact = await hre.artifacts.readArtifact("YTToken");

  // Save deployment info
  await deployments.save("SYstCORE", {
    abi: syTokenArtifact.abi,
    address: syTokenAddress,
  });

  await deployments.save("PTstCORE", {
    abi: ptTokenArtifact.abi,
    address: ptAddress,
  });

  await deployments.save("YTstCORE", {
    abi: ytTokenArtifact.abi,
    address: ytAddress,
  });

  console.log("Deployment completed successfully!");
};

func.tags = ["all", "main"];
export default func;
