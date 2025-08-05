const func = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  await deploy("Multicall3", {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  });
};

func.tags = ["Multicall3"];
export default func
