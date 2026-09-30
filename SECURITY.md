# Security

## Principles

1. **The database is the security boundary.** Every table has Row Level Security; every privileged operation is a SECURITY DEFINER function that checks the caller. Frontend role checks are for UX only.
2. **Least privilege.** The browser only has the publishable key. The service-role key is used by exactly one server route (email sending) and is never exposed.
3. **Validate on the server.** All server actions validate input with zod; the database re-validates with CHECK constraints and function checks.
4. **Never show raw errors.** Only messages written for users (`LOUPE:*` details) reach the UI.

## Roles

| Capability | Visitor | User | Seller | Editor | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse published content, search, Buy Now | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save, collections, follows, reminders, reports | | ✓ | ✓ | ✓ | ✓ |
| Create brands/products, upload images, submit | | | ✓ | ✓ | ✓ |
| Edit own product while draft / changes requested | | | ✓ | ✓ | ✓ |
| Review, approve, reject, schedule, publish, edit any product | | | | ✓ | ✓ |
| Scores, featured, deals, articles, homepage, categories | | | | ✓ | ✓ |
| Users, roles, suspension, settings, deletions | | | | | ✓ |

## Row Level Security

Highlights (see `supabase/migrations/…0003_auth_rls.sql`):

- **Products**: visible if `published`, or to their seller, or to staff. Sellers can update only their own products in `draft`/`changes_requested`. A trigger rejects any direct `status` change and silently protects counters, so status only moves through `transition_submission()`.
- **Product children** (images, specs, videos, categories, tags) follow `product_visible()` / `can_edit_product()`.
- **Scores, deals, featured placements, articles, homepage, categories**: staff-only writes.
- **Saves, follows, reminders, notifications, settings**: owner-only. Notifications can only have `read_at` updated.
- **Collections**: public ones readable by all; private ones only by the owner (and staff for moderation).
- **Submissions / reviews**: readable by the seller and staff; written only by workflow functions. Messages can be written by the seller or staff.
- **Analytics, audit logs**: staff read only; written only by functions and triggers. `email_outbox` and `rate_limit_hits` have no API access at all.
- **Roles**: users can read their own; only `set_user_role()` (admin) changes them, and admins can't remove their own admin role.
- **Suspended users** fail `is_active_user()` and can't write.

Automated checks: `tests/integration/rls.test.ts` and `workflow.test.ts`; Supabase's security advisor shows no errors (remaining warnings are the intentionally callable RLS helper functions).

## Uploads

- Client: MIME allow-list, magic-byte check, size limit, minimum dimensions, decode + re-encode to WebP (strips metadata and neutralises polyglot files).
- Buckets: `allowed_mime_types` and `file_size_limit` enforced by Supabase.
- Storage RLS: writes only to `products/{id}/…` where `can_edit_product(id)`, `avatars/{uid}/…` for yourself, etc. Paths are random UUIDs.
- Server actions only accept image paths that match `products/{uuid}/{uuid}.webp` for the right product, and avatar/logo URLs inside the user's own folder.

## URLs and redirects

- Product and brand URLs must be `https://` with a public hostname (no credentials, localhost or private IP ranges) — checked in zod and by CHECK constraints.
- `/go/product/[id]` only redirects published products to `https://` URLs; everything else goes to `/products`.
- Login/sign-up `next` parameters only accept local paths (`safeNext`), preventing open redirects.
- Markdown is rendered without raw HTML; JSON-LD is serialised with `<` escaped.

## Abuse prevention

- Rate limits (database-side): submissions 10/day per seller, reports 10/hour, collections 30/hour, analytics events 240/10 min per visitor, click counting 5/10 min per visitor and product.
- Supabase Auth throttles logins, sign-ups and email sends; email confirmation is required.
- Duplicate detection by URL, SKU/model and name similarity is shown to sellers (published matches) and editors (all), never auto-rejected.
- Admins can suspend accounts and pause all submissions.
- CAPTCHA (hCaptcha/Turnstile) can be enabled in Supabase → Authentication → Bot protection; the forms need no changes for password sign-in beyond passing the token (not enabled by default).

## HTTP security

`next.config.ts` sets `Content-Security-Policy` (default-src self; images only from self and the Supabase host; frames only YouTube-nocookie/Vimeo; `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy`. Cookies are httpOnly, `SameSite=Lax`, `Secure` in production. Server Actions include Next.js' built-in origin checks (CSRF protection).

## Secrets

- `.env.local` and `*.local.md` are git-ignored. `.env.example` lists every variable with placeholders.
- Never prefix a secret with `NEXT_PUBLIC_`.
- Demo account passwords are random per seed run and only stored locally.
- Rotate any key that was ever pasted into chat, email or an issue.

## Audit log

`audit_logs` records workflow actions (with product, target status and message), product creation and price/name changes, role grants/revocations, suspensions and seller sign-ups. Admins see it in `/admin/settings` and per user.

## Reporting a vulnerability

Please contact the maintainers privately rather than opening a public issue.
