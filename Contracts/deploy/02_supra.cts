
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { getChainId } from 'hardhat';


export const ORACLE_FEED_ADDRESSES: {
    [chainId: number] : string
} = {
    // 31337: '0x',
    1114: '0x',//Core testnet
	12227332: '0x5df499C9DB456154F81121282c0cB16b59e74C4b' // Neo X testnet


}


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;

	const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();

	console.log('Deploying to Chain : ', chainId)
    
    let oracleAddress: string|undefined = ORACLE_FEED_ADDRESSES[+chainId];
    if(oracleAddress){
        await deploy("SupraPUSHOracle", {
            from: deployer,
            log: true,
            args: [oracleAddress, [
                259, //CORE_USDT
                260, //GAS_USDT
                142, //CELO_USDT
                56, // FTM_USDT
                1, //ETH
                18, //BTC
             ] 
            ],
            deterministicDeployment: true,
            autoMine: true,
            
        });
    }else{
        console.log('No Supra Oracle configured for this chain')
    }
    
};
export default func;
func.tags = ['supra'];