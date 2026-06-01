import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MobileTokenClaims {
    sub: string;
    tenantId: string;
    role: string;
    type: 'access' | 'refresh';
    iat: number;
    exp: number;
}

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function base64UrlEncode(input: string | Buffer): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
}

function getMobileAuthSecret(): string {
    const secret =
        process.env['MOBILE_AUTH_SECRET']
        || process.env['SUPABASE_JWT_SECRET']
        || process.env['NEXTAUTH_SECRET'];

    if (!secret || secret.length < 32) {
        throw new Error('MOBILE_AUTH_SECRET ausente ou muito curto. Defina ao menos 32 caracteres no ambiente.');
    }

    return secret;
}

function signToken(claims: MobileTokenClaims): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(claims));
    const message = `${encodedHeader}.${encodedPayload}`;

    const signature = createHmac('sha256', getMobileAuthSecret())
        .update(message)
        .digest();

    return `${message}.${base64UrlEncode(signature)}`;
}

function verifyToken(token: string): MobileTokenClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const message = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = createHmac('sha256', getMobileAuthSecret())
        .update(message)
        .digest();

    const receivedSignature = Buffer.from(
        encodedSignature.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedSignature.length / 4) * 4, '='),
        'base64',
    );

    if (expectedSignature.length !== receivedSignature.length) return null;
    if (!timingSafeEqual(expectedSignature, receivedSignature)) return null;

    const payloadRaw = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadRaw) as MobileTokenClaims;

    if (!payload?.sub || !payload?.tenantId || !payload?.type || !payload?.exp) {
        return null;
    }

    if (Date.now() >= payload.exp * 1000) {
        return null;
    }

    return payload;
}

export function issueMobileTokenPair(input: {
    userId: string;
    tenantId: string;
    role: string;
}): {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: string;
    refreshExpiresAt: string;
} {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const accessExp = nowSeconds + ACCESS_TTL_SECONDS;
    const refreshExp = nowSeconds + REFRESH_TTL_SECONDS;

    const accessToken = signToken({
        sub: input.userId,
        tenantId: input.tenantId,
        role: input.role,
        type: 'access',
        iat: nowSeconds,
        exp: accessExp,
    });

    const refreshToken = signToken({
        sub: input.userId,
        tenantId: input.tenantId,
        role: input.role,
        type: 'refresh',
        iat: nowSeconds,
        exp: refreshExp,
    });

    return {
        accessToken,
        refreshToken,
        accessExpiresAt: new Date(accessExp * 1000).toISOString(),
        refreshExpiresAt: new Date(refreshExp * 1000).toISOString(),
    };
}

export async function verifyMobileAccessToken(token: string): Promise<MobileTokenClaims | null> {
    const claims = verifyToken(token);
    if (!claims || claims.type !== 'access') return null;
    return claims;
}

export async function verifyMobileRefreshToken(token: string): Promise<MobileTokenClaims | null> {
    const claims = verifyToken(token);
    if (!claims || claims.type !== 'refresh') return null;
    return claims;
}
