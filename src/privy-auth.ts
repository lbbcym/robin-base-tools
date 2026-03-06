import { createHmac, randomUUID } from 'crypto';
import { createRemoteJWKSet, jwtVerify, JWTPayload, SignJWT } from 'jose';

export class AuthError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface PrivyAuthConfig {
  appId: string;
  appSecret: string;
  issuer?: string;
  audience?: string;
  sessionTtlSeconds?: number;
  clockToleranceSeconds?: number;
}

export interface NonceStore {
  consume(nonce: string, ttlSeconds: number): Promise<boolean>;
}

export class InMemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  async consume(nonce: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    this.cleanup(now);

    if (this.seen.has(nonce)) return false;

    this.seen.set(nonce, now + ttlSeconds * 1000);
    return true;
  }

  private cleanup(now = Date.now()): void {
    for (const [nonce, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) this.seen.delete(nonce);
    }
  }
}

export interface VerifyPrivyResult {
  subject: string;
  payload: JWTPayload;
}

export class PrivyAuthService {
  private readonly jwks;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly ttl: number;
  private readonly clockTolerance: number;

  constructor(private readonly config: PrivyAuthConfig, private readonly nonceStore: NonceStore = new InMemoryNonceStore()) {
    if (!config.appId || !config.appSecret) {
      throw new AuthError('Missing PRIVY_APP_ID or PRIVY_APP_SECRET', 'CONFIG_ERROR', 500);
    }

    this.issuer = config.issuer ?? `https://auth.privy.io/api/v1/apps/${config.appId}`;
    this.audience = config.audience ?? config.appId;
    this.ttl = config.sessionTtlSeconds ?? 3600;
    this.clockTolerance = config.clockToleranceSeconds ?? 5;

    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/jwks.json`));
  }

  async authenticate(privyToken: string, nonce: string): Promise<string> {
    if (!privyToken) throw new AuthError('Missing Privy token', 'MISSING_TOKEN');
    if (!nonce) throw new AuthError('Missing nonce', 'MISSING_NONCE');

    const ok = await this.nonceStore.consume(this.hashNonce(nonce), this.ttl);
    if (!ok) throw new AuthError('Replay detected: nonce already used', 'REPLAY_NONCE', 409);

    const { subject, payload } = await this.verifyPrivyToken(privyToken);
    return this.issueSessionToken(subject, payload);
  }

  async verifyPrivyToken(token: string): Promise<VerifyPrivyResult> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
      });

      if (!payload.sub) throw new AuthError('Privy token missing sub', 'INVALID_TOKEN');
      return { subject: payload.sub, payload };
    } catch {
      throw new AuthError('Invalid Privy token', 'INVALID_TOKEN');
    }
  }

  async verifySessionToken(token: string): Promise<JWTPayload> {
    try {
      const secret = new TextEncoder().encode(this.config.appSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'robin-base-tools',
        audience: this.audience,
        clockTolerance: this.clockTolerance,
      });
      return payload;
    } catch {
      throw new AuthError('Invalid session token', 'INVALID_SESSION');
    }
  }

  private async issueSessionToken(subject: string, privyPayload: JWTPayload): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode(this.config.appSecret);

    return new SignJWT({
      privySub: subject,
      email: privyPayload.email,
      linkedAccounts: privyPayload.linked_accounts,
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('robin-base-tools')
      .setAudience(this.audience)
      .setSubject(subject)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttl)
      .sign(secret);
  }

  private hashNonce(nonce: string): string {
    return createHmac('sha256', this.config.appSecret).update(nonce).digest('hex');
  }
}
