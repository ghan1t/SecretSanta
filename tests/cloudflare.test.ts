import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig, localIdentityEnabled, verifyAccessToken } from '../src/lib/server/cloudflare.js';

const config = { issuer: 'https://family.cloudflareaccess.com', audience: 'family-app' };
let keys: ReturnType<typeof createLocalJWKSet>;
let privateKey: CryptoKey;
let otherKey: CryptoKey;
beforeAll(async () => {
	const pair = await generateKeyPair('RS256');
	privateKey = pair.privateKey;
	otherKey = (await generateKeyPair('RS256')).privateKey;
	keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test', alg: 'RS256' }] });
});
async function token(overrides: Record<string, unknown> = {}, signingKey?: CryptoKey) {
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({ email: 'Alex@Example.Test', type: 'app', iss: config.issuer, aud: config.audience,
		sub: 'google-user', iat: now, exp: now + 600, ...overrides })
		.setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(signingKey ?? privateKey);
}
describe('Cloudflare identity verification', () => {
	it('verifies a signed application identity', async () => {
		await expect(verifyAccessToken(await token(), config, keys)).resolves.toEqual({ email: 'alex@example.test', subject: 'google-user' });
	});
	it.each([
		['expired', { exp: 1 }], ['wrong audience', { aud: 'another-app' }],
		['wrong issuer', { iss: 'https://attacker.example' }], ['not yet valid', { nbf: 9999999999 }],
		['future issued time', { iat: 9999999999 }], ['missing email', { email: undefined }],
		['missing expiry', { exp: undefined }], ['service token', { type: 'service' }]
	])('rejects %s', async (_, claims) => {
		await expect(verifyAccessToken(await token(claims), config, keys)).rejects.toThrow();
	});
	it('rejects a forged signature', async () => {
		await expect(verifyAccessToken(await token({}, otherKey), config, keys)).rejects.toThrow();
	});
	it('rejects unsigned JWTs', async () => {
		await expect(verifyAccessToken('eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImFsZXhAZXhhbXBsZS50ZXN0In0.', config, keys)).rejects.toThrow();
	});
	it('never enables the selector in production', () => {
		expect(localIdentityEnabled(false, 'true')).toBe(false);
		expect(localIdentityEnabled(true, undefined)).toBe(false);
		expect(localIdentityEnabled(true, 'true')).toBe(true);
	});
	it('requires a configured HTTPS team issuer and audience', () => {
		expect(() => accessConfig(undefined, 'aud')).toThrow();
		expect(() => accessConfig('https://evil.example', 'aud')).toThrow();
		expect(() => accessConfig('http://family.cloudflareaccess.com', 'aud')).toThrow();
		expect(accessConfig(config.issuer + '/', config.audience)).toEqual(config);
	});
});
