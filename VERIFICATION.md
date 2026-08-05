# Verification report

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

## Required post-deploy checks

1. Apply migrations 0001, 0002, and 0003 in order.
2. Run authenticated probes 1–8 above, with special attention to direct PATCH of tier.
3. Verify signed-out and signed-in console state in a real browser.
4. Exercise two real sessions for new-thread gating, reply-after-thread behavior, unread counts, and mark-read.
5. Exercise all four Stripe test prices, in-place plan change, recoverable billing redirect, cancellation, duplicate reconciliation, and webhook retries.


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
