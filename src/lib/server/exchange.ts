export type Participant = { id: string; name: string; email: string };
export type Exclusion = { giver: string; recipient: string };
export type Family = {
	eventId: string;
	year: number;
	participants: Participant[];
	exclusions: Exclusion[];
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
	if (value.exclusions !== undefined && !Array.isArray(value.exclusions)) {
		throw new Error('Exclusions must be an array.');
	}
	const exclusions = (value.exclusions ?? []).map((entry: unknown): Exclusion => {
		if (!record(entry) || typeof entry.giver !== 'string' || typeof entry.recipient !== 'string' ||
			!ids.has(entry.giver) || !ids.has(entry.recipient)) {
			throw new Error('Exclusions must reference configured participant IDs.');
		}
		return { giver: entry.giver, recipient: entry.recipient };
	});
	return { eventId: value.eventId, year: value.year as number, participants, exclusions };
}
export function pairingAllowed(family: Family, giver: string, recipient: string): boolean {
	return giver !== recipient && !family.exclusions.some((rule) => rule.giver === giver && rule.recipient === recipient);
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
			!pairingAllowed(family, giver, recipient) || recipients.has(recipient)) throw new Error('Invalid saved draw.');
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
