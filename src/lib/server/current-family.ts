import * as env from '$app/env/private';
import { readDraw, readFamily } from './storage.js';
import type { Family } from './exchange.js';
import { ensureDraw } from './draw.js';

export function familySource(localMode: boolean): 'fictional' | 'private' {
	// Production always uses private files, regardless of development settings.
	if (!localMode) return 'private';
	const source = env.DEV_FAMILY_SOURCE ?? 'fictional';
	if (source !== 'fictional' && source !== 'private') throw new Error('Invalid DEV_FAMILY_SOURCE.');
	return source;
}
export async function currentFamily(localMode: boolean) {
	if (familySource(localMode) === 'fictional') return (await import('./family.example.js')).family;
	return readFamily(env.FAMILY_CONFIG_PATH);
}
export async function currentDraw(localMode: boolean, family: Family) {
	if (familySource(localMode) === 'fictional') return (await import('./family.example.js')).exampleDraw;
	// Private-family previews have their own saved draw; never fall back to the real draw.
	return readDraw(localMode ? env.DEV_DRAW_PATH : env.DRAW_PATH, family);
}

export async function initializeCurrentDraw(localMode: boolean): Promise<void> {
	if (familySource(localMode) === 'fictional') return;
	const family = await currentFamily(localMode);
	await ensureDraw(localMode ? env.DEV_DRAW_PATH : env.DRAW_PATH, family);
}
