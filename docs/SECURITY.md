# Security and Publishing Safety

## Implemented controls

- Private hosting access and authenticated identity headers
- Owner ID on every operational table and owner filters on API reads/writes
- Server-only OpenAI and WordPress credentials
- AES-GCM encryption for WordPress Application Passwords
- HTTPS-only WordPress targets and rejection of common local/private network addresses
- Restricted upload types and 2 MB upload limit
- React text rendering instead of untrusted HTML injection
- Strict OpenAI JSON Schema and no model tool access during editorial analysis
- Immutable original revision before any proposed edit
- Publish blocking while changes remain unreviewed
- Publish blocking for common page-builder/shortcode markup
- No permanent-delete endpoint
- No plugin, theme, settings, user, commerce price, stock, or order endpoints

## Operator responsibilities

- Keep the Site private unless an explicit public-access design is completed.
- Use a dedicated WordPress Editor account and Application Password.
- Back up WordPress before enabling production publishing.
- Test draft creation on a staging page before the first live publish.
- Keep `APP_ENCRYPTION_KEY` stable and rotate deliberately.
- Never commit `.env`, API keys, application passwords, or access tokens.
- Review factual and legal claims manually even when the audit engine reports no issue.

## Known boundaries

- DNS-level protection against every SSRF/rebinding technique requires an outbound proxy or network policy beyond application URL validation.
- Generic WordPress REST content updates cannot safely edit every proprietary page builder. Detected builder markup is blocked; unsupported builders must be added before use.
- This release prepares and processes batches while an authorized browser session drives the queue. A scheduled queue worker is the next step for fully unattended execution.
- Rules-based checks do not perform live competitor research. OpenAI semantic review does not claim competitor evidence unless a separate cited research service supplies it.
