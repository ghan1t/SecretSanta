# Private file storage

## Current choice

No database is necessary for this small, read-only exchange. Cloudflare authenticates people; our configuration maps email to participant ID. Two private files hold the persistent data:

- `config/family.private.json`: event details, participant IDs, display names, and exact Google-account emails. The prepared ignored private config contains the family names and placeholder Gmail addresses; replace those emails before deployment. The committed example contains fictional people only. Fresh checkouts can copy it and enter their private family details.
- `config/draw.private.json`: event ID and giver-to-recipient ID mapping, generated once by `npm run draw -- config/family.private.json config/draw.private.json`.

Both paths are configurable at runtime and relative to the server working directory unless absolute. Both files are excluded from Git at these default paths. Custom paths must be kept private and explicitly excluded too. Never put them under `static/` or a public document root.

## Container mount

Family configuration and saved draws live together in `config/`. Mount that directory once, read-only for the web app. For a container whose app directory is `/app`, the Compose settings are:

```yaml
volumes:
  - ./config:/app/config:ro
environment:
  FAMILY_CONFIG_PATH: /app/config/family.private.json
  DRAW_PATH: /app/config/draw.private.json
```

Generate the draw on the host before starting the container. The web app only reads these files. For private-family local development, use `DEV_DRAW_PATH=config/draw.dev.private.json`; keep this separate from the production draw in the same directory. Back up the whole directory together.

## Guarantees and limitations

The organizer command validates config, generates a uniformly shuffled draw rejecting self assignments and configured directional exclusions, and publishes a complete file atomically without replacing an existing draw. The draw file is created with owner-only permissions; a newly created storage directory is owner-only. Keep the configuration owner-readable only as well, for example `chmod 600 config/family.private.json`.

The app is read-only: no writes on reveal, no redraw on refresh/restart, no mutable sessions or counters to coordinate. Every reveal loads and validates the saved draw, and looks up the giver using only authenticated email. Only the recipient's display name is returned. A missing/corrupt file, changed event, changed participant IDs, self assignment, forbidden pairing, duplicate recipient, or duplicate ID/email fails closed.

The application cannot detect a deliberate edit that replaces the draw with another valid permutation. Treat files and backups as organizer-controlled secrets. Keep the same event and participant IDs for an existing draw; generate a new event for next year. Directional exclusions are configured in the `exclusions` array using `{ "giver": "alex", "recipient": "jamie" }` entries; list both directions to exclude a pair mutually. Unknown participant IDs in rules are rejected. Generation stops after 10,000 unsuccessful attempts without saving a draw if rules are impossible or too restrictive. Previous-year restrictions are not implemented.

Back up config and draw together, retain the same private volume/path across deployments, and restore the existing draw after a machine replacement. Do not regenerate to recover missing data. For multiple Node instances, distribute the same immutable files to every instance. Avoid concurrent organizer changes; publish updates deliberately and validate them before restarting.

## When to add a database

Use durable database storage when adding writable wishlists, organizer editing, invitations, reveal audit/history, multiple independently managed events, or mutable state shared across instances. SQLite suits a single persistent Node host; Cloudflare D1 is a candidate if moving to Workers. A local/ephemeral serverless filesystem is not a persistence strategy. The current Node filesystem imports must be replaced before deploying to Workers.

## Development data

`DEV_AUTH_ENABLED=true` bypasses Cloudflare only in loopback SvelteKit dev mode. `DEV_FAMILY_SOURCE=fictional` uses the committed fictional config and fixed example draw. `DEV_FAMILY_SOURCE=private` reads `FAMILY_CONFIG_PATH`, with a separate saved `DEV_DRAW_PATH` for reveals. The development draw is ignored by Git and never falls back to `DRAW_PATH`. Production ignores these development settings and uses only private files and verified Cloudflare identity.
