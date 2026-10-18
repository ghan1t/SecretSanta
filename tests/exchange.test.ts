import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { family, exampleDraw } from '../src/lib/server/family.example.js';
import { parseDraw, parseFamily, recipientForEmail } from '../src/lib/server/exchange.js';
import { readDraw, readFamily } from '../src/lib/server/storage.js';
import { generateDraw } from '../scripts/draw.js';

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
describe('private configuration and saved assignments', () => {
	it('returns only the authenticated giver’s recipient', () => {
		expect(recipientForEmail(family, exampleDraw, 'ALEX@example.test')).toEqual({ name: 'Morgan' });
		expect(recipientForEmail(family, exampleDraw, 'morgan@example.test')).toEqual({ name: 'Jamie' });
		expect(recipientForEmail(family, exampleDraw, 'unknown@example.test')).toBeUndefined();
	});
	it('rejects duplicate normalized emails and IDs', () => {
		const duplicateEmail = structuredClone(family);
		duplicateEmail.participants[1].email = ' ALEX@EXAMPLE.TEST ';
		expect(() => parseFamily(duplicateEmail)).toThrow();
		const duplicateId = structuredClone(family);
		duplicateId.participants[1].id = 'alex';
		expect(() => parseFamily(duplicateId)).toThrow();
	});
	it('rejects changed events, self assignments, duplicate recipients, and changed participant sets', () => {
		expect(() => parseDraw({ ...exampleDraw, eventId: 'another-year' }, family)).toThrow();
		expect(() => parseDraw({ eventId: family.eventId, recipients: { ...exampleDraw.recipients, alex: 'alex' } }, family)).toThrow();
		expect(() => parseDraw({ eventId: family.eventId, recipients: { ...exampleDraw.recipients, alex: 'sam' } }, family)).toThrow();
		const changed = structuredClone(family);
		changed.participants.push({ id: 'new', name: 'New', email: 'new@example.test' });
		expect(() => parseDraw(exampleDraw, changed)).toThrow();
	});
	it('atomically saves a valid stable draw and refuses to overwrite it', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'secret-santa-test-'));
		temporaryDirectories.push(directory);
		const config = join(directory, 'family.json');
		const output = join(directory, 'draw.json');
		await writeFile(config, JSON.stringify(family));
		await generateDraw(config, output);
		const saved = await readFile(output, 'utf8');
		const first = await readDraw(output, await readFamily(config));
		expect(Object.keys(first.recipients)).toHaveLength(4);
		expect(new Set(Object.values(first.recipients)).size).toBe(4);
		for (const [giver, recipient] of Object.entries(first.recipients)) expect(recipient).not.toBe(giver);
		await expect(generateDraw(config, output)).rejects.toThrow();
		expect(await readFile(output, 'utf8')).toBe(saved);
		expect(await readDraw(output, family)).toEqual(first);
	});
	it('does not fabricate a draw when storage is missing or malformed', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'secret-santa-test-'));
		temporaryDirectories.push(directory);
		await expect(readFamily(undefined)).rejects.toThrow();
		await expect(readDraw(join(directory, 'missing.json'), family)).rejects.toThrow();
		const corrupt = join(directory, 'broken.json');
		await writeFile(corrupt, '{');
		await expect(readDraw(corrupt, family)).rejects.toThrow();
	});
});
