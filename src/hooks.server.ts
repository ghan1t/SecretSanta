import { dev } from '$app/env';
import * as env from '$app/env/private';
import type { Handle } from '@sveltejs/kit/hooks';
import { accessConfig, DEVELOPMENT_COOKIE, localIdentityEnabled, verifyAccessToken } from '#lib/server/cloudflare.js';

export const handle: Handle = async ({ event, resolve }) => {
	const localMode = localIdentityEnabled(dev, env.DEV_AUTH_ENABLED);
	event.locals.localMode = localMode;
	event.locals.identity = null;
	event.locals.authStatus = 'signed-out';
	if (localMode) {
		if (!['localhost', '127.0.0.1', '[::1]'].includes(event.url.hostname)) {
			return new Response('Development identities are available only on loopback hosts.', {
				status: 403, headers: { 'Cache-Control': 'private, no-store' }
			});
		}
		const selection = event.cookies.get(DEVELOPMENT_COOKIE);
		if (selection) {
			// Ignore all real files and JWTs in this mode. IDs map only to synthetic fixtures.
			const { family } = await import('#lib/server/family.example.js');
			const participant = family.participants.find(({ id }) => id === selection);
			event.locals.identity = { email: participant?.email ?? 'unknown@example.test', subject: `development:${selection}` };
			event.locals.authStatus = 'authenticated';
		}
	} else {
		try {
			const config = accessConfig(env.CF_ACCESS_ISSUER, env.CF_ACCESS_AUDIENCE);
			const token = event.request.headers.get('Cf-Access-Jwt-Assertion');
			if (token) {
				event.locals.identity = await verifyAccessToken(token, config);
				event.locals.authStatus = 'authenticated';
			}
		} catch {
			// No forwarded-email or development-cookie fallback. Do not log token/claims.
			event.locals.authStatus = 'unavailable';
		}
	}
	const response = await resolve(event);
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
