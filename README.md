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

Production uses `adapter-node` and Node 24 in Docker. Cloudflare Workers do not provide this private filesystem layout, so that deployment would need a storage change.

## Docker deployment

The [Dockerfile](Dockerfile) builds a standalone Node server in stages and runs it as an unprivileged user with production dependencies only. The build context allowlist excludes `.env`, private family files, and all saved draws. No Cloudflare credentials or private configuration are needed at build time.

Use [compose.yaml](compose.yaml) with Caddy on the host. Prepare `config/family.private.json` with the real emails and final exclusions before starting. In your ignored `.env`, set:

```dotenv
CF_ACCESS_ISSUER=https://your-team.cloudflareaccess.com
CF_ACCESS_AUDIENCE=your-access-application-audience
# Optional: use the published image instead of building locally.
SANTA_IMAGE=ghcr.io/your-owner/your-repository:latest
# Match the host owner of config/ and its private files (id -u / id -g).
SANTA_UID=1000
SANTA_GID=1000
```

Set the UID/GID to the owner of your deployment files; on macOS these often differ from 1000. Keep the directory writable and the family file readable by that user (`chmod 700 config` and `chmod 600 config/family.private.json`). Compose passes only the listed variables into the container, so local development flags from `.env` cannot enable its identity selector.

Build locally and start:

```sh
docker compose up -d --build
```

Or pull the GitHub image and start without building:

```sh
docker compose pull
docker compose up -d --no-build
```

The single `./config:/app/config` mount persists the generated draw across container replacement. Never remove it during updates. A missing draw is created on startup; existing invalid draws fail startup. Back up this directory. The container binds only `127.0.0.1:3000` on the host, for Caddy to reach. If Caddy is another container, put both on a shared Docker network, use `reverse_proxy santa:3000`, and remove the app's `ports` mapping.

## Versioning and manual releases

[GitVersion.yml](GitVersion.yml) configures GitVersion 6.8.2 for simplified GitFlow: short-lived `feature/*` and `hotfix/*` branches merge into `main`, with no permanent `develop` branch. This uses GitVersion's `GitHubFlow/v1` base with **ManualDeployment on main**, an empty prerelease label, and patch increments by default. Unreleased commits on main keep the same proposed version. Include `+semver: minor` or `+semver: major` in a commit message to request a larger increment; with squash merges, include it in the final squash commit message. The release uses GitVersion’s `MajorMinorPatch` output (for example `0.0.1`); its candidate `SemVer` may include a ManualDeployment prerelease counter (for example `0.0.1-1`). GitVersion owns release versions; the scaffold's `package.json` version is not updated by CI.

The [Container workflow](.github/workflows/container.yaml) starts by calculating the version from full Git history and tags. It then runs type checks, tests, and Linux amd64/arm64 container builds **without publishing**. Successful main runs save their calculated version and commit SHA as a `release-metadata` artifact for 90 days. Pull requests cannot publish releases.

To publish after tests pass:

1. Open the successful **Container** run on `main` and copy its numeric run ID from the URL (`…/actions/runs/123456789`).
2. Open **Actions → Publish release → Run workflow**, select `main`, enter that run ID, and start it. This button is the manual approval and works for a private repository without environment protection rules.
3. The [release workflow](.github/workflows/release.yaml) verifies that the supplied run is a completed, successful Container run in this repository for the current head of `main`. It loads that run's saved version, checks the commit and stable version, and refuses an already tagged release. It builds the tested commit using the CI cache, publishes the image, and then creates a GitHub Release and Git tag automatically.

Images are published as `ghcr.io/<owner>/<repository>:<version>` (for example `:0.1.0`), `:latest`, and a `:sha-…` tag. Registry paths are lowercase. The automatic Git tag is `v<version>`; GitVersion uses it to advance the next candidate. You never need to create a tag yourself, and neither workflow is triggered by tags or GitHub releases. See [GitVersion Manual Deployment](https://gitversion.net/docs/reference/modes/manual-deployment).

If main advances before publication, choose its latest successful run instead. Manual releases are serialized to prevent two releases racing. If an artifact expires, rerun Container on main to produce a new one. A publication failure before the GitHub Release is recorded can leave an image uploaded without its release tag; rerun the manual workflow for that same successful CI run to finish recording it. Once the release tag exists, duplicate publication is rejected. Publishing an image and recording its GitHub Release are separate operations.

Push the repository to GitHub and enable Actions. No environment approval gate or Enterprise plan is needed. The workflow uses the built-in `GITHUB_TOKEN` with `actions: read`, `contents: write`, and `packages: write`; no registry password or app credentials need to be configured. Organization policy must allow package publishing and release/tag creation. Tag rules must allow the workflow to create `v*` tags. Restrict repository write access to people permitted to invoke the release workflow. GitHub execution must be verified after these workflows are pushed to your repository.

New packages may be private: set the package visibility to public for anonymous pulls, or authenticate your deployment host to `ghcr.io` using a token with `read:packages`. Pin a version tag or image digest in `SANTA_IMAGE` when you want controlled updates. See [GitHub's container publishing guide](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Caddy and Cloudflare identity headers

Request flow: browser → Cloudflare Access (Google login) → Caddy → Secret Santa. Protect the entire public hostname with Access and restrict direct origin access using a Cloudflare Tunnel or an origin firewall. For a public HTTPS origin use Cloudflare **Full (strict)** TLS. Caddy must preserve the signed `Cf-Access-Jwt-Assertion` header: the app verifies it and reads its `email` claim to match a family member. Forwarding only `Cf-Access-Authenticated-User-Email`, `X-Forwarded-Email`, or `Remote-User` will not authenticate anyone. See [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

For Caddy running on the same host as the example Compose service:

```caddyfile
santa.example.com {
    reverse_proxy 127.0.0.1:3000 {
        # Already forwarded by default; explicit here to document the contract.
        header_up Cf-Access-Jwt-Assertion {http.request.header.Cf-Access-Jwt-Assertion}
        # Public app uses HTTPS, including when a Tunnel reaches Caddy over HTTP.
        header_up X-Forwarded-Proto https
    }
}
```

Replace the hostname with your Access application's hostname. Caddy preserves the incoming Host header and ordinary request headers by default, so do not rewrite Host to the internal container name. The example explicitly sets `X-Forwarded-Proto`, and Compose sets `PROTOCOL_HEADER=x-forwarded-proto`; this lets SvelteKit reconstruct the public HTTPS URL for cookies, same-origin POST checks, and redirects. These are runtime settings; no rebuild is needed when moving to another hostname. See [Caddy header forwarding](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults) and [SvelteKit Node proxy configuration](https://svelte.dev/docs/kit/adapter-node#Environment-variables).

If a Cloudflare Tunnel sends HTTP to Caddy, use a dedicated local listener instead of an automatic HTTPS site, for example `http://santa.example.com:8080`, and configure the Tunnel's origin service and HTTP Host header to match it. Keep the same `reverse_proxy` block and HTTPS upstream header. Bind that listener to loopback when the Tunnel runs on the host; when containerized, use an isolated Docker network. The public hostname still uses HTTPS through Cloudflare. Ensure `/cdn-cgi/access/logout` is handled by Cloudflare at that hostname.

To check the integration, log in through the public hostname with an allowed family Google account and reveal the recipient. Repeat with another family account and confirm each gets its own recipient. A request without a valid Access JWT, including one containing a forged plain email header, must not reveal a recipient. Avoid logging request headers or JWT values while debugging.

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
