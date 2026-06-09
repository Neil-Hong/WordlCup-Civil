const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT\n");

  // 1. Deploy TeamVault
  const TeamVault = await ethers.getContractFactory("TeamVault");
  const vault = await TeamVault.deploy();
  await vault.waitForDeployment();
  console.log("TeamVault deployed to:", await vault.getAddress());

  // 2. Deploy Prediction (needs oracle address — use deployer for MVP)
  const Prediction = await ethers.getContractFactory("Prediction");
  const prediction = await Prediction.deploy(deployer.address);
  await prediction.waitForDeployment();
  console.log("Prediction deployed to:", await prediction.getAddress());

  // 3. Deploy Reward (needs vault + prediction addresses)
  const Reward = await ethers.getContractFactory("Reward");
  const reward = await Reward.deploy(await vault.getAddress(), await prediction.getAddress());
  await reward.waitForDeployment();
  const rewardAddr = await reward.getAddress();
  console.log("Reward deployed to:", rewardAddr);

  // 4. Deploy AgentCallback (callback receiver for Somnia Agents)
  const AgentCallback = await ethers.getContractFactory("AgentCallback");
  const callback = await AgentCallback.deploy();
  await callback.waitForDeployment();
  const callbackAddr = await callback.getAddress();
  console.log("AgentCallback deployed to:", callbackAddr);

  // 5. Fund the Reward contract with STT so it can pay out claims
  const fundAmount = ethers.parseEther("0.3");
  const fundTx = await deployer.sendTransaction({
    to: rewardAddr,
    value: fundAmount,
  });
  await fundTx.wait();
  console.log("Reward funded with:", ethers.formatEther(fundAmount), "STT (tx:", fundTx.hash, ")");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Add these to .env.local:");
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${await vault.getAddress()}`);
  console.log(`NEXT_PUBLIC_PREDICTION_ADDRESS=${await prediction.getAddress()}`);
  console.log(`NEXT_PUBLIC_REWARD_ADDRESS=${rewardAddr}`);
  console.log(`NEXT_PUBLIC_CALLBACK_ADDRESS=${callbackAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
