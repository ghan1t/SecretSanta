export type Participant = { id: string; name: string; email: string };
export type Family = {
	eventId: string;
	year: number;
	exchangeDate: string;
	budget: string;
	participants: Participant[];
};
export type Draw = { eventId: string; recipients: Record<string, string> };

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}
export function normalizeEmail(email: string): string {
	// Do not strip Gmail dots or +aliases: map exactly the verified configured account.
	return email.trim().toLowerCase();
}
export function parseFamily(value: unknown): Family {
	if (!record(value) || !nonempty(value.eventId) || !Number.isInteger(value.year) ||
		!nonempty(value.exchangeDate) || typeof value.budget !== 'string' ||
		!Array.isArray(value.participants) || value.participants.length < 2) {
		throw new Error('Invalid family configuration.');
	}
	const ids = new Set<string>();
	const emails = new Set<string>();
	const participants = value.participants.map((entry: unknown): Participant => {
		if (!record(entry) || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(entry.id) ||
			!nonempty(entry.name) || typeof entry.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email.trim())) {
			throw new Error('Invalid participant configuration.');
		}
		const email = normalizeEmail(entry.email);
		if (ids.has(entry.id) || emails.has(email)) throw new Error('Participant IDs and emails must be unique.');
		ids.add(entry.id);
		emails.add(email);
		return { id: entry.id, name: entry.name.trim(), email };
	});
	return { eventId: value.eventId, year: value.year as number, exchangeDate: value.exchangeDate, budget: value.budget, participants };
}
export function parseDraw(value: unknown, family: Family): Draw {
	if (!record(value) || value.eventId !== family.eventId || !record(value.recipients)) {
		throw new Error('Draw does not match this event.');
	}
	const entries = Object.entries(value.recipients);
	const ids = new Set(family.participants.map(({ id }) => id));
	const recipients = new Set<string>();
	if (entries.length !== ids.size) throw new Error('Draw participants have changed.');
	for (const [giver, recipient] of entries) {
		if (!ids.has(giver) || typeof recipient !== 'string' || !ids.has(recipient) ||
			giver === recipient || recipients.has(recipient)) throw new Error('Invalid saved draw.');
		recipients.add(recipient);
	}
	return { eventId: family.eventId, recipients: Object.fromEntries(entries) as Record<string, string> };
}
export function participantForEmail(family: Family, email: string): Participant | undefined {
	return family.participants.find((participant) => participant.email === normalizeEmail(email));
}
export function recipientForEmail(family: Family, draw: Draw, email: string): { name: string } | undefined {
	const giver = participantForEmail(family, email);
	if (!giver) return;
	const recipientId = draw.recipients[giver.id];
	const recipient = family.participants.find(({ id }) => id === recipientId);
	if (!recipient) throw new Error('Missing saved assignment.');
	return { name: recipient.name };
}
