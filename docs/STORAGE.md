# Private file storage

## Current choice

No database is necessary for this small, read-only exchange. Cloudflare authenticates people; our configuration maps email to participant ID. Two private files hold the persistent data:

- `config/family.private.json`: event details, participant IDs, display names, and exact Google-account emails. Copy the checked-in synthetic example.
- `data/draw.private.json`: event ID and giver-to-recipient ID mapping, generated once by `npm run draw -- config/family.private.json data/draw.private.json`.

Both paths are configurable at runtime and relative to the server working directory unless absolute. Both files are excluded from Git at these default paths. Custom paths must be kept private and explicitly excluded too. Never put them under `static/` or a public document root.

## Guarantees and limitations

The organizer command validates config, generates a uniformly shuffled draw rejecting self assignments, and publishes a complete file atomically without replacing an existing draw. The draw file is created with owner-only permissions; a new data directory is owner-only. Keep the configuration owner-readable only as well, for example `chmod 600 config/family.private.json`.

The app is read-only: no writes on reveal, no redraw on refresh/restart, no mutable sessions or counters to coordinate. Every reveal loads and validates the saved draw, and looks up the giver using only authenticated email. Only the recipient's display name is returned. A missing/corrupt file, changed event, changed participant IDs, self assignment, duplicate recipient, or duplicate ID/email fails closed.

The application cannot detect a deliberate edit that replaces the draw with another valid permutation. Treat files and backups as organizer-controlled secrets. Keep the same event and participant IDs for an existing draw; generate a new event for next year. Household exclusions and previous-year restrictions are not implemented.

Back up config and draw together, retain the same private volume/path across deployments, and restore the existing draw after a machine replacement. Do not regenerate to recover missing data. For multiple Node instances, distribute the same immutable files to every instance. Avoid concurrent organizer changes; publish updates deliberately and validate them before restarting.

## When to add a database

Use durable database storage when adding writable wishlists, organizer editing, invitations, reveal audit/history, multiple independently managed events, or mutable state shared across instances. SQLite suits a single persistent Node host; Cloudflare D1 is a candidate if moving to Workers. A local/ephemeral serverless filesystem is not a persistence strategy. The current Node filesystem imports must be replaced before deploying to Workers.
