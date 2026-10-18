import { beforeEach, describe, expect, it, vi } from 'vitest';
const { state, env, initializeCurrentDraw } = vi.hoisted(() => ({
	state: { building: false, dev: true },
	env: { DEV_AUTH_ENABLED: 'true' },
	initializeCurrentDraw: vi.fn()
}));
vi.mock('$app/env', () => state);
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/current-family.js', () => ({ initializeCurrentDraw, currentFamily: vi.fn(), familySource: vi.fn() }));
const { init } = await import('../src/hooks.server.js');
beforeEach(() => {
	state.building = false;
	state.dev = true;
	env.DEV_AUTH_ENABLED = 'true';
	initializeCurrentDraw.mockReset();
});
describe('server initialization', () => {
	it('never generates draws during a build', async () => {
		state.building = true;
		await init();
		expect(initializeCurrentDraw).not.toHaveBeenCalled();
	});
	it('initializes the development source only with the explicit local bypass', async () => {
		await init();
		expect(initializeCurrentDraw).toHaveBeenCalledWith(true);
	});
	it('always initializes the production source outside dev mode', async () => {
		state.dev = false;
		await init();
		expect(initializeCurrentDraw).toHaveBeenCalledWith(false);
	});
	it('rejects startup if draw initialization fails', async () => {
		initializeCurrentDraw.mockRejectedValue(new Error('Invalid saved draw'));
		await expect(init()).rejects.toThrow('Invalid saved draw');
	});
});
