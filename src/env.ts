import { defineEnvVars } from '@sveltejs/kit/env';

// Private runtime values. No value is embedded in the client or fixed at build time.
const optional = { schema: (value: string | undefined) => value };
export const variables = defineEnvVars({
	DEV_AUTH_ENABLED: optional,
	CF_ACCESS_ISSUER: optional,
	CF_ACCESS_AUDIENCE: optional,
	FAMILY_CONFIG_PATH: optional,
	DRAW_PATH: optional
});
