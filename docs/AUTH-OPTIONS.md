# Identity and email options

> Historical alternatives research. The selected approach is now Cloudflare Access with Google login, without the family password or app codes. See [current setup](LOCAL-AUTH.md).

## Recommendation

If using Cloudflare, prefer **Cloudflare Access email one-time PIN + validated Access JWT identity**. Family members enter their existing email and receive a code; no signup or OAuth is required. Cloudflare handles sending the login emails. The app maps the verified email to exactly one configured participant and releases only that person's assignment. This recommendation is an inference from the documented capabilities below.

If you want independence from Cloudflare or the exact in-app “select name, receive code” flow, use **application email codes through a transactional email provider**. Feasible for a family, but requires sender-domain setup, challenge storage, rate limiting, sessions, and deliverability support.

The shared family password can supplement either approach. Alone it cannot stop one family member impersonating another.

## Comparison

| Option | Family experience | Setup and feasibility | Tradeoff |
| --- | --- | --- | --- |
| Cloudflare Access email PIN | Cloudflare email/code screen, then app. No signup or OAuth. | High feasibility with a Cloudflare-proxied domain: Access application, explicit family-email Allow policy, PIN provider, session duration, secure origin, JWT validation in app. | Cloudflare owns the login step. Dropdown may remain, but only matching identity is authorized. |
| App-managed email code | Family password → dropdown → email code → reveal. | High feasibility using an HTTPS email API, verified sending domain, private credentials, and durable OTP/session/rate-limit storage. | More server logic; delivery delays/spam and provider outages need recovery UI. |
| Unique password per person | Family password → dropdown → personal password → reveal. | Straightforward: unique password hashes, throttling, server sessions. No email service. | Organizer must securely distribute/reset credentials; each person must remember one. A shared password is not equivalent. |
| Personal invitation link | Open a privately distributed link → reveal. | Straightforward using long random revocable tokens, hashed at rest; optionally single-use exchange for a session. | Anyone with a forwarded link can impersonate its owner. Links may leak via history/logs/previews; lower preference here. |

## Cloudflare identity details

Access forwards an application JWT in `Cf-Access-Jwt-Assertion`. Validate its signature against the team's JWKS and check issuer, application audience, expiry, and applicable time claims. Map the **verified email claim** to a stable participant ID. A plain `Cf-Access-Authenticated-User-Email`, `X-Forwarded-*`, or user-submitted header is not identity proof. Even with Tunnel, validating the application JWT makes the trust boundary explicit.

Use a SvelteKit server hook to establish identity and reusable authorization helpers for every load/action/endpoint. Preselect the verified name if helpful. Selecting another name must show a mismatch and never release another recipient. “Allowed family email” does not mean permission to read every family record.

Use a specific email allowlist, not allow-everyone or bypass rules. Cover all relevant paths, restrict origin ingress, and remove public alternative hostnames/routes. Service-token-only requests do not identify a participant. Test deliberately forged headers and direct-origin access.

App logout must revoke the app session and offer an Access logout path, so a shared device does not silently reuse the previous person's Cloudflare identity. Shared mailboxes prove the same identity for multiple people; they require a deliberate separate-credential or delegation policy.

Cloudflare PIN already checks email possession. A second app email code usually adds friction without distinguishing shared-mailbox users. Keep the family password if literal password protection remains required; confirm before replacing it with Access.

Sources: [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/), [JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [application token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

## Sending codes from the app

Send from a SvelteKit server action using a transactional provider's HTTPS API. This works with Node hosting and Cloudflare Workers; SMTP/raw TCP support depends on runtime. Keep provider keys server-side; never expose a public environment variable. Running your own mail server is unnecessary for this app.

| Provider | Practical setup | Assessment |
| --- | --- | --- |
| Resend | Verify an owned sending domain, publish required SPF/DKIM records, create a private API key, call its send-email API. A provider test sender is not a general production sender. | Good first choice for the app-code approach because HTTPS integration is small. Test delivery to family mailbox providers. |
| Amazon SES | Verify sender/domain in the chosen AWS region, configure DNS and IAM, request production access if sandboxed. Sandbox delivery is restricted to verified recipients, apart from simulator addresses. | Suitable if already using AWS; more initial setup than a small transactional API integration. |

Provider tiers, quotas, and prices change; check the current plan before choosing. Family volume is small, but a public code-request endpoint can be abused, so provider limits do not replace app rate limiting. No exact cost is assumed here.

Use a dedicated sender such as `santa@notify.your-domain.example`. Include the code and event context, never the assignment. Configure DMARC alongside provider-required authentication records and test spam placement before invitations.

Challenge lifecycle: accept configured participant ID → apply shared persistent limits → generate random code and keyed digest bound to challenge/browser/person → send only to configured address → atomically validate/consume → rotate into a participant session. A new code invalidates the old one. Handle provider errors without granting login. Never use fixed production codes, client-side code comparison, or codes in production logs.

Starting policy: 10-minute expiry, five guesses, 60-second resend delay, additional per-person/IP limits. Six-digit codes have a small search space: use keyed digests and online attempt limits. Store challenges/sessions durably with atomic updates.

Sources: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [SES sandbox and production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Proposed implementation order

1. Choose Cloudflare PIN or app codes and hosting.
2. Implement family gate unless explicitly replaced, verified identity, durable sessions/rate limits, and authorization.
3. Validate private configuration; add a one-time organizer draw and durable assignments.
4. Connect UI to server loads/actions returning only the current person's recipient.
5. Test impersonation, origin bypass, replay/limits, logout/shared devices, and draw stability before deployment.
