# Verification report

## Live verification — 2026-08-06/07 (supersedes the stale sections below)

Everything in this section was run against the real production system
(insurance-mavericks.com, the live Supabase project, and Stripe live mode)
after migrations 0001–0005 were confirmed applied and a broken Supabase
Auth "Site URL" (was `localhost:3000`, breaking every email-confirmation
link) was fixed. This closes the gap the 2026-08-05 snapshot below left
open: those 8 probes had never actually been run against a live schema.

### Two real bugs found and fixed live

1. **`upsert_my_profile` was completely broken — blocked every signup.**
   `RETURNS TABLE(..., user_id uuid, ...)` collided with the bare
   `on conflict (user_id)` target inside the function body, causing
   `ERROR: column reference "user_id" is ambiguous` (42702) on every call.
   Discovered via probe 1 below. Verified the fix
   (`#variable_conflict use_column`) against a real local `postgres:15`
   container — both the insert path and the update/on-conflict path —
   before recommending it. Applied live as
   `0006_fix_upsert_my_profile_ambiguous_column.sql`. Re-verified live:
   profile creation now succeeds.
2. **The message-notification Database Webhook was never actually
   created.** `netlify/functions/message-email-hook.js` is correct — it
   sends a real, delivered email when invoked directly — but nothing was
   calling it. `DEPLOY.md` §5 describes this as a Dashboard "Database
   Webhook" step, which was never completed. First fix attempt used
   `supabase_functions.http_request()`, which this project doesn't have
   (`schema "supabase_functions" does not exist` — confirmed live). This
   project uses the `pg_net`-based mechanism instead, which is what
   Supabase's Dashboard "Create a new hook" flow actually generates.
   Corrected trigger applied live as
   `0007_message_notification_webhook_trigger.sql` (syntax/logic verified
   against a locally stubbed `net.http_post` before applying; the real
   HTTP call itself isn't testable outside Supabase's environment).
   Re-verified live: a real `send_message` call now triggers an automatic,
   delivered notification email within ~4 seconds, no manual invocation
   needed.

### Live RLS/RPC probes — all 8 planned + 2 bonus, ALL PASS

Ran against two throwaway pre-confirmed Supabase Auth users (created via
the admin API, since real signup requires an inbox we don't control for
the `@insurance-mavericks.com` test addresses used).

| # | Probe | Result |
| --- | --- | --- |
| 1 | Create profile via `upsert_my_profile` | PASS (after the fix above; failed before it) |
| 2 | Direct `PATCH profiles` setting `tier=pro` | PASS — rejected, `42501 permission denied for table profiles` |
| 3 | Direct `PATCH`/`INSERT` on `stripe_customer_id` | PASS — rejected, same `42501` |
| 4 | `SELECT` another profile's Stripe columns | PASS — rejected, same `42501` |
| 5 | `set_my_tier('free')` (idempotent) | PASS — succeeds |
| 6 | `send_message` to a recipient with no profile | PASS — rejected, "Recipient has no profile" |
| 7 | `send_message` from a sender with no profile | PASS — rejected, "Create your profile before sending messages" |
| 8 | `get_directory_stats()` (anon) | PASS — returns real aggregate counts |
| bonus | `get_my_email_prefs()` | PASS — defaults `true` |
| bonus | `get_state_coverage_counts()` (anon, 0005) | PASS — returns real per-state counts |

### Full signup/messaging smoke test — ALL PASS

Two throwaway profiles created and confirmed in Directory search. Email
notification toggle confirmed to persist (`false` then `true` round-trip).
One account granted a test Pro tier via the Supabase **service role**
directly against the table (never through the app's own RPCs/anon key —
that path is exactly what the hardening above blocks). Messaging then
exercised fully live: Free→Pro send succeeds, unread count correct,
`mark_thread_read` works, reply-in-thread from Pro→Free succeeds
regardless of tier (matches the intended messaging rules). Welcome email
confirmed: sends on first call, delivered, at-most-once (`alreadyClaimed`
on a second call, no duplicate send), correct branded content, valid
unsubscribe link. Message-notification email confirmed firing
automatically post-fix (see bug #2 above). Cleanup: tier reverted to
`free` before deletion, both profiles and both Auth users fully deleted
via the admin API — no leftover data (better than anticipated; the admin
API can delete Auth users cleanly, not just profiles).

### Stripe webhook verification — real signed events, not the dashboard's test-event button

Rather than fight repeated Stripe dashboard rendering instability, this
was done by constructing genuinely valid `Stripe-Signature` headers
locally (the signing scheme is public: HMAC-SHA256 over
`timestamp.payload` using the real `STRIPE_WEBHOOK_SECRET`) and POSTing
directly to the live endpoint — arguably more rigorous than Stripe's own
"send test event" button, since it exercises real profile resolution
against a real (harmless, no-charge) Stripe customer rather than
disconnected fake IDs.

| Event | Result |
| --- | --- |
| `checkout.session.completed` (real test customer, no subscriptions) | PASS — 200, resolved profile via `metadata.supabase_user_id`, wrote `stripe_customer_id` correctly, tier stayed `free` (correct — no real subscription) |
| `customer.subscription.updated` (fake subscription id) | PASS — 200, Stripe 404 on the fake id handled correctly (`isStripeNotFound` → tier defaults to `free`), wrote `stripe_subscription_id` correctly |
| `customer.subscription.deleted` (same fake id) | PASS — 200, same correct no-op-at-free handling |
| Invalid signature | PASS — 400, "No signatures found matching the expected signature" |

This still does not exercise a real Checkout Session UI flow or a real
paid subscription (deliberately skipped — this Stripe account is in live
mode, so that would charge a real card). Real end-to-end checkout through
the browser UI remains unverified live. Test Stripe customer and test
Supabase account both fully cleaned up.

### Config sanity checks

- `RESEND_API_KEY` set in Netlify **is the full-access key**, not
  sending-scoped (confirmed by successfully listing all Resend API keys,
  which a sending-scoped key cannot do). `DEPLOY.md` already recommends
  swapping this for production; not yet done — separate decision.
- `public/supabase-client.js`'s `SUPABASE_URL`/`SUPABASE_ANON_KEY` exactly
  match the live Netlify environment variables.

### Still not verified live

- Real Checkout Session UI flow with a real payment method (deliberately
  skipped, live-mode charge risk).
- Real signup through the actual browser UI end-to-end (the RLS/messaging
  probes above used the Supabase Admin API to create pre-confirmed test
  users, not the real signup form + email link, though the underlying
  Site-URL bug that would have broken that path was separately confirmed
  fixed by the user).
- Google Sign-In — intentionally unconfigured
  (`GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'`); no action taken.

---

## 2026-08-05 snapshot (historical — see live verification above for current state)

Date: 2026-08-05
Scope: PLAN.md revision 6, build steps B2 through B7. B1 was inherited as complete.

## Completed automated checks

| Check | Result |
| --- | --- |
| Browser publish tree | PASS — public/ contains only index.html, supabase-client.js, and stripe-client.js |
| Netlify publish setting | PASS — netlify.toml publishes public/ and keeps functions in netlify/functions |
| JavaScript syntax | PASS — the two browser clients, inline application script, checkout, portal, and webhook all parse with the Node VM parser |
| Local HTTP smoke | PASS — an in-process server returned public/index.html with HTTP 200 and both local script references present |
| Missing-environment behavior | PASS — checkout, portal, and webhook returned HTTP 500 with configuration errors when their required variables were absent |
| Checkout profile requirement | PASS — a mocked authenticated request with no profile returned HTTP 400 before Stripe checkout creation |
| Webhook winner election | PASS — an active older subscription defeated newer past_due and incomplete candidates |
| Duplicate cancellation | PASS — both non-elected live subscriptions were cancelled with prorate true and invoice_now false |
| Winner persistence | PASS — the reconciliation test stored the elected subscription ID and derived Pro from its actual configured price |
| Webhook zero-row update | PASS — an update matching zero profile rows returned HTTP 500 |
| Discarded duplicate event | PASS — an event whose subscription differed from the elected stored subscription returned HTTP 200 without retrieval or downgrade |
| Profile client projections | PASS — public/supabase-client.js contains no select('*') and requests only safe profile/message columns |
| Migration 0003 safe returns | PASS — no RPC in 0003 returns public.profiles and 0003 contains no RETURNING * |
| URL/XSS hardening | PASS by source review — shared esc() is used for directory, thread identities/previews, message bodies, image attributes, and card fields; photo/Facebook rendering requires an absolute http(s) URL |
| Tier action gating | PASS by source review — Free has no contact/message action; Basic has only a valid Facebook action; Pro has valid Facebook plus MESSAGE |
| Messaging behavior | PASS by source review — new-thread Pro enforcement and sender-profile enforcement are in SQL; existing-thread replies bypass tier checks |
| Polling | PASS by source review — thread/unread polling is 30 seconds and an open thread is refreshed; checkout polls every 3 seconds for up to 30 attempts |
| Billing UI | PASS by source review — paid tiers expose Manage billing and no database-only cancellation control |
| Legacy/demo entrypoints | PASS for the primary app and publish tree — root app.js and styles.css are absent and no browser file references them |

## Live Supabase probes

The boss ran the live REST probes from a network-enabled environment on 2026-08-05. The project at https://krdjdzikepmkcjjibvqt.supabase.co has no application schema:

- `public.profiles` returned `PGRST205`: "Could not find the table public.profiles".
- `get_directory_stats` returned `PGRST202`.
- `send_message` returned `PGRST202`.

These results verify that migrations 0001 and 0002 are not applied; migration 0003 is therefore not applied either. Probes 1–8 remain post-migration checks and were not executable against the current schema-less project:

1. RPC existence/profile creation — NOT RUN.
2. Direct INSERT with Pro tier or Stripe IDs — NOT RUN.
3. Direct PATCH of own tier — NOT RUN.
4. Stripe identifier INSERT/UPDATE — NOT RUN.
5. Cross-profile Stripe identifier SELECT — NOT RUN.
6. set_my_tier('free') — NOT RUN.
7. New message to non-Pro recipient — NOT RUN.
8. Profile-less sender rejection — NOT RUN.
9. Service-role webhook paths — VERIFIED by source review and mocked handler tests only; live verification remains a post-deploy step.

Run migrations 0001, 0002, and 0003 in order in the Supabase SQL Editor, then run probes 1–8.

## Interactive browser verification

The app was served successfully over loopback for an HTTP-level smoke test. A browser-level signed-out console/UI check could not run because browser access to the loopback URL was denied. Signup, login, profile CRUD, upload, two-session messaging, and real Checkout/Portal interaction therefore remain post-deploy smoke tests.

## Cleanup

No live throwaway account, profile, message, or storage object was created because the application schema is absent. No cleanup was required. If later probes create a throwaway profile, remove it through delete_my_profile; its Auth user and avatar objects may remain until an administrator deletes them.

## Required post-deploy checks (status as of the 2026-08-06/07 live verification above)

1. ~~Apply migrations 0001, 0002, and 0003 in order.~~ DONE — 0001–0007 all applied live.
2. ~~Run authenticated probes 1–8 above~~ DONE — all pass, see live verification section.
3. Verify signed-out and signed-in console state in a real browser. STILL OPEN — live testing used the Admin API for test accounts, not a real browser session.
4. ~~Exercise two real sessions for new-thread gating, reply-after-thread behavior, unread counts, and mark-read.~~ DONE via direct API calls (not a real browser session) — see live verification section.
5. Exercise all four Stripe test prices, in-place plan change, recoverable billing redirect, cancellation, duplicate reconciliation, and webhook retries. PARTIALLY DONE — webhook event handling verified with real signed events (see live verification section); the real Checkout Session UI flow with an actual payment method remains untested (deliberately, to avoid a live-mode charge).


## Resend email infrastructure — revision 3

Implementation date: 2026-08-05

### Worker verification

| Check | Result |
| --- | --- |
| V1 changed JavaScript syntax | PASS — all five server files, both browser clients, both runnable scripts, and the inline application script parsed successfully |
| V2 webhook authentication/envelope | PASS — absent/wrong secret and malformed envelopes reject |
| V2 message notification no-op paths | PASS — missing reloaded row, sender outside thread, and disabled recipient preference do not send |
| V2 unsubscribe | PASS — GET made no mutation; valid signed POST disabled notifications; tampered signature rejected |
| V2 membership transitions | PASS — free→basic activated, basic→pro updated, pro→free cancelled, equal-tier none, CAS-loss none, and replay/equal-tier none |
| Template policy | PASS — all templates have HTML and text; dynamic HTML is escaped; membership confirmations contain no amounts or unsubscribe; message notifications omit message bodies and include both one-click headers |
| Migration/source safety | PASS — profile email columns and thread latch columns are absent from browser-safe grants; the service-only latch claim includes its unread predicate atomically |
| Generic secret-pattern scan | PASS — no credential-shaped `re_`, `sk_`, or `whsec_` value found in the repository |
| `PLAN.md` retention | PASS — retained as directed |

The mocked tests were executed locally through the Node REPL with mocked Supabase, Stripe, and email boundaries. They did not contact Supabase, Stripe, Resend, or Docker.

### Boss execution gates — COMPLETE (2026-08-05)

- **V2b: RAN, FOUND A BLOCKING BUG, FIXED, RE-RAN — ALL PASS.** First run of
  `node scripts/db-integration-test.mjs` against a real `postgres:15`
  container failed applying `0004_email_notifications.sql`:
  `claim_message_notification` used an invalid single-`$` dollar-quote
  delimiter instead of `$$`, a PostgreSQL syntax error that made the entire
  migration — including the notification RPC and its grants — unappliable.
  Codex's independent review flagged the same line. Fixed to `$$...$$`.
  Re-ran clean:
  ```
  PASS migrations 0001-0004 apply in order
  PASS concurrent welcome claims have one winner — winners=1
  PASS concurrent unread latch claims have one winner — winners=1
  PASS mark_thread_read re-arms caller latch
  PASS concurrent CAS tier transition has one owner — owners=1
  PASS message_threads exposes only browser-safe columns
  PASS messages RLS still allows participants and rejects outsiders
  PASS container teardown
  ```
- **V3: RAN — ALL FIVE VARIANTS DELIVERED.** Ran
  `node scripts/send-test-emails.mjs` with the live Resend key against
  `notifications@insurance-mavericks.com` → `liam.obrien@pcfginsurance.com`.
  All five sends succeeded and every one reached Resend status `delivered`
  on polling: activated, updated, cancelled, welcome, message-notification.
- **V4: RAN.** Searched the full repository for the literal API key value —
  no match anywhere (in addition to the passing generic `re_`/`sk_`/`whsec_`
  pattern scan above).

### Codex review findings

- **[P1, FIXED]** Invalid `$` dollar-quote delimiter in
  `claim_message_notification` (0004) — same defect V2b's first run caught.
  Fixed; migration now applies cleanly (see V2b above).
- **[P2, NOT APPLIED — contradicts approved design]** Codex flagged that
  the welcome claim and the message-notification latch are not released on
  a transient Resend send failure, permanently losing that email. This is
  not an oversight: it is the explicit "no outbox — accepted risk" design
  from PLAN.md D2/D4/D5, adopted after 5 rounds of adversarial planning
  review specifically because adding a retry queue/outbox was judged
  out of scope for this task. See "Accepted at-most-once boundaries" below.

### Accepted at-most-once boundaries

There is intentionally no outbox or retry queue. The welcome flow claims `welcomed_at` before sending, so a transient Resend failure permanently loses that welcome. Supabase Database Webhooks are asynchronous `pg_net` calls without guaranteed retries; a lost webhook or transient downstream failure can permanently lose a message notification.

The message latch guarantees at most one send attempt per unread cycle. It cannot guarantee at most one delivered email while the cycle is active because a prior-cycle send may still be in flight after a read re-arms the latch. Avoiding an email for a message that becomes read immediately before the external send is best-effort because the database and Resend cannot share a transaction.

Stripe CAS is the permanent transition-ownership guard; the Resend event idempotency key is a secondary same-event guard. Email failures are caught and do not change billing webhook response semantics.
