import { beforeEach, describe, expect, it, vi } from 'vitest';
import { family, exampleDraw } from '../src/lib/server/family.example.js';

const { env, readFamily, readDraw } = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	readFamily: vi.fn(),
	readDraw: vi.fn()
}));
vi.mock('$app/env/private', () => env);
vi.mock('../src/lib/server/storage.js', () => ({ readFamily, readDraw }));
const { currentFamily, currentDraw, familySource } = await import('../src/lib/server/current-family.js');

beforeEach(() => {
	for (const key of Object.keys(env)) env[key] = undefined;
	env.DEV_FAMILY_SOURCE = undefined;
	vi.resetAllMocks();
	env.FAMILY_CONFIG_PATH = 'config/family.private.json';
	env.DRAW_PATH = 'config/draw.private.json';
	env.DEV_DRAW_PATH = 'config/draw.dev.private.json';
	readFamily.mockResolvedValue(family);
	readDraw.mockImplementation(async (path) => {
		if (!path) throw new Error('Missing draw path');
		return exampleDraw;
	});
});
describe('development family data source', () => {
	it('defaults to fictional data without reading private files', async () => {
		expect(familySource(true)).toBe('fictional');
		expect(await currentFamily(true)).toEqual(family);
		expect(await currentDraw(true, family)).toEqual(exampleDraw);
		expect(readFamily).not.toHaveBeenCalled();
		expect(readDraw).not.toHaveBeenCalled();
	});
	it('uses the configured private family and separate dev draw when opted in', async () => {
		env.DEV_FAMILY_SOURCE = 'private';
		await currentFamily(true);
		await currentDraw(true, family);
		expect(readFamily).toHaveBeenCalledWith('config/family.private.json');
		expect(readDraw).toHaveBeenCalledWith('config/draw.dev.private.json', family);
	});
	it('does not fall back to the production draw when the dev path is missing', async () => {
		env.DEV_FAMILY_SOURCE = 'private';
		env.DEV_DRAW_PATH = undefined;
		await expect(currentDraw(true, family)).rejects.toThrow();
		expect(readDraw).not.toHaveBeenCalledWith('config/draw.private.json', family);
	});
	it('ignores development settings outside local bypass mode', async () => {
		env.DEV_AUTH_ENABLED = 'true';
		env.DEV_FAMILY_SOURCE = 'fictional';
		expect(familySource(false)).toBe('private');
		await currentFamily(false);
		await currentDraw(false, family);
		expect(readFamily).toHaveBeenCalledWith('config/family.private.json');
		expect(readDraw).toHaveBeenCalledWith('config/draw.private.json', family);
	});
	it('rejects unknown development sources instead of choosing a file implicitly', async () => {
		env.DEV_FAMILY_SOURCE = 'typo';
		await expect(currentFamily(true)).rejects.toThrow('Invalid DEV_FAMILY_SOURCE');
	});
});
