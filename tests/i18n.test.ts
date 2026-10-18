import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import lv from '../messages/lv.json';
import { m } from '../src/lib/paraglide/messages.js';
import { getLocale } from '../src/lib/paraglide/runtime.js';
import { paraglideMiddleware } from '../src/lib/paraglide/server.js';

describe('English and Latvian localization', () => {
	it('has matching translations and interpolation parameters', () => {
		expect(Object.keys(lv).sort()).toEqual(Object.keys(en).sort());
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			expect(lv[key].trim().length).toBeGreaterThan(0);
			expect(lv[key].match(/\{[^}]+\}/g) ?? []).toEqual(en[key].match(/\{[^}]+\}/g) ?? []);
		}
	});
	it('isolates simultaneous request locales and defaults invalid cookies to English', async () => {
		const render = (cookie: string, delay: number) => paraglideMiddleware(
			new Request('http://localhost/', { headers: { cookie } }),
			async () => {
				await new Promise((resolve) => setTimeout(resolve, delay));
				return new Response(JSON.stringify({ locale: getLocale(), text: m.reveal_person() }));
			}
		);
		const responses = await Promise.all([
			render('santa_language=lv', 10), render('santa_language=en', 0), render('santa_language=invalid', 5)
		]);
		expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
			{ locale: 'lv', text: lv.reveal_person },
			{ locale: 'en', text: en.reveal_person },
			{ locale: 'en', text: en.reveal_person }
		]);
	});
});
