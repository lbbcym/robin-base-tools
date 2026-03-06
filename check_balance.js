// check_balance.js
const { JsonRpcProvider, formatUnits, Contract } = require("ethers");

async function checkBalance() {
  const p = new JsonRpcProvider("https://mainnet.base.org");
  const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const contract = new Contract(usdc, abi, p);
  const balance = await contract.balanceOf("0x7272FFE91BD7666935Fc65892634003701CE2Dd8");
  const formattedBalance = formatUnits(balance, 6);
  console.log("REAL_USDC_BALANCE:", formattedBalance);
  return formattedBalance;
}

let previousBalance = null;

async function main() {
  const currentBalance = await checkBalance();
  if (previousBalance !== null && currentBalance !== previousBalance) {
    console.log("Balance increased!");
    console.log("Previous Balance:", previousBalance);
    console.log("Current Balance:", currentBalance);
    console.log("PROFIT DETECTED!");
    // You can add a Pushover notification here if you have the keys configured
    // await pushover({ message: `USDC Balance increased! Previous: ${previousBalance}, Current: ${currentBalance}` });
  }
  previousBalance = currentBalance;
}

main();