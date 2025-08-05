 const func = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  console.log('TestToken deployer is ', deployer)

  await deploy("TestToken", {
    from: deployer,
    log: true,
    args: [deployer],
    deterministicDeployment: false
  })
}

func.tags = ["TT"]
// module.exports.dependencies = ["UniswapV2Factory", "UniswapV2Router02"]
export default func