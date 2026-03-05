import {
  createHmac,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature,
} from 'crypto';

const DEFAULT_SESSION_ISSUER = 'robin-base-tools';
const DEFAULT_SESSION_TTL_SECONDS = 3600;
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 5;
const DEFAULT_JWKS_CACHE_SECONDS = 300;

interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  [key: string]: unknown;
}

interface JwksDocument {
  keys: Array<Record<string, unknown>>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface PrivyAuthConfig {
  appId: string;
  appSecret: string;
  issuer?: string;
  audience?: string;
  sessionIssuer?: string;
  sessionTtlSeconds?: number;
  clockToleranceSeconds?: number;
  jwksCacheSeconds?: number;
}

export interface PrivyIdentity {
  subject: string;
  email?: string;
  linkedAccounts?: unknown;
  claims: Record<string, unknown>;
}

export type PrivyTokenVerifier = (token: string) => Promise<PrivyIdentity>;

export interface NonceStore {
  consume(nonce: string, ttlSeconds: number): Promise<boolean>;
}

export class InMemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  async consume(nonce: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    this.cleanup(now);
    if (this.seen.has(nonce)) {
      return false;
    }

    this.seen.set(nonce, now + ttlSeconds * 1000);
    return true;
  }

  private cleanup(now = Date.now()): void {
    for (const [nonce, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(nonce);
      }
    }
  }
}

export interface PrivyAuthServiceOptions {
  nonceStore?: NonceStore;
  tokenVerifier?: PrivyTokenVerifier;
  now?: () => number;
}

interface ParsedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signature: Buffer;
  signingInput: string;
}

export class PrivyAuthService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly sessionIssuer: string;
  private readonly sessionTtlSeconds: number;
  private readonly clockToleranceSeconds: number;
  private readonly jwksCacheSeconds: number;
  private readonly jwksUrl: string;
  private readonly nonceStore: NonceStore;
  private readonly tokenVerifier: PrivyTokenVerifier;
  private readonly now: () => number;

  private jwksCache?: { expiresAtMs: number; keys: Array<Record<string, unknown>> };

  constructor(
    private readonly config: PrivyAuthConfig,
    options: PrivyAuthServiceOptions = {},
  ) {
    if (!config.appId || !config.appSecret) {
      throw new AuthError('Missing PRIVY_APP_ID or PRIVY_APP_SECRET', 'CONFIG_ERROR', 500);
    }

    this.issuer = normalizeIssuer(
      config.issuer ?? `https://auth.privy.io/api/v1/apps/${config.appId}`,
    );
    this.audience = config.audience ?? config.appId;
    this.sessionIssuer = config.sessionIssuer ?? DEFAULT_SESSION_ISSUER;
    this.sessionTtlSeconds = config.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    this.clockToleranceSeconds =
      config.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;
    this.jwksCacheSeconds = config.jwksCacheSeconds ?? DEFAULT_JWKS_CACHE_SECONDS;
    this.jwksUrl = `${this.issuer}/jwks.json`;

    this.nonceStore = options.nonceStore ?? new InMemoryNonceStore();
    this.tokenVerifier = options.tokenVerifier ?? this.verifyPrivyTokenWithJwks.bind(this);
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async authenticate(privyToken: string, nonce: string): Promise<string> {
    if (!privyToken) {
      throw new AuthError('Missing Privy token', 'MISSING_TOKEN', 400);
    }
    if (!nonce) {
      throw new AuthError('Missing nonce', 'MISSING_NONCE', 400);
    }

    const nonceKey = this.hashNonce(nonce);
    const nonceAccepted = await this.nonceStore.consume(nonceKey, this.sessionTtlSeconds);
    if (!nonceAccepted) {
      throw new AuthError('Nonce already used', 'REPLAY_NONCE', 409);
    }

    const identity = await this.verifyPrivyToken(privyToken);
    return this.issueSessionToken(identity);
  }

  async verifyPrivyToken(privyToken: string): Promise<PrivyIdentity> {
    return this.tokenVerifier(privyToken);
  }

  async verifySessionToken(sessionToken: string): Promise<JwtPayload> {
    const parsed = parseJwt(sessionToken);

    if (parsed.header.alg !== 'HS256') {
      throw new AuthError('Unsupported session token algorithm', 'UNSUPPORTED_SESSION_ALG', 401);
    }

    const expectedSignature = signHs256(parsed.signingInput, this.config.appSecret);
    if (
      parsed.signature.length !== expectedSignature.length ||
      !timingSafeEqual(parsed.signature, expectedSignature)
    ) {
      throw new AuthError('Invalid session token signature', 'INVALID_SESSION_SIGNATURE', 401);
    }

    const now = this.now();
    const tolerance = this.clockToleranceSeconds;

    if (parsed.payload.iss !== this.sessionIssuer) {
      throw new AuthError('Invalid session issuer', 'INVALID_SESSION_ISSUER', 401);
    }
    if (!audienceIncludes(parsed.payload.aud, this.audience)) {
      throw new AuthError('Invalid session audience', 'INVALID_SESSION_AUDIENCE', 401);
    }
    if (!parsed.payload.sub) {
      throw new AuthError('Missing subject in session token', 'INVALID_SESSION_SUBJECT', 401);
    }

    if (typeof parsed.payload.exp !== 'number') {
      throw new AuthError('Session token missing exp claim', 'MISSING_SESSION_EXP', 401);
    }
    if (now - tolerance > parsed.payload.exp) {
      throw new AuthError('Session token expired', 'SESSION_EXPIRED', 401);
    }

    if (typeof parsed.payload.nbf === 'number' && now + tolerance < parsed.payload.nbf) {
      throw new AuthError('Session token not active yet', 'SESSION_NOT_ACTIVE', 401);
    }

    if (typeof parsed.payload.iat === 'number' && now + tolerance < parsed.payload.iat) {
      throw new AuthError('Session token issued in the future', 'SESSION_IAT_FUTURE', 401);
    }

    return parsed.payload;
  }

  private async verifyPrivyTokenWithJwks(privyToken: string): Promise<PrivyIdentity> {
    const parsed = parseJwt(privyToken);

    if (parsed.header.alg !== 'RS256') {
      throw new AuthError('Privy token must use RS256', 'UNSUPPORTED_PRIVY_ALG', 401);
    }

    const jwk = await this.selectJwk(parsed.header.kid);
    const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' });
    const signatureOk = verifySignature(
      'RSA-SHA256',
      Buffer.from(parsed.signingInput),
      publicKey,
      parsed.signature,
    );
    if (!signatureOk) {
      throw new AuthError('Invalid Privy token signature', 'INVALID_PRIVY_SIGNATURE', 401);
    }

    const now = this.now();
    const tolerance = this.clockToleranceSeconds;

    if (parsed.payload.iss !== this.issuer) {
      throw new AuthError('Invalid Privy issuer', 'INVALID_PRIVY_ISSUER', 401);
    }
    if (!audienceIncludes(parsed.payload.aud, this.audience)) {
      throw new AuthError('Invalid Privy audience', 'INVALID_PRIVY_AUDIENCE', 401);
    }
    if (!parsed.payload.sub || typeof parsed.payload.sub !== 'string') {
      throw new AuthError('Privy token missing subject', 'INVALID_PRIVY_SUBJECT', 401);
    }

    if (typeof parsed.payload.exp !== 'number') {
      throw new AuthError('Privy token missing exp claim', 'MISSING_PRIVY_EXP', 401);
    }
    if (now - tolerance > parsed.payload.exp) {
      throw new AuthError('Privy token expired', 'PRIVY_EXPIRED', 401);
    }

    if (typeof parsed.payload.nbf === 'number' && now + tolerance < parsed.payload.nbf) {
      throw new AuthError('Privy token not active yet', 'PRIVY_NOT_ACTIVE', 401);
    }

    if (typeof parsed.payload.iat === 'number' && now + tolerance < parsed.payload.iat) {
      throw new AuthError('Privy token issued in the future', 'PRIVY_IAT_FUTURE', 401);
    }

    return {
      subject: parsed.payload.sub,
      email: typeof parsed.payload.email === 'string' ? parsed.payload.email : undefined,
      linkedAccounts: parsed.payload.linked_accounts,
      claims: parsed.payload,
    };
  }

  private async selectJwk(kid?: string): Promise<Record<string, unknown>> {
    const keys = await this.getJwksKeys();
    if (keys.length === 0) {
      throw new AuthError('Privy JWKS is empty', 'JWKS_EMPTY', 500);
    }

    if (kid) {
      const matching = keys.find((key) => typeof key.kid === 'string' && key.kid === kid);
      if (!matching) {
        throw new AuthError('Unable to find matching JWKS key', 'JWKS_KEY_NOT_FOUND', 401);
      }
      return matching;
    }

    if (keys.length === 1) {
      return keys[0];
    }

    throw new AuthError('Privy token missing kid header', 'MISSING_KID', 401);
  }

  private async getJwksKeys(): Promise<Array<Record<string, unknown>>> {
    const nowMs = Date.now();
    if (this.jwksCache && this.jwksCache.expiresAtMs > nowMs) {
      return this.jwksCache.keys;
    }

    const response = await fetch(this.jwksUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AuthError(
        `Failed to fetch JWKS: ${response.status}`,
        'JWKS_FETCH_FAILED',
        502,
      );
    }

    const payload = (await response.json()) as JwksDocument;
    if (!payload || !Array.isArray(payload.keys)) {
      throw new AuthError('Malformed JWKS response', 'JWKS_MALFORMED', 502);
    }

    this.jwksCache = {
      keys: payload.keys,
      expiresAtMs: nowMs + this.jwksCacheSeconds * 1000,
    };

    return payload.keys;
  }

  private issueSessionToken(identity: PrivyIdentity): string {
    const now = this.now();

    const payload: JwtPayload = {
      iss: this.sessionIssuer,
      aud: this.audience,
      sub: identity.subject,
      iat: now,
      exp: now + this.sessionTtlSeconds,
      jti: randomUUID(),
      privySub: identity.subject,
    };

    if (identity.email) {
      payload.email = identity.email;
    }
    if (identity.linkedAccounts !== undefined) {
      payload.linkedAccounts = identity.linkedAccounts;
    }

    const header: JwtHeader = {
      alg: 'HS256',
      typ: 'JWT',
    };

    return encodeJwt(header, payload, this.config.appSecret);
  }

  private hashNonce(nonce: string): string {
    return createHmac('sha256', this.config.appSecret).update(nonce).digest('hex');
  }
}

export function createPrivyAuthFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: PrivyAuthServiceOptions = {},
): PrivyAuthService {
  const appId = env.PRIVY_APP_ID;
  const appSecret = env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new AuthError('PRIVY_APP_ID and PRIVY_APP_SECRET are required', 'CONFIG_ERROR', 500);
  }

  return new PrivyAuthService(
    {
      appId,
      appSecret,
      issuer: env.PRIVY_ISSUER,
      audience: env.PRIVY_AUDIENCE,
      sessionIssuer: env.SESSION_ISSUER,
      sessionTtlSeconds: parseOptionalPositiveInt(env.SESSION_TTL_SECONDS),
      clockToleranceSeconds: parseOptionalPositiveInt(env.CLOCK_TOLERANCE_SECONDS),
      jwksCacheSeconds: parseOptionalPositiveInt(env.JWKS_CACHE_SECONDS),
    },
    options,
  );
}

function parseOptionalPositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AuthError(`Invalid numeric config value: ${value}`, 'CONFIG_ERROR', 500);
  }

  return parsed;
}

function normalizeIssuer(value: string): string {
  return value.replace(/\/+$/, '');
}

function audienceIncludes(aud: string | string[] | undefined, expected: string): boolean {
  if (!aud) {
    return false;
  }

  if (typeof aud === 'string') {
    return aud === expected;
  }

  return aud.includes(expected);
}

function parseJwt(token: string): ParsedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Invalid JWT format', 'INVALID_JWT_FORMAT', 401);
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJsonSegment<JwtHeader>(headerPart, 'JWT_HEADER_INVALID');
  const payload = decodeJsonSegment<JwtPayload>(payloadPart, 'JWT_PAYLOAD_INVALID');
  const signature = decodeBase64Url(signaturePart, 'JWT_SIGNATURE_INVALID');

  return {
    header,
    payload,
    signature,
    signingInput: `${headerPart}.${payloadPart}`,
  };
}

function decodeJsonSegment<T extends Record<string, unknown>>(
  segment: string,
  errorCode: string,
): T {
  const decoded = decodeBase64Url(segment, errorCode);
  try {
    return JSON.parse(decoded.toString('utf8')) as T;
  } catch {
    throw new AuthError('Invalid JWT JSON segment', errorCode, 401);
  }
}

function decodeBase64Url(segment: string, errorCode: string): Buffer {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64');
  } catch {
    throw new AuthError('Invalid base64url segment', errorCode, 401);
  }
}

function encodeBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest();
}

function encodeJwt(header: JwtHeader, payload: JwtPayload, secret: string): string {
  const headerPart = encodeBase64Url(Buffer.from(JSON.stringify(header)));
  const payloadPart = encodeBase64Url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;
  const signaturePart = encodeBase64Url(signHs256(signingInput, secret));

  return `${signingInput}.${signaturePart}`;
}
