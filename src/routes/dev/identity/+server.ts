import { error, redirect } from '@sveltejs/kit';
import { DEVELOPMENT_COOKIE } from '#lib/server/cloudflare.js';
import { currentFamily, familySource } from '#lib/server/current-family.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url, cookies }) => {
	if (!locals.localMode) error(404);
	if (request.headers.get('origin') !== url.origin) error(403);
	const value = (await request.formData()).get('identity');
	const family = await currentFamily(true);
	if (typeof value !== 'string' || (value !== '' && value !== 'unknown' && !family.participants.some(({ id }) => id === value))) error(400);
	if (!value) cookies.delete(DEVELOPMENT_COOKIE, { path: '/' });
	else cookies.set(DEVELOPMENT_COOKIE, `${familySource(true)}:${value}`, {
		path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 8
	});
	redirect(303, '/');
};
