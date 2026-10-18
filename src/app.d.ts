import type { Identity } from '#lib/server/cloudflare.js';
declare global {
	namespace App {
		interface Locals {
			localMode: boolean;
			identity: Identity | null;
			authStatus: 'signed-out' | 'authenticated' | 'unavailable';
		}
	}
}
export {};
