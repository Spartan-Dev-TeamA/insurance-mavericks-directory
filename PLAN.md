# Insurance Mavericks — Legal pages, signup consent, button loading states (rev 3)

## Changes across review rounds (superseded by the live spec below — kept as a short changelog, not a source of truth)
Two adversarial rounds with Sol corrected: two wrong code citations
(`loadEmailPreferences()` does NOT re-enable on error;
`startPricingCheckout()` has no try/catch — `maybeResumeCheckout()` and
`toggleEmailNotifications()` are the real examples); the signup markup
being a `<div>` not a `<form>` (no native `required` enforcement);
the modal/legal-link navigation contradiction (resolved: legal links
close the modal, then switch panels — this does NOT lose typed field
values, `closeAuthModal()` never clears inputs); Enter-key resubmission
needing an explicit in-flight guard, not just `button.disabled`;
checkbox state needing a reset point; draft-banner/DATE-placeholder
scope; footer DOM placement; the `[DRAFT NOTE:` count (verified by grep:
**4 in privacy + 7 in terms = 11 total**, not 7); and Google sign-in
consent, which was ultimately dropped entirely and declared out of scope
(`#google-btn-container` sits outside both auth-form tabs and
`handleGoogleSignIn()` is a combined login-or-signup flow that can't
distinguish new vs. returning users — gating it correctly needs a real
UI restructure, and Google Sign-In is already an accepted,
already-documented out-of-scope gap for this whole task). All of these
are reflected directly in the S1-S4/D1-D4/Verification sections below;
this changelog is historical context only, the sections below are
authoritative.

## Context

Static site, `public/index.html` (inline CSS+JS), single-page-app panel
pattern already established (`PUBLIC_TABS` set at line ~2294, `switchTab`
panel-name array, e.g. Map/Pricing panels at lines 1144/1167). Draft legal
content already written and reviewed by the boss:
`LEGAL_DRAFT_privacy.md` and `LEGAL_DRAFT_terms.md` in the repo root —
these are the SOURCE TEXT to render into new panels, not to be rewritten
or improved, just converted from markdown into the site's existing
HTML/CSS panel style (dark background, green accent, same typography as
other panels). Both files start with a DRAFT/not-reviewed-by-counsel
notice that MUST be preserved and rendered visibly at the top of each
panel, not stripped out.

No site-wide footer exists yet (`.card-footer` is an unrelated
member-card component class, not a page footer) — one needs to be added.

Existing loading-state pattern to replicate: `toggleEmailNotifications()`
(`public/index.html:~1560-1578`) disables the control before the `await`,
re-enables with the new state on success, and re-enables while reverting
to the previous state on error — using a request-token pattern to guard
against stale async responses racing a newer one. `maybeResumeCheckout()`
(~1846-1856) is the codebase's existing plain `finally`-based re-enable
example. For these 4 simple single-submit buttons a request-token isn't
needed (only the toggle has rapid-fire re-triggering concerns); a plain
disable/try/finally is sufficient here — don't over-copy the toggle's
full pattern where it isn't needed. (`loadEmailPreferences()`, the
sibling function that loads the toggle's initial state, deliberately
does NOT re-enable on error — that's a different, intentional case, not
a pattern to copy.)

Button/handler locations (verified in current source):
- `doLogin()` — line ~1410, button at line 845 (`LOG IN`, no `id`).
- `doSignup()` — line ~1436, button at line 863 (`CREATE ACCOUNT`, no `id`).
- `submitForm()` (onboarding save) — line ~2326, button at line 1045
  (`SUBMIT TO DIRECTORY`, no `id`).
- `saveProfile()` (profile edit save) — line ~1638, button at line 1137
  (`SAVE CHANGES`, no `id`).

## Agreed spec (from user interview)

S1. **Two new public panels**: `#panel-privacy`, `#panel-terms`, added to
    `PUBLIC_TABS` and the `switchTab` panel-name array (same as
    `map`/`pricing`). Content is the markdown from `LEGAL_DRAFT_privacy.md`
    / `LEGAL_DRAFT_terms.md` converted to HTML matching the site's
    existing panel styling — headings, paragraphs, and the `[DRAFT NOTE:
    ...]` bracketed placeholders rendered as visibly distinct callouts
    (not deleted, not silently normalized into regular body text — a
    real person publishing this needs to see exactly what still needs
    filling in). The top DRAFT notice becomes a persistent, clearly
    styled banner (e.g. amber/warning-toned, not the site's green
    success color) at the top of both panels.
S2. **Site footer** (new — none currently exists): small, unobtrusive,
    visible on every panel (not just public ones), with links to Privacy
    Policy and Terms of Service (`switchTab('privacy')` /
    `switchTab('terms')` — both are in `PUBLIC_TABS` so this works
    regardless of auth state). Keep it minimal — a thin bottom bar
    consistent with the site's existing dark/green aesthetic, not a new
    heavy component.
S3. **Signup consent checkbox**: in the signup form (near the
    `CREATE ACCOUNT` button, line ~863), add a checkbox: "I agree to the
    [Privacy Policy] and [Terms of Service]", with the two bracketed
    phrases as clickable link elements. Since the auth modal is a
    fixed full-screen overlay and `switchTab()` only changes panel
    visibility underneath it, clicking either link (a) closes the auth
    modal via the same path the existing close control uses, then
    (b) calls `switchTab('privacy')` / `switchTab('terms')`. This closes
    the modal (necessary since it sits above the target panel at
    `z-index: 300`) but does NOT lose any typed-in field values —
    `closeAuthModal()` only clears the `open` class and error text, it
    never touches input values. `doSignup()` must check the checkbox is
    checked and show a clear inline error via the existing
    `showAuthError()` mechanism (not just a toast) if not, before
    attempting the network call — since the markup is
    `<div class="auth-form">` not a real `<form>` element, there is no
    native HTML `required`/submit-blocking behavior here; enforcement is
    entirely in `doSignup()`'s JS. **Google sign-in is explicitly NOT
    gated by this checkbox** — `#google-btn-container` (line 868) sits
    outside both `#auth-form-login` and `#auth-form-signup`, shared
    across tabs, and `handleGoogleSignIn()` (~line 1332) is a single
    combined login-or-signup flow that can't distinguish a new account
    from a returning member before completing — gating it correctly
    would mean wrongly re-prompting existing members on every login, or
    a real UI restructure; Google Sign-In is already a documented,
    accepted, out-of-scope gap for this whole task (unconfigured,
    `GOOGLE_CLIENT_ID` still a placeholder, not live in production). Do
    not add any check to `handleGoogleSignIn()`. This is explicitly a
    UX/consent affordance for password signup only, not a legal
    enforcement mechanism — do not add any server-side enforcement of
    this checkbox (out of scope, and the RPC layer has no concept of
    consent state). The checkbox resets to unchecked every time the auth
    modal is opened (wherever the existing open-modal function,
    `openAuthModal()` at ~line 1371, runs), so a previous session's
    checked state never carries into a new attempt.
S4. **Button loading states** for the 4 buttons listed above: loading
    begins only after each function's existing synchronous
    validation/preflight checks pass (e.g. `submitForm()`'s early returns
    at ~2327-2339, `saveProfile()`'s early returns through ~1650, the new
    consent check in `doSignup()`) — a synchronous validation failure
    must leave the button untouched, not flash a loading state. Once past
    validation: disable the button, change its visible label to a
    pending state (e.g. "Signing in…", reuse the existing `submit-btn`
    class, just swap `disabled` + `textContent`), and set an in-flight
    boolean flag scoped to that function (e.g. a module-level
    `let loginInFlight = false;`) so that Enter-key submission — the
    password fields call `doLogin()`/`doSignup()` directly on keydown,
    not only via the button's `onclick`, per lines ~843/861 — is also
    blocked while a request is outstanding, not just the button click.
    Re-enable the button and clear the in-flight flag with the original
    label in both the success path (implicitly, since success usually
    navigates/closes the modal — but re-enable defensively anyway in case
    it doesn't) and the catch/error path, via `try/finally` so it can't
    be skipped by an unexpected throw — matching `maybeResumeCheckout()`'s
    existing `finally`-based re-enable pattern (~1846-1856).

## Design

### D1. Panel content conversion
Worker reads both `LEGAL_DRAFT_*.md` files and converts each into a
`<div class="panel" id="panel-privacy">...</div>` /
`#panel-terms` block. Reuse `public-panel-wrap`/`section-eyebrow` for the
panel header only (matching Pricing, `#panel-pricing` ~line 1167+); the
body content (multiple `h2` sections, paragraphs, an effective-date line)
needs its own new, minimal CSS for readable article-style long-form text
(reasonable heading/paragraph spacing) since no existing panel has this
shape — don't force-fit the Pricing panel's card-grid styling onto prose.
The rendered "draft banner" is the bold warning paragraph text from each
source file's opening lines (the "This is a starter draft prepared for
review, not final legal advice..." paragraph) rendered as a
`<div class="draft-banner">` styled distinctly (amber/warning, not the
site's green), placed as the first child of each panel's content, above
the `<h1>` title. The leading HTML comment in each source file
(`<!-- DRAFT CONTENT — NOT REVIEWED BY COUNSEL ... -->`) is a markdown
comment only — it has no rendered HTML equivalent and is not part of the
conversion. Both `[DRAFT NOTE: ...]` bracketed text AND
`[DATE — fill in before publishing]` placeholders become the same
callout treatment: block-level `<div class="draft-note">` when the
source note is its own paragraph or spans a full sentence within one
(e.g. Terms lines 61-64, 75-77), inline `<span class="draft-note">` only
for short parenthetical-style notes embedded mid-sentence. Same minimal
new CSS for both (dashed border/amber text) — worker's judgment on
block-vs-inline per note, guided by the source markdown's own paragraph
structure.

### D2. Footer
A new `<footer>` element (semantic HTML, not another `<div>`), placed
once in the document immediately after `.main` and its panels close, and
before the toast element and any `<script>` tags — so it sits in normal
document flow (not fixed/sticky, not part of the modal's overlay stack)
and is never duplicated per panel or touched by `switchTab()`. Contains the two links plus a copyright line
(`© <current year> Insurance Mavericks` — a static year is fine, this is
a starter footer not a dynamic one). Minimal new CSS matching existing
dark/muted-text patterns already in the stylesheet (reuse
`var(--muted)`-equivalent existing custom properties, don't invent new
color tokens). Known, accepted limitation: while the auth modal is open
(`z-index: 300`, fixed full-screen), the footer underneath is not
visible — this is fine, the footer's own links aren't needed there since
the signup checkbox has its own links (D3).

### D3. Signup checkbox
New checkbox input near the `CREATE ACCOUNT` button, inside
`#auth-form-signup` only (not shared with the login tab, not near
`#google-btn-container`). `doSignup()` gains an early check: if
unchecked, show the existing `showAuthError('signup-error', ...)`
inline error mechanism already used for other signup validation in that
function (reuse it, don't add a second error-display mechanism) and
return before touching the network. **`handleGoogleSignIn()` is NOT
touched — no consent check added there, per S3.** The two link phrases
inside the checkbox label are
`<a href="#" onclick="closeAuthModal(); switchTab('privacy'); return false;">`
style elements (real anchor tags for keyboard/screen-reader
accessibility — focusable and activatable with Enter, matching native
`<a>` keyboard behavior — with `return false`/`preventDefault()` to stop
the `href="#"` from adding a history entry or jumping scroll position),
calling `closeAuthModal()` (~line 1380) followed by `switchTab()`. This
deliberately closes the modal and switches the visible panel — that is
the intended behavior per S3, not a bug to avoid; typed field values
survive since `closeAuthModal()` doesn't clear inputs. Checkbox
`checked` state resets to `false` wherever `openAuthModal()` (~line
1371) runs.

### D4. Loading states
Illustrative pattern per button — order matters, this is not just a
disable/re-enable wrapper:
```
let loginInFlight = false;

async function doLogin() {
  if (loginInFlight) return;                      // 1. in-flight guard, first
  const btn = /* the LOG IN button element */;
  /* existing synchronous validation / preflight checks stay here,
     UNCHANGED, and still `return` early without touching btn/inFlight
     at all — a validation failure must never show a loading state */
  if (!db.ready) { showAuthError(...); return; }
  if (!email || !password) { showAuthError(...); return; }

  loginInFlight = true;                            // 2. only after validation passes
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  try {
    /* existing async body */
  } catch (e) {
    /* existing error handling */
  } finally {
    btn.disabled = false;
    btn.textContent = original;
    loginInFlight = false;                         // 3. always clears, even on throw
  }
}
```
Each of the 4 functions gets its own `<name>InFlight` boolean (not
shared across functions) so one loading button doesn't block an
unrelated one. Buttons currently have no `id` — worker adds one (or uses
a scoped `querySelector` from the modal container) to reference them
from JS; match existing ID-naming conventions already used elsewhere in
the file (kebab-case, prefixed by context, e.g. `login-submit-btn`). Do
not introduce a shared helper function for this — 4 call sites, each
with slightly different existing try/catch bodies and validation, doesn't
justify one.

## Verification
- `node --check`-equivalent syntax validation of the inline script
  (temp-extract and parse, matching the pattern used throughout this
  project's prior route-loop builds).
- Grep-based checks: `PUBLIC_TABS` includes exactly
  `{welcome, map, pricing, privacy, terms}`; all 11 `[DRAFT NOTE:`
  occurrences (4 in privacy, 7 in terms — verified by grep) and both
  `[DATE` placeholders survive into the rendered panel HTML (count them,
  don't just confirm "a marker exists somewhere"); every `##` heading
  from both source files is present as a heading element in the
  corresponding panel; footer links call `switchTab('privacy')` /
  `switchTab('terms')`; `handleGoogleSignIn()` is unchanged (no consent
  check added, per S3/D3).
- Manual trace per button: confirm `doSignup()`'s checkbox gate runs
  BEFORE any `db.ready`/network check (fail fast, no wasted request); confirm the
  in-flight guard blocks a second Enter-key-triggered call while a
  request is outstanding; confirm every early-return/validation-failure
  path in `submitForm()` (~2327-2339) and `saveProfile()` (through
  ~1650) leaves the button in its normal (never-disabled) state, and
  that the 4 buttons' `finally` blocks can't leave a button permanently
  disabled if an unexpected exception type is thrown.
- Confirm the legal links are real `<a>` elements reachable and
  activatable by keyboard alone (Tab + Enter), not `<span>`/`<div>` with
  only a click handler.
- Boss reads the full diff plus does a side-by-side read of the rendered
  panel content against the two `LEGAL_DRAFT_*.md` source files to
  confirm nothing was lost or altered in the HTML conversion, before
  approving.

## Build order
B1 legal panel content conversion (D1) → B2 footer (D2) → B3 signup
checkbox + doSignup gate (D3) → B4 button loading states, all 4 (D4) →
B5 verification pass. No git operations. `PLAN.md` retained until boss
deletes it. Do not delete or modify `LEGAL_DRAFT_privacy.md` /
`LEGAL_DRAFT_terms.md` — they remain as source-of-truth reference files
in the repo alongside the rendered HTML version.

## Boss verification gate
- Draft banner and all draft notes/DATE placeholders are genuinely
  visible in the rendered panels, not lost in conversion.
- Footer present in normal document flow, links work, doesn't break
  existing panel-switching behavior or the modal's overlay stacking.
- Signup checkbox blocks password signup when unchecked, with a visible
  inline error; Google sign-in is deliberately not gated (documented
  out-of-scope, per S3); clicking the Privacy/Terms links from inside
  the checkbox closes the modal and switches to the legal panel as
  designed (not a bug — confirmed intended behavior, and typed field
  values survive it).
- All 4 buttons show a real loading state, always re-enable including on
  error, and Enter-key resubmission is blocked while a request is
  in-flight.
- Nothing else in the existing 2000+ line file regressed (full diff read,
  not just the new sections).
