# Family Secret Santa

Svelte 5 + SvelteKit 3 + TypeScript. Google login is handled by Cloudflare Access; the app verifies its signed identity and reveals only that participant's saved recipient. No app signup, shared password, name picker, email service, or user database is needed.

## Local development without Cloudflare

Use Node 22.17+ and npm (the current workspace uses Homebrew Node).

```sh
npm ci
cp .env.example .env  # only if you do not already have .env
npm run dev -- --host 127.0.0.1
```

This workspace has an ignored `.env` with `DEV_AUTH_ENABLED=true` to bypass Cloudflare locally. Choose the data source independently:

```dotenv
DEV_AUTH_ENABLED=true
DEV_FAMILY_SOURCE=fictional
```

`fictional` (the default) uses committed `config/family.example.json`: Alex, Jamie, Morgan, and Sam, with a fixed fictional draw. The dev toolbar explicitly labels these people **fictional**.

To use your private family configuration with the same local identity selector:

```dotenv
DEV_AUTH_ENABLED=true
DEV_FAMILY_SOURCE=private
FAMILY_CONFIG_PATH=config/family.private.json
DEV_DRAW_PATH=config/draw.dev.private.json
```

The private family file is prepared in this workspace with placeholder Gmail addresses and your exclusion rules. It is ignored by Git. Private development automatically creates `DEV_DRAW_PATH` during server initialization if it is missing, then reuses it. It never uses the production draw.

Restart the dev server after changing `.env`, then select a person in the dev toolbar. Source changes clear the active identity selection. Missing family configuration or invalid saved draws fail initialization without falling back to fictional data or the production draw.

The bypass requires SvelteKit development mode, `DEV_AUTH_ENABLED=true`, and a loopback hostname. `npm run preview` and production always require Cloudflare identity and use `FAMILY_CONFIG_PATH` / `DRAW_PATH`; development settings and selector cookies grant no access there. Disable the bypass when testing real Access through a tunnel.

```sh
npm test
npm run check
npm run build
```

Tests verify signed/forged/expired/wrong-audience JWTs, fail-closed identity handling, participant authorization, private-file validation, stable draws, and overwrite prevention. Browser/HTTP checks also cover local reveal/hide, identity switching, and the production guard. Real Google redirects and Cloudflare key delivery still need an Access integration test.

## File-based family data

This version targets a Node server with persistent private files. See [storage details](docs/STORAGE.md).

1. Edit the prepared, ignored `config/family.private.json` and replace the placeholder Gmail addresses. For a fresh checkout, copy `config/family.example.json` first.
2. Replace synthetic participants with real names and the exact email addresses returned by their Google accounts. Use one unique email per person.
3. Finalize the event and exclusion rules, set `FAMILY_CONFIG_PATH` and `DRAW_PATH`, then start the server. During runtime initialization (before serving requests), it generates the draw only if the file is absent. Builds never generate draws. No pairing is printed to the logs.

Existing draws are validated and reused byte for byte. Corrupt, incompatible, or unreadable draws fail initialization and are never replaced. Concurrent starts publish one complete draw atomically. Refreshing or revealing only reads the saved file.

Both private files live in `config/`, so a container needs one persistent **writable** directory mount (see [container mount settings](docs/STORAGE.md#container-mount)). The server's user must be able to create files there; draw files have owner-only permissions. Keep the directory outside `static/`, out of Git, and backed up across deployments. Restore backups before starting a replacement server: an absent file on a new start creates a new draw.

The operator can deliberately inspect the files, but normal setup never displays the pairings. The optional manual command remains available and refuses to overwrite an existing draw:

```sh
npm run draw -- config/family.private.json config/draw.private.json
```

## Cloudflare Google login

See [setup and local testing](docs/LOCAL-AUTH.md). Configure private runtime variables in `.env` locally, or your production process environment:

```dotenv
DEV_AUTH_ENABLED=false
CF_ACCESS_ISSUER=https://your-team.cloudflareaccess.com
CF_ACCESS_AUDIENCE=your-access-application-audience
FAMILY_CONFIG_PATH=config/family.private.json
DRAW_PATH=config/draw.private.json
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

## Languages

The live app supports English and Latvian through [Paraglide](https://paraglidejs.com/sveltekit). Edit copy in `messages/en.json` and `messages/lv.json`; keep message keys and `{name}` placeholders aligned. `npm run check`, `npm test`, and the Vite plugin compile the generated files in `src/lib/paraglide/` (ignored by Git).

The header flag button shows the other language (🇱🇻 / 🇬🇧), switches directly without a dropdown, and remembers `en` or `lv` in a `santa_language` cookie for one year, with `SameSite=Lax` and `Secure` on HTTPS. English is the default. Server rendering and API error messages use the same request locale, isolated across requests. The document's `lang` attribute follows the selected language. Switching reloads the page and hides a revealed recipient. No translation service is called at runtime and no family data is sent for translation. Cloudflare/Google's own login screens are managed by those services. The standalone mockup remains a historical English design preview.

Pairing exclusions are directional entries in the private config's `exclusions` array. The private file contains your mutual exclusion. This fictional example shows the format:

```json
"exclusions": [
  { "giver": "alex", "recipient": "jamie" },
  { "giver": "jamie", "recipient": "alex" }
]
```

Use participant IDs in rules; self assignments are always forbidden. Saved draws are checked against these rules as well. Changing rules can invalidate an existing draw; the app will refuse to reveal it. Fictional mode uses a fixed example draw; private development mode uses its separate saved development draw. The first production start creates the production draw, so finalize the participant list and rules before starting it.
