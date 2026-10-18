import { currentFamily } from '#lib/server/current-family.js';
import { participantForEmail } from '#lib/server/exchange.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const empty = { event: null, user: null };
	const developmentPeople = locals.localMode
		? (await currentFamily(true)).participants.map(({ id, name }) => ({ id, name })) : [];
	const common = { localMode: locals.localMode, developmentPeople };
	if (!locals.identity) return { ...common, ...empty, state: locals.authStatus };
	try {
		const family = await currentFamily(locals.localMode);
		const person = participantForEmail(family, locals.identity.email);
		if (!person) return { ...common, ...empty, state: 'unknown' as const };
		return {
			...common,
			state: 'ready' as const,
			user: { id: person.id, name: person.name },
			event: { year: family.year }
		};
	} catch {
		return { ...common, ...empty, state: 'unavailable' as const };
	}
};
