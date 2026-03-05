const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivyAuthService, AuthError, InMemoryNonceStore } = require('../dist/privy-auth.js');

function makeService() {
  const service = new PrivyAuthService(
    {
      appId: 'test-app-id',
      appSecret: 'super-secret',
      issuer: 'https://auth.privy.io/api/v1/apps/test-app-id',
      audience: 'test-app-id',
      sessionTtlSeconds: 60,
    },
    new InMemoryNonceStore(),
  );

  service.verifyPrivyToken = async () => ({
    subject: 'did:privy:test-user',
    payload: { sub: 'did:privy:test-user', email: 'dev@example.com' },
  });

  return service;
}

test('authenticate mints verifiable session', async () => {
  const service = makeService();
  const session = await service.authenticate('fake-privy-token', 'nonce-1');
  const payload = await service.verifySessionToken(session);

  assert.equal(payload.sub, 'did:privy:test-user');
  assert.equal(payload.privySub, 'did:privy:test-user');
  assert.equal(payload.email, 'dev@example.com');
  assert.ok(payload.jti);
});

test('replay nonce is rejected', async () => {
  const service = makeService();

  await service.authenticate('fake-privy-token', 'nonce-replay');

  await assert.rejects(
    () => service.authenticate('fake-privy-token', 'nonce-replay'),
    (err) => err instanceof AuthError && err.code === 'REPLAY_NONCE',
  );
});

test('invalid session token is rejected', async () => {
  const service = makeService();

  await assert.rejects(
    () => service.verifySessionToken('not-a-jwt'),
    (err) => err instanceof AuthError && err.code === 'INVALID_SESSION',
  );
});
