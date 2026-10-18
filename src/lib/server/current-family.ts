import * as env from '$app/env/private';
import { readDraw, readFamily } from './storage.js';
import type { Family } from './exchange.js';

export async function currentFamily(localMode: boolean) {
	if (localMode) return (await import('./family.example.js')).family;
	return readFamily(env.FAMILY_CONFIG_PATH);
}
export async function currentDraw(localMode: boolean, family: Family) {
	if (localMode) return (await import('./family.example.js')).exampleDraw;
	return readDraw(env.DRAW_PATH, family);
}
