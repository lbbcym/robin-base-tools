// eth_contract_watcher.js
const { JsonRpcProvider, Contract, formatUnits } = require('ethers');

// Base Mainnet provider
const provider = new JsonRpcProvider('https://mainnet.base.org');

// Our address to monitor
const ourAddress = '0x7272FFE91BD7666935Fc65892634003701CE2Dd8';

// USDC contract address and ABI
const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const usdcAbi = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// DEGEN contract address and ABI (replace with actual DEGEN address and ABI)
const degenAddress = '0x420696969ba69696969696942069696969696969'; // Replace with actual DEGEN address
const degenAbi = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// Create contract instances
const usdcContract = new Contract(usdcAddress, usdcAbi, provider);
const degenContract = new Contract(degenAddress, degenAbi, provider);

// Function to handle transfer events
async function handleTransfer(from, to, value, tokenType) {
    const formattedValue = formatUnits(value, 6); // Assuming 6 decimals for both tokens
    if (to.toLowerCase() === ourAddress.toLowerCase()) {
        console.log(`Received ${formattedValue} ${tokenType} from ${from}`);
        console.log('PROFIT DETECTED!');
    }
}

// Listen for USDC Transfer events
usdcContract.on('Transfer', (from, to, value) => handleTransfer(from, to, value, 'USDC'));

// Listen for DEGEN Transfer events
degenContract.on('Transfer', (from, to, value) => handleTransfer(from, to, value, 'DEGEN'));

console.log(`Monitoring for USDC and DEGEN transfers to ${ourAddress}...`);