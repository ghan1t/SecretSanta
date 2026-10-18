import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFamily } from '../src/lib/server/storage.js';
import { pairingAllowed, parseDraw } from '../src/lib/server/exchange.js';

export async function generateDraw(configPath: string, outputPath: string) {
	const family = await readFamily(configPath);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [config, output, ...extra] = process.argv.slice(2);
	if (!config || !output || extra.length) {
		console.error('Usage: npm run draw -- config/family.private.json config/draw.private.json');
		process.exitCode = 1;
	} else {
		try {
			await generateDraw(config, output);
			console.log('Draw saved. Existing draws are never overwritten. Keep this private file backed up.');
		} catch {
			console.error('Draw not saved. Check configuration, file permissions, and whether a draw already exists.');
			process.exitCode = 1;
		}
	}
}
