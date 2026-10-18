import { readFile } from 'node:fs/promises';
import { parseDraw, parseFamily, type Family, type Draw } from './exchange.js';

export async function readFamily(path: string | undefined): Promise<Family> {
	if (!path) throw new Error('FAMILY_CONFIG_PATH is required.');
	return parseFamily(JSON.parse(await readFile(path, 'utf8')));
}
export async function readDraw(path: string | undefined, family: Family): Promise<Draw> {
	if (!path) throw new Error('DRAW_PATH is required.');
	return parseDraw(JSON.parse(await readFile(path, 'utf8')), family);
}
