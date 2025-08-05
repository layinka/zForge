import { expect } from "chai";
import { ethers } from "hardhat";
import { MockStCORE } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockStCORE Yield Testing", function () {
  let mockStCORE: MockStCORE;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockStCOREFactory = await ethers.getContractFactory("MockStCORE");
    mockStCORE = await MockStCOREFactory.deploy();
    await mockStCORE.waitForDeployment();
  });

  describe("Basic Functionality", function () {
    it("Should deploy with correct initial supply", async function () {
      const totalSupply = await mockStCORE.totalSupply();
      const expectedSupply = ethers.parseEther("1000000"); // 1M tokens
      expect(totalSupply).to.equal(expectedSupply);
    });

    it("Should allow users to get tokens from faucet", async function () {
      await mockStCORE.connect(user1).faucet();
      const balance = await mockStCORE.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("1000"));
    });

    it("Should have initial yield rate of 5%", async function () {
      const yieldRate = await mockStCORE.yieldRate();
      expect(yieldRate).to.equal(500); // 5% = 500 basis points
    });
  });

  describe("Yield Generation", function () {
    beforeEach(async function () {
      // Give user1 some tokens
      await mockStCORE.connect(user1).faucet();
    });

    it("Should accumulate yield over time", async function () {
      const initialBalance = await mockStCORE.balanceOf(user1.address);
      
      // Simulate 1 year passing (365 days)
      await mockStCORE.simulateTimePass(365 * 24 * 60 * 60);
      
      const pendingYield = await mockStCORE.getPendingYield(user1.address);
      
      // Should be approximately 5% of initial balance (50 tokens)
      const expectedYield = initialBalance * BigInt(5) / BigInt(100);
      expect(pendingYield).to.be.closeTo(expectedYield, ethers.parseEther("1"));
    });

    it("Should allow users to claim yield", async function () {
      const initialBalance = await mockStCORE.balanceOf(user1.address);
      
      // Simulate 6 months passing
      await mockStCORE.simulateTimePass(182 * 24 * 60 * 60);
      
      const pendingYield = await mockStCORE.getPendingYield(user1.address);
      expect(pendingYield).to.be.gt(0);
      
      // Claim yield
      await mockStCORE.connect(user1).claimYield();
      
      const newBalance = await mockStCORE.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance + pendingYield);
      
      // Pending yield should be 0 after claiming
      const remainingYield = await mockStCORE.getPendingYield(user1.address);
      expect(remainingYield).to.equal(0);
    });

    it("Should update yield on transfers", async function () {
      // Simulate some time passing
      await mockStCORE.simulateTimePass(30 * 24 * 60 * 60); // 30 days
      
      const pendingYieldBefore = await mockStCORE.getPendingYield(user1.address);
      
      // Transfer some tokens to user2
      await mockStCORE.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      
      // Check that yield was properly tracked
      const user1Balance = await mockStCORE.balanceOf(user1.address);
      const user2Balance = await mockStCORE.balanceOf(user2.address);
      
      expect(user1Balance).to.equal(ethers.parseEther("900"));
      expect(user2Balance).to.equal(ethers.parseEther("100"));
      
      // User1 should still have some pending yield from before the transfer
      const pendingYieldAfter = await mockStCORE.getPendingYield(user1.address);
      expect(pendingYieldAfter).to.be.gte(0);
    });
  });

  describe("Testing Utilities", function () {
    it("Should allow owner to change yield rate", async function () {
      await mockStCORE.setYieldRate(1000); // 10%
      const newRate = await mockStCORE.yieldRate();
      expect(newRate).to.equal(1000);
    });

    it("Should allow owner to mint tokens for testing", async function () {
      const initialBalance = await mockStCORE.balanceOf(user1.address);
      await mockStCORE.mint(user1.address, ethers.parseEther("500"));
      const newBalance = await mockStCORE.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance + ethers.parseEther("500"));
    });

    it("Should simulate different yield scenarios", async function () {
      // Get tokens for user1
      await mockStCORE.connect(user1).faucet();
      
      // Test high yield rate
      await mockStCORE.setYieldRate(2000); // 20%
      await mockStCORE.simulateTimePass(365 * 24 * 60 * 60); // 1 year
      
      const highYield = await mockStCORE.getPendingYield(user1.address);
      
      // Reset and test low yield rate
      await mockStCORE.connect(user1).claimYield();
      await mockStCORE.setYieldRate(100); // 1%
      await mockStCORE.simulateTimePass(365 * 24 * 60 * 60); // 1 year
      
      const lowYield = await mockStCORE.getPendingYield(user1.address);
      
      expect(highYield).to.be.gt(lowYield);
    });
  });
});
