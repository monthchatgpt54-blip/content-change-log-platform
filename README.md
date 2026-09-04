# Content Change Log Platform

A private, multi-site editorial operations platform for auditing existing or new content, producing a traceable master change log, approving or rejecting individual edits, creating protected revisions, and safely handing approved content to WordPress.

## What is implemented

- Multi-site profiles with separate niche, market, language, and publishing settings
- Authenticated owner-level data isolation through ChatGPT/Sites identity headers
- Immutable original content (`Version 0`) and append-only revision history
- Deterministic audit engine for claims, duplicate blocks, American English, punctuation, readability, calls to action, heading structure, and primary-keyword use
- Optional OpenAI Responses API semantic review with strict JSON Schema output and rules fallback
- Master change register with exact location, category, issue, action, priority, before, after, rationale, evidence, confidence, status, and reviewer instructions
- Approve, reject, restore, recheck-request, revision, CSV export, and activity trail
- Controlled batches of 1–40 content items
- WordPress Application Password connection, encrypted at rest
- Read/import WordPress content without modifying the source
- Draft/publish gate that blocks unreviewed changes, missing revisions, and detected page-builder markup
- Text, Markdown, HTML, CSV, and JSON upload with a 2 MB limit and R2 archival
- Permanent deletion intentionally disabled

## Workflow

1. Add a website profile for each site or niche.
2. Paste content, upload a supported text file, or import up to 40 recent WordPress items.
3. Run an audit. The original is stored as immutable Version 0.
4. Review each proposed change. Approve, reject, restore, or request a recheck with a note.
5. Create a new revision from approved exact-text edits.
6. Send the revision to WordPress as a draft or publish it after all approval gates pass.
7. Export the full master register as CSV whenever required.

## Runtime configuration

The app works without an OpenAI key by using the deterministic review engine. Add these as protected deployment secrets, never as browser variables or committed files:

```text
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
APP_ENCRYPTION_KEY=a_random_secret_of_at_least_32_characters
```

`APP_ENCRYPTION_KEY` is required before a WordPress Application Password can be stored. Changing it later makes existing encrypted WordPress connections unreadable; reconnect affected sites after a key rotation.

ChatGPT account changes are supported. Each signed-in email receives a separate owner workspace. A newly added account does not automatically inherit another account's websites or credentials.

## WordPress permissions and safety

Create a dedicated WordPress user with only the minimum content-editing role required. Use a WordPress Application Password, not the main login password. The integration only implements content read, draft, and publish operations. It does not implement plugin, theme, user, settings, stock, price, order, or permanent-delete operations.

Whole-body publishing is blocked when common Elementor, Divi, WPBakery, Fusion, Flatsome, or Beaver Builder markup is detected. Such pages need a purpose-built field-safe adapter before automatic publishing.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run db:generate
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
npm test
```

The database and object-storage bindings are declared in `.openai/hosting.json` as `DB` and `BUCKET`. Database migrations in `drizzle/` are applied by the Sites deployment workflow.

## Architecture

- Next.js/Vinext UI and route handlers
- Cloudflare D1 with Drizzle ORM for sites, content, audits, changes, revisions, batches, and activity
- Cloudflare R2 for uploaded source artifacts
- Sites private access and identity headers for authentication
- OpenAI Responses API as an optional server-side semantic reviewer
- WordPress REST API using restricted Application Password credentials encrypted with AES-GCM

See [docs/MASTER-CHANGE-LOG-SPEC.md](docs/MASTER-CHANGE-LOG-SPEC.md) for the editorial specification and [docs/SECURITY.md](docs/SECURITY.md) for the operational safety model.
