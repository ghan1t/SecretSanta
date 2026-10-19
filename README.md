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

[GitVersion.yml](GitVersion.yml) uses GitVersion 6.8.2 with **ContinuousDeployment on main** and **ManualDeployment on all other branches**. These modes control version calculation; publication always requires the manual workflow button. Short-lived `feature/*` and `hotfix/*` branches originate from `main`; no permanent `develop` branch is needed. Main uses `increment: Minor` and an empty label. Features use their branch name as a label and inherit the increment. Hotfix branches use `increment: Patch`, start from main, and track their merge target.

CI uses **GitVersion's `SemVer` output unchanged** for the image version, image label, and automatic Git tag. It does not use `FullSemVer`, strip prerelease counters, or substitute `MajorMinorPatch`. For example, after a stable `v1.0.0` tag, the next main candidate is `1.1.0`, a `feature/snow` candidate is `1.1.0-snow.1`, and a hotfix from that stable release is `1.0.1-cocoa.1`. `SemVer` omits the `+…` build metadata present in `FullSemVer`.

Main's ContinuousDeployment calculation drops the prerelease suffix; after its stable release tag, the next main candidate increments Minor. ManualDeployment on feature/hotfix branches deliberately retains candidate counters between commits/builds until a publication tag records a deployment. It does **not** give every CI build a new `.N`; rebuilding the same candidate can produce the same version. Publication tags advance that deployment counter, so a subsequent branch candidate after a prerelease tag may keep the numeric core and increase its counter. Minor/Patch increments are the configured base-version rules, rather than a promise to bump the numeric core on each build. See [GitVersion Manual Deployment](https://gitversion.net/docs/reference/modes/manual-deployment).

The [Container workflow](.github/workflows/container.yaml) runs on pushes to any branch, PRs, or manual invocation. It calculates the version first, runs type checks and tests, and builds Linux amd64/arm64 images **once**, exporting a multi-platform OCI archive. The `release-bundle-<attempt>` artifact holds the archive, its SHA-256 checksum, version, source commit/branch, and CI run/attempt IDs for 30 days. CI never publishes an image. The Dockerfile still builds from source for independent local builds; the release workflow does not invoke it.

To publish after tests pass:

1. Open the successful **Container** run for the branch you want to publish. Copy its numeric run ID from the URL (`…/actions/runs/123456789`).
2. Open **Actions → Publish release → Run workflow**, select **main** for the publication workflow itself, enter the CI run ID, and start it. The selected CI run determines which branch/image is published. This manual button works for private repositories without environment protection rules.
3. The [release workflow](.github/workflows/release.yaml) verifies that this repository's Container run succeeded, was a push or manual branch run, and still matches its branch head. It downloads that run attempt's saved image, verifies its metadata and archive checksum, then copies the existing multi-platform image to GHCR with Skopeo. **No application or image is rebuilt.** Copying uses `--all --preserve-digests` to retain both architectures, attestations, and image digests.

Every manual publication gets `ghcr.io/<owner>/<repository>:<SemVer>` and `:sha-<full-commit-SHA>`. Main publications also update `:latest` and create the current GitHub Release; feature/hotfix publications create GitHub prereleases and never move `latest`. All publications create a Git tag `v<SemVer>` automatically to record the deployment. No manual tags, tag pipelines, or automatic publication on any branch are needed. Registry paths are lowercase.

Publication is serialized, and a duplicate version tag is rejected. If the branch advances, choose its latest successful run instead. PR runs cannot be published; use the corresponding branch push run. If an artifact expires, rerun Container on that branch. If image upload succeeds but release recording fails, rerun publication for the same CI run to finish recording it. Uploading an image and creating its GitHub Release are separate operations. Deleting a source branch before publication makes its saved run ineligible.

Push the repository to GitHub and enable Actions. The built-in `GITHUB_TOKEN` uses `actions: read`, `contents: write`, and `packages: write`; no registry password or application credentials are needed in CI. Organization policies must allow publishing packages and creating releases/`v*` tags. Restrict repository write access to people allowed to publish. GitHub execution must be verified after pushing these workflows. Image artifacts count against GitHub Actions artifact storage; keep the retention period appropriate for your release schedule.

New packages may be private: set the package visibility to public for anonymous pulls, or authenticate the deployment host to `ghcr.io` using a token with `read:packages`. Pin a version or image digest in `SANTA_IMAGE` for controlled updates. GitVersion owns release versions; CI does not modify the scaffold's `package.json` version.

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
