import { json } from '@sveltejs/kit';
import { currentDraw, currentFamily } from '#lib/server/current-family.js';
import { recipientForEmail } from '#lib/server/exchange.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (request.headers.get('origin') !== url.origin) return json({ error: 'This request could not be verified.' }, { status: 403 });
	if (!locals.identity) return json({ error: 'Please sign in again.' }, { status: 401 });
	// This endpoint accepts no participant ID; identity always comes from the server hook.
	if ((await request.text()).trim()) return json({ error: 'No participant selection is accepted.' }, { status: 400 });
	try {
		const family = await currentFamily(locals.localMode);
		// Deny unknown identities before opening the private assignment file.
		if (!family.participants.some(({ email }) => email === locals.identity?.email)) {
			return json({ error: 'This account is not on the family list.' }, { status: 403 });
		}
		const draw = await currentDraw(locals.localMode, family);
		const recipient = recipientForEmail(family, draw, locals.identity.email);
		return json({ recipient });
	} catch {
		return json({ error: 'Your assignment is not available yet. Please contact the organizer.' }, { status: 503 });
	}
};
