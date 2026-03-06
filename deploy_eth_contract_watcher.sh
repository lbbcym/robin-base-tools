#!/bin/bash

# Deploy eth-contract-watcher to monitor for DEGEN and USDC transfers

# Clone the robin-base-tools repository
git clone https://github.com/lbbcym/robin-base-tools.git

# Navigate to the robin-base-tools directory
cd robin-base-tools

# Install dependencies
npm install ethers

# Run the eth-contract-watcher script
node eth_contract_watcher.js
