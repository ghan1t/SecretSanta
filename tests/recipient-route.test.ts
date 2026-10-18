import { describe, expect, it, vi } from 'vitest';
import { family, exampleDraw } from '../src/lib/server/family.example.js';

vi.mock('#lib/server/current-family.js', () => ({ currentFamily: async () => family, currentDraw: async () => exampleDraw }));
const { POST } = await import('../src/routes/api/recipient/+server.js');
function event(email: string | null, body?: string, origin = 'http://localhost:5173') {
	return {
		locals: { localMode: true, identity: email ? { email, subject: 'test' } : null },
		url: new URL('http://localhost:5173/api/recipient'),
		request: new Request('http://localhost:5173/api/recipient', { method: 'POST', headers: { Origin: origin }, body })
	} as Parameters<typeof POST>[0];
}
describe('recipient endpoint authorization', () => {
	it('returns only the signed-in identity’s saved recipient', async () => {
		const response = await POST(event('alex@example.test'));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ recipient: { name: 'Morgan' } });
	});
	it('rejects a request attempting to select another participant', async () => {
		const response = await POST(event('alex@example.test', JSON.stringify({ participantId: 'morgan' })));
		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).not.toContain('Jamie');
	});
	it('rejects signed-out, unknown, and cross-origin requests', async () => {
		expect((await POST(event(null))).status).toBe(401);
		expect((await POST(event('unknown@example.test'))).status).toBe(403);
		expect((await POST(event('alex@example.test', undefined, 'https://attacker.example'))).status).toBe(403);
	});
});
