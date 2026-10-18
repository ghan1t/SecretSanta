# Secret Santa requirements

## Agreed decisions

- Svelte 5, SvelteKit 3, TypeScript, following https://svelte.dev/llms.txt.
- Cloudflare Access with Google login identifies participants without app signup, app passwords, or SMS/email codes.
- The verified email maps to one participant in a private configuration file. No production name picker or shared family password.
- A private, saved draw file stores giver-to-recipient IDs. A database is unnecessary while the app remains read-only.
- Explicitly enabled, loopback-only development identities support local work without Cloudflare with an independent data-source setting: committed fictional people or the ignored private family file with a separate development draw.

## Required behavior

1. Open the protected hostname, authenticate through Cloudflare/Google if necessary, greet the mapped person, and reveal their recipient only on explicit request.
2. A person's recipient is who they buy for, not who buys for them. Keep this assignment stable across refreshes, restarts, and deployments.
3. Unknown accounts see a helpful message and no family/assignment details. Missing or invalid identities cannot retrieve assignments.
4. No request can choose a different giver. The reveal endpoint derives the giver exclusively from the verified server identity.
5. Allow hiding and revealing again, logout through Access, and deliberate account switching on shared devices. Clear visible recipients on navigation/page hide; do not serialize assignments into initial HTML/page data.
6. Read configured event ID/year, celebration date, budget, and participants. Keep all real emails/assignments outside Git and public assets.
7. Generate one draw with secure randomness, no self assignments, and exactly one giver/recipient occurrence per participant. An organizer command creates a complete file without overwriting a draw. Never draw in page loads or requests.
8. Reject malformed config, duplicate IDs/emails, mismatched events/participant sets, and invalid draws. Missing data produces an unavailable state, never an automatic redraw.
9. Use a mobile-first, single-card layout centered on reveal/hide, with short copy, whimsical details, and no budget information. Support small screens, keyboard interaction, visible focus, labeled controls, accessible error/status announcements, and reduced motion.

## Authentication and privacy

- Validate Cloudflare JWT signature/JWKS, algorithm, issuer, audience, expiry and applicable time claims, subject, email, and application-token type on every request. Ignore plain forwarded-email headers.
- Configure Google-only authentication and explicit family-email access policies in Cloudflare. Secure origin ingress, protect all app/API paths, and remove bypass routes/hostnames.
- Production ignores development flags/cookies and has no identity selector fallback. Development identities require SvelteKit dev mode plus an explicit environment flag and loopback hostname, with `DEV_FAMILY_SOURCE=fictional` by default. Explicit `private` selection reads the private family file and a separate development draw, clearly labeled in the toolbar.
- Cloudflare manages login/session duration; no app session database is needed. Logout clears the Access application session but does not sign out of Google itself. Verify provider account-switch behavior before public use.
- Require same-origin writes, keep recipient responses/pages private and uncached, avoid third-party analytics and secrets in logs, and return only the authenticated person's recipient display name.
- File operators can see the draw. The app does not promise secrecy from its organizer or stop a user recording their own assignment.

## Implemented validation

Local-key JWT tests; participant/reveal authorization tests; file validation, stability, and overwrite tests; type checking and production build; local browser flows and production guard checks. Real Google redirects, Cloudflare JWKS delivery, protected tunnel routing, and Access logout require integration testing once configured.

## Storage and scope limits

Target a Node host with persistent private files. Back up and retain config/draw together across deployments. Cloudflare Workers require a different storage backend. A database becomes useful with mutable wishlists/admin UI/audit records, not for the current read-only flow. Directional pairing exclusions are configured in the family file and enforced on generation and saved-draw validation. Mutual exclusions are kept in the ignored private config. Previous-year avoidance, reminders, and organizer UI remain future scope.

## Remaining decisions

Real Google-account emails, shared-mailbox handling (baseline requires unique emails), date/budget and hosting/domain/adapter. The real participant list and placeholder Gmail addresses are kept only in the ignored private family file. Deployment is not configured yet.

### Language support
- English and Latvian UI, including reveal/loading states, account guidance, and recipient API errors.
- Accessible flag button in the header, showing the opposite language (🇱🇻 / 🇬🇧), with a translated accessible label and no dropdown.
- Remember the explicit choice in a one-year language cookie; default to English.
- Render the selected language on the server and set the HTML language attribute.
- Keep translations in versioned message files using Paraglide; no runtime translation API or database.
