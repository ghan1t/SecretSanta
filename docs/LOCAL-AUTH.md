# Authentication and local testing

## Selected product flow

Open app → Cloudflare Google login if needed → “Psst, Alex” → explicitly reveal the saved recipient. The identity determines the person. There is no production dropdown, family password, verification code, signup, or app-managed OAuth callback.

## Local identity bypass and data sources

Set `DEV_AUTH_ENABLED=true` in ignored `.env`, run `npm run dev -- --host 127.0.0.1`, and use the development toolbar. Test known people, unknown account, and signed-out. Switch identity or sign out while viewing a recipient to check the screen clears. The toolbar submits a same-origin POST and stores an HTTP-only development cookie. It intentionally offers no security against another local developer.

This mode requires SvelteKit's `dev` value, the exact explicit flag, and a loopback hostname. `DEV_FAMILY_SOURCE=fictional` (default) uses checked-in fictional people and a fixed example draw. Set `DEV_FAMILY_SOURCE=private` to use `FAMILY_CONFIG_PATH` with a separate saved `DEV_DRAW_PATH` (e.g. `config/draw.dev.private.json`). Server initialization creates a missing development draw automatically, using only `DEV_DRAW_PATH`. The reveal route never generates one. Missing family configuration or invalid existing draw files fail initialization. The dev toolbar labels the active source, and its HTTP-only cookie is bound to that source so a source switch requires selecting an identity again. Restart after changing the environment. Production and `npm run preview` ignore the cookie and flag. No URL parameter, plain email header, or client-supplied person ID grants production identity.

## Tests without an Access account

`npm test` generates local RSA keys and signs application JWTs with the same shape the verifier expects. Tests accept a valid token and reject forged/unsigned signatures, expiry, missing required claims, future issue/not-before time, wrong issuer/audience, and non-application tokens. These use a local JWKS resolver and never contact Cloudflare.

Endpoint tests verify that Alice only receives her recipient, submitted alternate IDs are rejected, and signed-out/unknown/cross-origin requests fail. Storage tests verify draw validity, stable reads, no overwrite, and missing/corrupt-file behavior.

To inspect the production guard locally, first configure private family/draw paths; initialization will create the draw if it is missing. Use disposable test files for this check. Then run `npm run build` then `npm run preview -- --host 127.0.0.1`. There is no selector even if the environment flag is true. Without a valid Access JWT, no assignments are available. Supplying a development cookie or `Cf-Access-Authenticated-User-Email` does not authenticate you. This mode deliberately cannot simulate a successful Cloudflare login with an arbitrary header.

## Real integration later

1. Create a Cloudflare Access application for a development hostname with Google login enabled. Allow only configured family email addresses; ensure the effective policy requires Google if that is the intended exclusive method. Never use a bypass/allow-everyone policy.
2. Configure Google as described in [Cloudflare's Google guide](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/). OAuth configuration belongs in Cloudflare/Google, not this app.
3. Set `DEV_AUTH_ENABLED=false`, issuer to the team origin, and audience to the Access application's AUD tag. Configure private family/draw file paths. Email matching trims and lowercases but does not collapse Gmail dots or aliases.
4. Run the local app and expose it using a named Cloudflare Tunnel on the protected hostname. Configure Vite's `server.allowedHosts` with that exact hostname for a dev server; do not enable all hosts. Restrict alternative origin ingress. Do not expose an unprotected tunnel URL.
5. Check Google login, a known/unknown account, refresh/reveal, expiry, application logout, and switching accounts on a shared device. Check the signed token reaches the origin, the issuer/audience match, and direct-origin/forged-header access yields no assignment.

The app validates `Cf-Access-Jwt-Assertion` using a cached remote JWKS resolver, RS256, expected issuer and audience, expiry, issued time, subject, email, and application type. It never trusts an unverified header or enables a weaker fallback. If Cloudflare's keys cannot be retrieved and no matching cached key is available, verification fails closed. [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

Production Access intercepts the initial visit and handles login before the app. App sign-out redirects to `/cdn-cgi/access/logout` on the current protected hostname. Google remains signed in; the provider may reuse that account. Do not promise Google-account logout or account chooser behavior until integration-tested.

## Deployment still required

Choose a Node adapter/host with persistent private files, configure HTTPS and Access, block origin bypass, and back up config/draw. The local development mode is ready; actual Cloudflare/Google integration cannot be verified until those services are configured.
