import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { building, dev } from '$app/env';
import * as env from '$app/env/private';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { accessConfig, DEVELOPMENT_COOKIE, localIdentityEnabled, verifyAccessToken } from '#lib/server/cloudflare.js';
import { currentFamily, familySource, initializeCurrentDraw } from '#lib/server/current-family.js';

export const init: ServerInit = async () => {
	// Build analysis must not read private data or create an event's draw.
	if (building) return;
	await initializeCurrentDraw(localIdentityEnabled(dev, env.DEV_AUTH_ENABLED));
};

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
			try {
				const source = familySource(true);
				// Bind selection to the data source so switching files requires a new selection.
				if (selection.startsWith(`${source}:`)) {
					const family = await currentFamily(true);
					const participant = family.participants.find(({ id }) => `${source}:${id}` === selection);
					event.locals.identity = { email: participant?.email ?? 'unknown@example.test', subject: `development:${selection}` };
					event.locals.authStatus = 'authenticated';
				}
			} catch {
				event.locals.authStatus = 'unavailable';
			}
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
	const response = await paraglideMiddleware(event.request, ({ request, locale }) =>
		resolve({ ...event, request }, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		})
	);
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
