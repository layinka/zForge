// const {
//   ethers: { utils: { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } },
// } = require("ethers")
import {AbiCoder, ethers} from "ethers";
import {keccak256,toUtf8Bytes, solidityPacked} from "ethers";
// const keccak256 = ethers.utils.keccak256
// const toUtf8Bytes = ethers.utils.toUtf8Bytes
// const solidityPack = ethers.utils.solidityPack
// const defaultAbiCoder = ethers.utils.defaultAbiCoder
const defaultAbiCoder = AbiCoder.defaultAbiCoder()

const PERMIT_TYPEHASH = keccak256(toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"))

function getDomainSeparator(name: string, chainId: any, tokenAddress: any) {
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes("1")),
        chainId,
        tokenAddress,
      ]
    )
  )
}

export async function getApprovalDigest(token: any, chainId: any, approve: { owner: any; spender: any; value: any; }, nonce: any, deadline: any) {
  const name = await token.name()
  
  const DOMAIN_SEPARATOR = getDomainSeparator(name, chainId, token.address)
  return keccak256(
    solidityPacked(
      ["bytes1", "bytes1", "bytes32", "bytes32"],
      [
        "0x19",
        "0x01",
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    )
  )
}


