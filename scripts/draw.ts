import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFamily } from '../src/lib/server/storage.js';
import { writeNewDraw } from '../src/lib/server/draw.js';

export async function generateDraw(configPath: string, outputPath: string) {
	await writeNewDraw(await readFamily(configPath), outputPath);
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
