# Base Chain Tools

A JavaScript/TypeScript library for interacting with the Base blockchain ecosystem. This package provides utilities and helper functions for working with Base's L2 features.

## Installation

```bash
npm install base-chain-tools
```

## Usage

```typescript
import { BaseChain, BaseChainConfig, L2BridgeConfig } from 'base-chain-tools';

// Initialize Base chain connection
const config: BaseChainConfig = {
  rpcUrl: 'https://mainnet.base.org',
  chainId: 8453,
  name: 'Base Mainnet'
};

const baseChain = new BaseChain(config);

// Check L2 status
const isL2Active = await baseChain.getL2Status();

// Bridge tokens to L2
const bridgeConfig: L2BridgeConfig = {
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  tokenAddress: '0x...'
};

const bridgeTx = await baseChain.bridgeToL2(bridgeConfig, '1.0');

// Utility functions
import { formatWei, parseWei, isValidAddress, getBaseChainId } from 'base-chain-tools';

const weiAmount = parseWei('1.0'); // Convert ETH to Wei
const ethAmount = formatWei(weiAmount); // Convert Wei to ETH
const isValid = isValidAddress('0x...'); // Validate address
const chainId = getBaseChainId(); // Get Base mainnet chain ID
```

## Features

- Base chain connection management
- L2 interaction utilities
- Token bridging helpers
- Wei/Ether conversion utilities
- Address validation
- TypeScript support

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT License - see LICENSE file for details