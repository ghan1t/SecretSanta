import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readDraw } from './storage.js';
import { pairingAllowed, parseDraw, type Family } from './exchange.js';

export async function writeNewDraw(family: Family, outputPath: string) {
	const ids = family.participants.map(({ id }) => id);
	let shuffled: string[] = [];
	// Reject invalid uniform shuffles to keep accepted draws uniform, including exclusions.
	for (let attempt = 0; attempt < 10000; attempt++) {
		shuffled = [...ids];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = randomInt(i + 1);
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		if (shuffled.every((id, index) => pairingAllowed(family, ids[index], id))) break;
		if (attempt === 9999) throw new Error('Could not generate a draw within 10000 attempts. Check whether the exclusions are too restrictive.');
	}
	const draw = parseDraw({ eventId: family.eventId, recipients: Object.fromEntries(ids.map((id, i) => [id, shuffled[i]])) }, family);
	const destination = resolve(outputPath);
	await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
	const temporary = `${destination}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, `${JSON.stringify(draw, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
		// Publish a complete file atomically; link fails if a draw already exists.
		await link(temporary, destination);
	} finally {
		await unlink(temporary).catch(() => {});
	}
}

function hasCode(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export async function ensureDraw(path: string | undefined, family: Family): Promise<void> {
	if (!path) throw new Error('A draw file path is required.');
	try {
		await readDraw(path, family);
		return;
	} catch (error) {
		// Only a genuinely absent file permits generation. Invalid/unreadable files stay untouched.
		if (!hasCode(error, 'ENOENT')) throw error;
	}
	try {
		await writeNewDraw(family, path);
	} catch (error) {
		// Another starting process may have published its complete draw first.
		if (!hasCode(error, 'EEXIST')) throw error;
	}
	await readDraw(path, family);
}
