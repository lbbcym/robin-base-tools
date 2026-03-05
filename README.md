# Base Chain Tools

TypeScript utilities for Base chain operations and server-side Privy auth.

## Installation

```bash
npm install base-chain-tools
```

## Base Chain Usage

```ts
import { BaseChain } from 'base-chain-tools';

const baseChain = new BaseChain({
  rpcUrl: 'https://mainnet.base.org',
  chainId: 8453,
  name: 'Base Mainnet',
});

const isL2Active = await baseChain.getL2Status();
```

## Privy Auth (Server Side)

### 1) Environment

```bash
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_ISSUER=https://auth.privy.io/api/v1/apps/<app_id>
PRIVY_AUDIENCE=<app_id>
SESSION_ISSUER=robin-base-tools
SESSION_TTL_SECONDS=3600
CLOCK_TOLERANCE_SECONDS=5
JWKS_CACHE_SECONDS=300
```

### 2) Authenticate with Privy token + nonce

```ts
import { PrivyAuthService } from 'base-chain-tools';

const auth = new PrivyAuthService({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  issuer: process.env.PRIVY_ISSUER,
  audience: process.env.PRIVY_AUDIENCE,
});

const sessionToken = await auth.authenticate(privyTokenFromClient, nonceFromClient);
```

### 3) Verify app session in protected APIs

```ts
const session = await auth.verifySessionToken(sessionToken);
console.log(session.sub);
```

## Security Notes

- Verifies Privy JWT signature against issuer JWKS.
- Checks `iss`, `aud`, `sub`, `exp`, `nbf`, `iat` with configurable clock tolerance.
- Uses one-time nonce consumption to block replay.
- Signs app sessions with HS256 and validates signature + claims on read.
- Default nonce store is in-memory; replace with Redis/DB for multi-instance deployments.

## Development

```bash
npm run build
npm test
```
