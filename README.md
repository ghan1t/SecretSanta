# Family Secret Santa

Svelte 5 + SvelteKit 3 + TypeScript. Google login is handled by Cloudflare Access; the app verifies its signed identity and reveals only that participant's saved recipient. No app signup, shared password, name picker, email service, or user database is needed.

## Local development without Cloudflare

Use Node 22.17+ and npm (the current workspace uses Homebrew Node).

```sh
npm ci
cp .env.example .env  # only if you do not already have .env
npm run dev -- --host 127.0.0.1
```

This workspace already has an ignored `.env` enabling `DEV_AUTH_ENABLED=true`. The development toolbar lets you test Alex, Jamie, Morgan, Sam, signed-out, and unknown-account states. These are fictional identities with a fixed example draw; there are no working passwords or codes anymore.

The selector requires both SvelteKit development mode and the explicit flag. It is loopback-only and always uses synthetic fixtures, ignoring real private files. `npm run preview` and production ignore the flag and selector cookies, even if the flag is accidentally left enabled. Never expose the development server publicly; disable the flag when testing real Access through a tunnel.

```sh
npm test
npm run check
npm run build
```

Tests verify signed/forged/expired/wrong-audience JWTs, fail-closed identity handling, participant authorization, private-file validation, stable draws, and overwrite prevention. Browser/HTTP checks also cover local reveal/hide, identity switching, and the production guard. Real Google redirects and Cloudflare key delivery still need an Access integration test.

## File-based family data

This version targets a Node server with persistent private files. See [storage details](docs/STORAGE.md).

1. Copy `config/family.example.json` to ignored `config/family.private.json`.
2. Replace synthetic participants with real names and the exact email addresses returned by their Google accounts. Use one unique email per person.
3. Set the event ID, year, date, and budget. Generate the draw once:

```sh
npm run draw -- config/family.private.json data/draw.private.json
```

The command uses secure randomness, validates a one-to-one draw with no self assignments, and atomically creates a private file. It refuses to overwrite an existing draw. The web app never generates or changes the draw.

Keep both files outside `static/`, out of Git, backed up, and persistent across deployments. The operator can read the files. Do not generate the real draw until the participant list is final.

## Cloudflare Google login

See [setup and local testing](docs/LOCAL-AUTH.md). Configure private runtime variables in `.env` locally, or your production process environment:

```dotenv
DEV_AUTH_ENABLED=false
CF_ACCESS_ISSUER=https://your-team.cloudflareaccess.com
CF_ACCESS_AUDIENCE=your-access-application-audience
FAMILY_CONFIG_PATH=config/family.private.json
DRAW_PATH=data/draw.private.json
```

Use an Access application with Google as its login method and an explicit family-email Allow policy. Protect the entire hostname, including the API, and secure the origin against bypass. The server validates `Cf-Access-Jwt-Assertion` using the team's JWKS, issuer, audience, algorithm, expiry, and required identity claims. Plain forwarded email headers grant nothing.

Access manages browser login/session expiry; the app revalidates the token on every request and needs no separate session database. Sign out routes through the Access application logout endpoint; it does not sign the person out of Google itself. Shared-device account switching needs a real integration check.

Select a Node deployment adapter before hosting. The scaffold retains `adapter-auto`; it is not yet a configured production deployment. Cloudflare Workers do not provide this private filesystem layout, so that deployment would need a storage change.

## Project notes

- [Current requirements](docs/REQUIREMENTS.md)
- [Local authentication and Cloudflare setup](docs/LOCAL-AUTH.md)
- [File storage and operations](docs/STORAGE.md)
- [Original alternatives research](docs/AUTH-OPTIONS.md)
- [Interactive UI preview](docs/mockups.html) — animated envelope and letter with fictional names.

Generated with the official Svelte CLI. Implementation follows [Svelte LLM guidelines](https://svelte.dev/llms.txt); SvelteKit 3 uses `$app/env`, private variables declared in `src/env.ts`, and the Vite Kit plugin configuration.
