# Base Chain Tools

TypeScript utilities for Base chain operations and **server-side Privy Auth** integration.

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

Copy `.env.example` and set values:

```bash
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_ISSUER=https://auth.privy.io/api/v1/apps/<app_id>
PRIVY_AUDIENCE=<app_id>
SESSION_TTL_SECONDS=3600
CLOCK_TOLERANCE_SECONDS=5
```

### 2) Verify Privy token + issue app session

```ts
import { PrivyAuthService } from 'base-chain-tools';

const auth = new PrivyAuthService({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  issuer: process.env.PRIVY_ISSUER,
  audience: process.env.PRIVY_AUDIENCE,
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 3600),
  clockToleranceSeconds: Number(process.env.CLOCK_TOLERANCE_SECONDS ?? 5),
});

// privyToken: from client, nonce: one-time random client nonce
const session = await auth.authenticate(privyToken, nonce);
```

### 3) Verify app session in protected APIs

```ts
const payload = await auth.verifySessionToken(sessionToken);
console.log(payload.sub); // Privy user id
```

## Security Model

- **Server-side signature verification** via Privy JWKS (`jwtVerify`)
- **Session issuance** with app-scoped JWT (HS256, `jti`, `exp`, `aud`, `iss`)
- **Replay protection** with one-time nonce consumption (`InMemoryNonceStore`)
- **Strict config validation** (`PRIVY_APP_ID` / `PRIVY_APP_SECRET` required)
- **Typed auth errors** (`AuthError` with code/status)

> For production, replace `InMemoryNonceStore` with Redis or DB-backed nonce storage.

## Development

```bash
npm install
npm run build
npm test
```
