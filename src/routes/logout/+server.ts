import { error, redirect } from '@sveltejs/kit';
import { DEVELOPMENT_COOKIE } from '#lib/server/cloudflare.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals, request, url, cookies }) => {
	if (request.headers.get('origin') !== url.origin) error(403);
	cookies.delete(DEVELOPMENT_COOKIE, { path: '/' });
	// Access revokes its application session; the Google account itself remains signed in.
	redirect(303, locals.localMode ? '/' : '/cdn-cgi/access/logout');
};
