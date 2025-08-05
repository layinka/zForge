import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SYFactory, MockStCORE, SYToken, PTToken, YTToken } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SYFactory", function () {
  let syFactory: SYFactory;
  let mockStCORE: MockStCORE;
  let syToken: SYToken;
  let ptToken: PTToken;
  let ytToken: YTToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  const INITIAL_AMOUNT = ethers.parseEther("1000");
  const WRAP_AMOUNT = ethers.parseEther("100");
  const SPLIT_AMOUNT = ethers.parseEther("50");
  const YIELD_RATE = 500; // 5%
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy MockStCORE
    const MockStCOREFactory = await ethers.getContractFactory("MockStCORE");
    mockStCORE = await MockStCOREFactory.deploy();
    
    // Deploy SYFactory
    const SYFactoryFactory = await ethers.getContractFactory("SYFactory");
    syFactory = await SYFactoryFactory.deploy();
    
    // Create SY token with 6-month maturity
    const maturity = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
    await syFactory.createSYToken(
      await mockStCORE.getAddress(),
      maturity,
      "Standardized Yield stCORE",
      "SY-stCORE",
      YIELD_RATE
    );
    
    const syTokenAddress = await syFactory.getSYToken(await mockStCORE.getAddress());
    syToken = await ethers.getContractAt("SYToken", syTokenAddress);
    
    const [ptAddress, ytAddress] = await syFactory.getTokenPair(syTokenAddress);
    ptToken = await ethers.getContractAt("PTToken", ptAddress);
    ytToken = await ethers.getContractAt("YTToken", ytAddress);
    
    // Mint tokens to users
    await mockStCORE.mint(user1.address, INITIAL_AMOUNT);
    await mockStCORE.mint(user2.address, INITIAL_AMOUNT);
  });
  
  describe("Wrapping", function () {
    it("Should wrap underlying tokens into SY tokens", async function () {
      await mockStCORE.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT);
      
      await expect(syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT))
        .to.emit(syToken, "Wrap")
        .withArgs(user1.address, WRAP_AMOUNT, WRAP_AMOUNT);
      
      expect(await syToken.balanceOf(user1.address)).to.equal(WRAP_AMOUNT);
      expect(await mockStCORE.balanceOf(user1.address)).to.equal(INITIAL_AMOUNT - WRAP_AMOUNT);
    });
    
    it("Should fail to wrap with insufficient allowance", async function () {
      await expect(syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT))
        .to.be.revertedWith("ERC20: insufficient allowance");
    });
  });
  
  describe("Splitting", function () {
    beforeEach(async function () {
      await mockStCORE.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT);
      await syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT);
    });
    
    it("Should split SY tokens into PT and YT tokens", async function () {
      await syToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      
      await expect(syFactory.connect(user1).split(await syToken.getAddress(), SPLIT_AMOUNT))
        .to.emit(syFactory, "TokensSplit")
        .withArgs(user1.address, await syToken.getAddress(), SPLIT_AMOUNT, await ptToken.getAddress(), await ytToken.getAddress());
      
      expect(await ptToken.balanceOf(user1.address)).to.equal(SPLIT_AMOUNT);
      expect(await ytToken.balanceOf(user1.address)).to.equal(SPLIT_AMOUNT);
      expect(await syToken.balanceOf(user1.address)).to.equal(WRAP_AMOUNT - SPLIT_AMOUNT);
    });
    
    it("Should fail to split with insufficient SY balance", async function () {
      await syToken.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT + ethers.parseEther("1"));
      
      await expect(syFactory.connect(user1).split(await syToken.getAddress(), WRAP_AMOUNT + ethers.parseEther("1")))
        .to.be.revertedWith("Insufficient SY balance");
    });
  });
  
  describe("Merging", function () {
    beforeEach(async function () {
      await mockStCORE.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT);
      await syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT);
      await syToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      await syFactory.connect(user1).split(await syToken.getAddress(), SPLIT_AMOUNT);
    });
    
    it("Should merge PT and YT tokens back into SY tokens", async function () {
      const initialSYBalance = await syToken.balanceOf(user1.address);
      
      await ptToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      await ytToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      
      await expect(syFactory.connect(user1).merge(await syToken.getAddress(), SPLIT_AMOUNT))
        .to.emit(syFactory, "TokensMerged")
        .withArgs(user1.address, await syToken.getAddress(), SPLIT_AMOUNT, await ptToken.getAddress(), await ytToken.getAddress());
      
      expect(await syToken.balanceOf(user1.address)).to.equal(initialSYBalance + SPLIT_AMOUNT);
      expect(await ptToken.balanceOf(user1.address)).to.equal(0);
      expect(await ytToken.balanceOf(user1.address)).to.equal(0);
    });
  });
  
  describe("Yield claiming", function () {
    beforeEach(async function () {
      await mockStCORE.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT);
      await syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT);
      await syToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      await syFactory.connect(user1).split(await syToken.getAddress(), SPLIT_AMOUNT);
    });
    
    it("Should allow claiming yield from YT tokens", async function () {
      // Fast forward time to accumulate yield
      await time.increase(30 * 24 * 60 * 60); // 30 days
      
      const claimableYield = await ytToken.getClaimableYield(user1.address);
      expect(claimableYield).to.be.gt(0);
      
      await expect(syFactory.connect(user1).claimYT(await ytToken.getAddress()))
        .to.emit(syFactory, "YieldClaimed")
        .withArgs(user1.address, await ytToken.getAddress(), claimableYield);
    });
  });
  
  describe("PT Redemption", function () {
    beforeEach(async function () {
      await mockStCORE.connect(user1).approve(await syFactory.getAddress(), WRAP_AMOUNT);
      await syFactory.connect(user1).wrap(await mockStCORE.getAddress(), WRAP_AMOUNT);
      await syToken.connect(user1).approve(await syFactory.getAddress(), SPLIT_AMOUNT);
      await syFactory.connect(user1).split(await syToken.getAddress(), SPLIT_AMOUNT);
    });
    
    it("Should allow PT redemption after maturity", async function () {
      // Fast forward to after maturity
      await time.increase(7 * 30 * 24 * 60 * 60); // 7 months
      
      // Enable redemption
      await ptToken.enableRedemption();
      
      const initialBalance = await mockStCORE.balanceOf(user1.address);
      
      await expect(syFactory.connect(user1).redeemPT(await ptToken.getAddress()))
        .to.emit(syFactory, "PTRedeemed")
        .withArgs(user1.address, await ptToken.getAddress(), SPLIT_AMOUNT);
      
      expect(await mockStCORE.balanceOf(user1.address)).to.equal(initialBalance + SPLIT_AMOUNT);
      expect(await ptToken.balanceOf(user1.address)).to.equal(0);
    });
    
    it("Should fail to redeem PT before maturity", async function () {
      await expect(syFactory.connect(user1).redeemPT(await ptToken.getAddress()))
        .to.be.revertedWith("PT token has not matured");
    });
  });
});
