import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AccessConfig = { issuer: string; audience: string };
export type Identity = { email: string; subject: string };
export function accessConfig(issuer: string | undefined, audience: string | undefined): AccessConfig {
	if (!issuer || !audience) throw new Error('Cloudflare Access is not configured.');
	const url = new URL(issuer);
	if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname) ||
		url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port) {
		throw new Error('Invalid Cloudflare Access issuer.');
	}
	return { issuer: url.origin, audience };
}
const keySets = new Map<string, JWTVerifyGetKey>();
export function accessKeys(config: AccessConfig): JWTVerifyGetKey {
	let keys = keySets.get(config.issuer);
	if (!keys) {
		keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', config.issuer));
		keySets.set(config.issuer, keys);
	}
	return keys;
}
export async function verifyAccessToken(token: string, config: AccessConfig, keys = accessKeys(config)): Promise<Identity> {
	const { payload } = await jwtVerify(token, keys, {
		issuer: config.issuer,
		audience: config.audience,
		algorithms: ['RS256'],
		requiredClaims: ['exp', 'iat', 'sub', 'email'],
		clockTolerance: 5
	});
	if (typeof payload.email !== 'string' || !payload.email.trim() ||
		typeof payload.sub !== 'string' || !payload.sub ||
		typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 5 ||
		payload.type !== 'app') throw new Error('Invalid Access identity.');
	return { email: payload.email.trim().toLowerCase(), subject: payload.sub };
}
export function localIdentityEnabled(isDevelopment: boolean, setting: string | undefined): boolean {
	return isDevelopment && setting === 'true';
}
export const DEVELOPMENT_COOKIE = 'santa_dev_identity';
