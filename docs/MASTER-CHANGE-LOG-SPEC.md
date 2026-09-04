# Master Change Log Specification

## Objective

The change log must let an editor, SEO lead, client, or publisher understand exactly what changed, where it changed, why it changed, who decided, and whether the approved result reached WordPress. A vague list such as “content improved” is not acceptable.

## Required fields

| Field | Requirement |
|---|---|
| Change reference | Stable ID tied to one audit, for example `CL-20260904-ABC123-001` |
| Content record | Page/article/product title and source site |
| Exact location | Heading, section, paragraph, field, or page-wide scope |
| Category | Editorial, factual, trust, search intent, duplication, readability, structure, conversion, or technical |
| Issue | Plain-language description of the problem or gap |
| Action | `CLEAN`, `CORRECT`, `REWRITE`, `ADD`, `REMOVE`, or `VERIFY` |
| Priority | Critical, High, Medium, or Low |
| Before | Exact original excerpt, or an explicit “not present” statement for additions |
| After | Proposed replacement or a precise instruction when safe automatic text is not possible |
| Reason | Reader, factual, trust, conversion, editorial, or SEO value of the change |
| Evidence | Direct match, supplied brief, source requirement, or an explicit verification gap |
| Confidence | Engine certainty; it does not replace reviewer approval |
| Status | Needs review, approved, rejected, restored, applied, or verified |
| Reviewer instruction | Human note used for recheck or exception handling |
| Timestamps | Creation and reviewer decision time |

## Editorial standard

- Write for a natural American-English reader when that site profile is selected.
- Preserve correct, useful copy instead of rewriting for variation.
- Never invent facts, awards, statistics, prices, inventory, materials, guarantees, testimonials, or competitor evidence.
- Replace unsupported absolute claims with verifiable process language, or mark them `VERIFY`.
- Keep search terms natural. Missing intent can justify an addition; exact-match repetition does not.
- Separate a source-supported content gap from a speculative competitor gap.
- Make each change atomic. A reviewer should be able to approve one entry without accepting unrelated edits.
- Use exact excerpts so changes can be applied safely and reversed.
- Protect the page's original meaning, layout, links, shortcodes, and structured markup.
- Classify paragraphs, headings, bullets, table rows, quotes, and code before reviewing them.
- Keep every bullet atomic, retain all unaffected bullet sentences, and preserve table delimiters and cell counts.

## Review gates

| Gate | Publish requirement |
|---|---|
| Original preserved | Immutable Version 0 exists |
| Findings decided | No entry remains `needs_review` |
| Approved edits applied | A separate revision exists |
| Builder safety | No protected page-builder markup is detected for whole-body publishing |
| WordPress connection | HTTPS connection and encrypted application password are valid |
| Human control | Manual mode requires the explicit final draft/publish action |

## Batch behavior

- One batch can contain 1–40 items.
- Every item gets its own content record, protected original, audit, and change references.
- A failed item is isolated; it must not invalidate or overwrite other items.
- Large batches use deterministic checks by default to keep processing controlled. OpenAI semantic review can be applied to smaller runs or individual rechecks.
- Batch completion means “ready for review,” not “automatically safe to publish.”

## Future production extensions

- Competitor evidence retrieval with citations and market/location controls
- Sitewide keyword cannibalization index
- HTML-aware block-level revision application
- WooCommerce field adapters that preserve price, stock, variations, and schema
- Scheduled server-side queue consumer for unattended batch processing
- PDF and DOCX parsing, export, and reviewer-ready PDF report
- Team roles, approval delegation, and notifications
