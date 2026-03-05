const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AuthError,
  createPrivyAuthFromEnv,
  InMemoryNonceStore,
  PrivyAuthService,
} = require('../dist/privy-auth.js');

function createService(overrides = {}) {
  let now = overrides.now ?? 1_700_000_000;

  const service = new PrivyAuthService(
    {
      appId: 'test-app-id',
      appSecret: 'test-secret',
      audience: 'test-app-id',
      issuer: 'https://auth.privy.io/api/v1/apps/test-app-id',
      sessionIssuer: 'test-session-issuer',
      sessionTtlSeconds: 60,
      clockToleranceSeconds: 0,
    },
    {
      nonceStore: new InMemoryNonceStore(),
      tokenVerifier:
        overrides.tokenVerifier ||
        (async () => ({
          subject: 'did:privy:test-user',
          email: 'dev@example.com',
          linkedAccounts: [{ type: 'wallet', address: '0xabc' }],
          claims: { sub: 'did:privy:test-user' },
        })),
      now: () => now,
    },
  );

  return {
    service,
    advance: (seconds) => {
      now += seconds;
    },
  };
}

test('authenticate returns session token that verifies', async () => {
  const { service } = createService();

  const sessionToken = await service.authenticate('privy.jwt.token', 'nonce-1');
  const payload = await service.verifySessionToken(sessionToken);

  assert.equal(payload.sub, 'did:privy:test-user');
  assert.equal(payload.privySub, 'did:privy:test-user');
  assert.equal(payload.email, 'dev@example.com');
  assert.equal(payload.iss, 'test-session-issuer');
  assert.equal(payload.aud, 'test-app-id');
  assert.ok(typeof payload.jti === 'string');
});

test('reused nonce is rejected', async () => {
  const { service } = createService();

  await service.authenticate('privy.jwt.token', 'nonce-replay');

  await assert.rejects(
    () => service.authenticate('privy.jwt.token', 'nonce-replay'),
    (error) => error instanceof AuthError && error.code === 'REPLAY_NONCE',
  );
});

test('missing nonce is rejected before token verification', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.authenticate('privy.jwt.token', ''),
    (error) => error instanceof AuthError && error.code === 'MISSING_NONCE',
  );
});

test('expired session token is rejected', async () => {
  const { service, advance } = createService();

  const sessionToken = await service.authenticate('privy.jwt.token', 'nonce-exp');
  advance(61);

  await assert.rejects(
    () => service.verifySessionToken(sessionToken),
    (error) => error instanceof AuthError && error.code === 'SESSION_EXPIRED',
  );
});

test('session token signature tampering is rejected', async () => {
  const { service } = createService();

  const sessionToken = await service.authenticate('privy.jwt.token', 'nonce-tamper');
  const tampered = `${sessionToken.slice(0, -2)}aa`;

  await assert.rejects(
    () => service.verifySessionToken(tampered),
    (error) => error instanceof AuthError && error.code === 'INVALID_SESSION_SIGNATURE',
  );
});

test('session audience mismatch is rejected', async () => {
  const { service } = createService();
  const sessionToken = await service.authenticate('privy.jwt.token', 'nonce-audience');

  const verifier = new PrivyAuthService(
    {
      appId: 'other-app-id',
      appSecret: 'test-secret',
      audience: 'other-app-id',
      issuer: 'https://auth.privy.io/api/v1/apps/test-app-id',
      sessionIssuer: 'test-session-issuer',
      sessionTtlSeconds: 60,
      clockToleranceSeconds: 0,
    },
    {
      now: () => 1_700_000_000,
    },
  );

  await assert.rejects(
    () => verifier.verifySessionToken(sessionToken),
    (error) => error instanceof AuthError && error.code === 'INVALID_SESSION_AUDIENCE',
  );
});

test('env factory reads explicit session settings', async () => {
  const service = createPrivyAuthFromEnv(
    {
      PRIVY_APP_ID: 'env-app-id',
      PRIVY_APP_SECRET: 'env-secret',
      PRIVY_ISSUER: 'https://auth.privy.io/api/v1/apps/env-app-id',
      PRIVY_AUDIENCE: 'env-app-id',
      SESSION_ISSUER: 'env-session-issuer',
      SESSION_TTL_SECONDS: '120',
      CLOCK_TOLERANCE_SECONDS: '2',
      JWKS_CACHE_SECONDS: '30',
    },
    {
      tokenVerifier: async () => ({
        subject: 'did:privy:env-user',
        claims: { sub: 'did:privy:env-user' },
      }),
      now: () => 1_700_000_000,
    },
  );

  const sessionToken = await service.authenticate('privy.jwt.token', 'nonce-env');
  const payload = await service.verifySessionToken(sessionToken);

  assert.equal(payload.iss, 'env-session-issuer');
  assert.equal(payload.aud, 'env-app-id');
  assert.equal(payload.exp, 1_700_000_120);
});
