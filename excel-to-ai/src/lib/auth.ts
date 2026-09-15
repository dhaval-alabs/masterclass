import { SignJWT, jwtVerify } from 'jose';

export type AdminSession = {
  sub: string;
  iat: number;
  exp: number;
};

const ALG = 'HS256';
const ISSUER = 'excel-to-ai';
const AUDIENCE = 'admin';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_JWT_SECRET is missing or shorter than 32 chars');
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminSession(username: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(username)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifyAdminSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}
