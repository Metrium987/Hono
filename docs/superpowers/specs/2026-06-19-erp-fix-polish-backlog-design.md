# HONO ERP — Fix + Polish Backlog Design

**Date:** 2026-06-19
**Status:** Approved (pre-implementation)
**Source:** `Ressource/LOUADMIN/MASTER_TODO.md` (re-verified 2026-06-19)

## Purpose

Execute the verified backlog from the re-audited MASTER_TODO. This pass covers
fixes and polish only. Two net-new features (team auto-init, recouvrement module)
are deferred to their own design cycles; dormant vector-search infrastructure is
left untouched.

## Scope (9 items)

| # | Item | Type | Risk |
|---|------|------|------|
| 2.4 | Fix `quote.id` ReferenceError in portal quote-request | Bug | Low |
| 6.4 | Add empty-items guard to quote PDF | Bug | Low |
| 5.1 | Remove last 2 `Record<string,unknown>` | Type cleanup | Low |
| 6.9 | Pin Node.js version in package.json | Config | Trivial |
| 6.10 | Remove ty/mq from i18n routing | Config | Low |
| 4.5 | Migration: currencies NOT NULL/DEFAULT | DB migration | Low |
| 1.4 | Add CSP header + extend headers to `/api` | Security | Medium |
| 6.5 | Portal email → React Email component | Refactor | Medium |
| 6.1 | Complete OpenAPI spec gaps | Docs | Trivial |

**Out of scope (explicit):** 6.8 (team auto-init), 6.11 (recouvrement), 4.3
(hybrid_search_products), rate-limit Redis migration.

## Detailed Design

### 2.4 — Portal quote-request rollback bug

**Problem:** `src/app/api/v1/portal/quote-request/route.ts:124` calls
`supabase.from("quotes").delete().eq("id", quote.id)` inside the "create customer"
branch, but `quote` is not created until line 178. At line 124 it is undefined,
throwing `ReferenceError`, which is swallowed by the outer catch (line 222) and
returned as a generic 500. The customer row is never deleted.

**Fix:** Delete the impossible `quotes.delete()` line (line 124). Keep the
legitimate `customers.delete()` rollback (line 125). The portal_users insert is
the last step of the customer branch — there is no quote to clean up yet.

**Why not reorder:** The quote genuinely cannot exist at that point in the flow.
The later quote-items failure path (line 212) already correctly deletes the quote,
so the only missing cleanup is the customer, which the fix preserves.

### 6.4 — Quote PDF empty-items guard

**Problem:** `src/lib/pdf/quote-pdf.tsx:257` maps over `items` with no length
check. An empty quote renders a table header with zero rows.

**Fix:** Mirror the invoice PDF pattern (`invoice-pdf.tsx:540-547`). When
`items.length === 0`, render a single placeholder row "Aucun article" spanning
the table instead of mapping over an empty array. ~5 lines, inside the items
table `<View>`.

### 5.1 — Type cleanup in parse-query-params

**Problem:** `src/lib/http/parse-query-params.ts` has 2 `Record<string, unknown>`
occurrences (the function param and the return type), accounting for all
remaining instances in the codebase.

**Fix:** Introduce a named schema type and a typed generic so the return is
strongly typed per schema definition. Replace the loose `Record<string, unknown>`
return with `ParsedQuery<T>` where `T` is the schema shape. Callers can narrow
the result. Keep the function signature backward-compatible (the generic defaults
so existing call sites compile unchanged).

### 6.9 — Pin Node.js version

**Problem:** `package.json` has no `engines` field.

**Fix:** Add `"engines": { "node": ">=20.0.0" }`. Next.js 16 + React 19 require
Node 18.18+/20+; pinning to 20+ matches the active LTS line and is enforced by
Vercel/npm.

### 6.10 — Remove ty/mq from i18n routing

**Problem:** `src/i18n/routing.ts:4` lists `["fr", "ty", "mq"]` but `ty.json`
and `mq.json` are empty stubs. Users navigating to `/ty` or `/mq` see untranslated
pages with raw translation keys.

**Fix:** Change to `locales: ["fr"]`. next-intl will redirect `/ty` and `/mq`
requests to `/fr` (localePrefix: "always" already handles this). Keep the JSON
files in place for future translation work — they are inert when not in routing.

### 4.5 — Currencies NOT NULL/DEFAULT migration

**Problem:** `currencies.exchange_rate_to_xpf` is nullable and has no default.
`currencies.symbol_position` got DEFAULT 'suffix' in 00023 but the documented
nullable fix for `exchange_rate_to_xpf` was never applied.

**Fix:** New migration `supabase/migrations/00026_currency_constraints.sql`:
1. Backfill: `UPDATE currencies SET exchange_rate_to_xpf = 1.0 WHERE
   exchange_rate_to_xpf IS NULL;`
2. `ALTER TABLE currencies ALTER COLUMN exchange_rate_to_xpf SET DEFAULT 1.0;`
3. `ALTER TABLE currencies ALTER COLUMN exchange_rate_to_xpf SET NOT NULL;`

**Not included:** `symbol_position NOT NULL` — deliberately out of scope (data
risk; code already handles suffix default). Sticking to the documented fix.

### 1.4 — CSP + API route headers

**Problem:** Middleware sets several security headers but no
`Content-Security-Policy`, and the matcher excludes `/api/*`, so no headers apply
to API responses.

**Fix (two parts):**

1. **Extract a `setSecurityHeaders()` helper** in `src/lib/http/security-headers.ts`
   that sets the full header set including CSP. Call it from `middleware.ts`.
   CSP policy:
   ```
   default-src 'self';
   script-src 'self' 'unsafe-inline' 'unsafe-eval';
   style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:;
   font-src 'self' data:;
   connect-src 'self' https://*.supabase.co https://api.resend.com https://api.stripe.com;
   frame-ancestors 'none';
   base-uri 'self';
   form-action 'self';
   ```
   (`'unsafe-inline'`/`'unsafe-eval'` in script-src are required for Next.js
   hydration/inline scripts; this is the standard Next.js CSP posture.)

2. **Cover `/api/*`** via a `headers()` export in `next.config.ts` applying the
   same header set to all routes. Next static headers apply universally including
   API routes, complementing the middleware (which handles auth-aware routes).
   CSP is harmless on JSON API responses.

### 6.5 — Portal email → React Email

**Problem:** `src/app/api/v1/portal/auth/route.ts:114-134` builds the magic-link
email as an inline HTML string and sends via raw `fetch` to Resend.
`@react-email/components` is already a dependency (used in invoice-email.tsx) but
not used here.

**Fix:**
1. Create `src/lib/email/portal-magic-link-email.tsx` — a React Email component
   accepting `{ magicLinkUrl, customerName? }` and rendering the branded layout
   matching the existing invoice-email styling.
2. In `portal/auth/route.ts`, replace the inline HTML string with
   `renderAsync(<PortalMagicLinkEmail ... />)` from `@react-email/render` (or the
   components' own render helper).
3. Switch transport from raw `fetch` to the `resend` SDK (`resend` is already in
   package.json). This centralizes email sending and removes manual
   header/auth construction.

**Verification:** the magic-link email still delivers; the link URL is identical.

### 6.1 — Complete OpenAPI spec

**Problem:** `docs/openapi.yaml` documents 44 paths; several API routes are
undocumented.

**Fix:** Enumerate every `src/app/api/v1/**/route.ts`, diff against documented
paths, and document the gaps following the existing 44-path patterns (request
schemas, response shapes, status codes, auth requirements). Report honestly if
the gap is larger than fits a single pass.

## Execution Order

Optimal ordering by dependency and risk:

1. **2.4** (smallest, blocks nothing)
2. **6.4** → **5.1** → **6.9** → **6.10** (tiny, independent, batch)
3. **4.5** (migration, independent)
4. **1.4** (middleware/config — do before 6.5, both touch auth-adjacent code)
5. **6.5** (React Email refactor)
6. **6.1** (OpenAPI — last, pure docs)

## Verification

- `npm run lint` after each code-touching item
- `npm run build` after the full pass
- Grep re-checks:
  - 0 `Record<string, unknown>` in parse-query-params.ts
  - 0 references to `quote.id` before line 178 in quote-request/route.ts
  - `engines` field present in package.json
  - `ty`/`mq` absent from routing.ts locales array
- Manual logic review of the 2.4 rollback path
- Migration SQL review (idempotent, ordered backfill-before-NOT-NULL)

## Risks

- **6.5** is the highest-risk item (touches the auth email path). Mitigation:
  keep the link URL generation identical; only the rendering/transport changes.
- **1.4 CSP** could break a third-party integration if any exists. Mitigation:
  `connect-src` already includes supabase/resend/stripe; `'unsafe-inline'`/`'unsafe-eval'`
  in script/style covers Next.js needs. Monitor after deploy.
- **4.5 NOT NULL** could fail if any row has a null that the backfill doesn't
  catch. Mitigation: backfill runs before NOT NULL in the same migration.
