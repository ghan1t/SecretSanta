import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { family, exampleDraw } from '../src/lib/server/family.example.js';
import { ensureDraw } from '../src/lib/server/draw.js';
import { readDraw } from '../src/lib/server/storage.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function location() {
	const directory = await mkdtemp(join(tmpdir(), 'secret-santa-startup-'));
	directories.push(directory);
	return { directory, path: join(directory, 'draw.private.json') };
}
describe('automatic startup draw', () => {
	it('creates a missing draw that satisfies exclusions, then preserves it across starts', async () => {
		const { path } = await location();
		await ensureDraw(path, family);
		const saved = await readFile(path, 'utf8');
		const draw = await readDraw(path, family);
		for (const rule of family.exclusions) expect(draw.recipients[rule.giver]).not.toBe(rule.recipient);
		await ensureDraw(path, family);
		expect(await readFile(path, 'utf8')).toBe(saved);
	});
	it('preserves an existing valid draw byte for byte', async () => {
		const { path } = await location();
		const saved = JSON.stringify(exampleDraw);
		await writeFile(path, saved);
		await ensureDraw(path, family);
		expect(await readFile(path, 'utf8')).toBe(saved);
	});
	it('rejects existing malformed or mismatched draws without replacing them', async () => {
		const { path } = await location();
		for (const saved of ['', '{', JSON.stringify({ ...exampleDraw, eventId: 'wrong-event' })]) {
			await writeFile(path, saved);
			await expect(ensureDraw(path, family)).rejects.toThrow();
			expect(await readFile(path, 'utf8')).toBe(saved);
		}
	});
	it('rejects unreadable files instead of treating them as absent', async () => {
		const { path } = await location();
		const saved = JSON.stringify(exampleDraw);
		await writeFile(path, saved);
		await chmod(path, 0o000);
		try { await expect(ensureDraw(path, family)).rejects.toMatchObject({ code: 'EACCES' }); }
		finally { await chmod(path, 0o600); }
		expect(await readFile(path, 'utf8')).toBe(saved);
	});
	it('publishes one valid draw when multiple server instances start together', async () => {
		const { directory, path } = await location();
		await Promise.all(Array.from({ length: 12 }, () => ensureDraw(path, family)));
		const saved = await readFile(path, 'utf8');
		expect(await readDraw(path, family)).toBeDefined();
		expect(await readdir(directory)).toEqual(['draw.private.json']);
		await ensureDraw(path, family);
		expect(await readFile(path, 'utf8')).toBe(saved);
	});
	it('fails without a path or with impossible rules, leaving no file', async () => {
		await expect(ensureDraw(undefined, family)).rejects.toThrow();
		const { path } = await location();
		await expect(ensureDraw(path, { ...family, participants: family.participants.slice(0, 2) })).rejects.toThrow();
		await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
	});
});
