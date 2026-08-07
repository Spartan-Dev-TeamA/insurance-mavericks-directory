# Insurance Mavericks — Sync legal panels with expanded compliance content (rev 2)

## Changes from rev 1 (per Sol's adversarial review)
- Resolved a real contradiction: rev 1 said to add new CSS for the
  `<code>` file-path reference while also requiring every unrelated line
  outside the two `<article>` blocks stay byte-identical — a new CSS
  rule would necessarily touch the stylesheet, which is outside the
  articles. Resolved by NOT adding any new CSS: `.draft-note` is already
  monospace (`DM Mono`), so a bare `<code>` tag with no extra styling
  renders acceptably as-is — see D1 below.
- Defined "verbatim"/"paragraph-by-paragraph" concretely: each source
  paragraph that ends in a `[DRAFT NOTE: ...]` clause splits into a `<p>`
  (the policy text) plus a sibling `<div class="draft-note">` (the
  bracketed note) — matching the exact existing pattern already used for
  every other note in both panels (e.g. "Data retention and deletion").
  This is not a new decision, just stated explicitly with an example so
  a builder doesn't second-guess it for the two new sections.
- Verification's syntax-check step corrected: `node --check` doesn't
  apply directly to an HTML file — the check is to extract the inline
  `<script>` content to a temp `.js` file and check that, exactly as
  done in the prior task's build (nothing in the script should have
  changed at all, since this task only touches two `<article>` blocks —
  the check is a regression guard, not an expected-change check).
- Added explicit structural verification: confirm all three new sections
  land inside the correct `<article>` (not accidentally outside it or in
  the wrong panel), and that the footer's existing Privacy/Terms links
  still open the correct, now-updated panels (they weren't touched, but
  confirm nothing broke).

## Context

The Privacy Policy and Terms of Service panels already exist and are live
in `public/index.html` (`#panel-privacy` ~line 1268-1310,
`#panel-terms` ~line 1312-1359), built and reviewed in a prior task. The
user has now asked for the legal pages to address marketing-email
compliance (CAN-SPAM), state privacy rights, and confirmed — after an
explicit interview — that the scope is: **current site functionality
only** (no TCPA/SMS language, no Meta Platform Terms, no LinkedIn API
terms, since the site has none of those integrations today — it only has
a plain-text Facebook profile URL field, not a Meta API integration) and
**US only** (no CASL/PIPEDA). The user also explicitly acknowledged that
no AI-drafted document can be certified "legally compliant" — this
remains a draft requiring real attorney review, same as before.

The two source-of-truth markdown files,
`LEGAL_DRAFT_privacy.md` and `LEGAL_DRAFT_terms.md`, have already been
updated (by the boss directly, not Sol — this is drafting, not code) with
the new content:
- Privacy: a new "Marketing and commercial email (US CAN-SPAM Act)"
  section after "Email", and the old "Your choices" section split into a
  slimmer "Your choices" plus a new "Your US privacy rights" section.
- Terms: a new "Electronic communications" section inserted before
  "Termination".

This task is ONLY to sync the two rendered HTML panels in
`public/index.html` to match the updated markdown source — same
conversion approach as the original panel build (verbatim content,
`draft-note` callout treatment for `[DRAFT NOTE: ...]` bracketed text,
no rewriting or "improving" the drafted language). No other part of the
site changes.

## Scope

### 1. Privacy panel sync (`#panel-privacy`)
Re-read `LEGAL_DRAFT_privacy.md` in full and reconcile the rendered
`<article class="legal-article">` content in `public/index.html` against
it section-by-section:
- Insert a new `<h2>Marketing and commercial email (US CAN-SPAM Act)</h2>`
  section between the existing "Email" and "Cookies and local storage"
  `<h2>` sections. The source paragraph (`LEGAL_DRAFT_privacy.md` ~lines
  50-62) ends in a `[DRAFT NOTE: ...]` clause — split it exactly like
  every other note in these panels: policy-text sentences go in a `<p>`,
  the bracketed note goes in a sibling `<div class="draft-note">`, e.g.:
  ```html
  <h2>Marketing and commercial email (US CAN-SPAM Act)</h2>
  <p>[policy-text sentences up to, not including, the "[DRAFT NOTE:" clause]</p>
  <div class="draft-note">[DRAFT NOTE: ...full bracketed text...]</div>
  ```
  That note contains one inline code reference,
  `` `netlify/functions/lib/email.js` `` — render it as
  `<code>netlify/functions/lib/email.js</code>` with NO new CSS; the
  `.draft-note` div is already monospace (`DM Mono`), so a bare `<code>`
  tag renders acceptably without any stylesheet change. Do not add a
  `code` CSS rule anywhere — this task doesn't touch the `<style>` block
  at all.
- The existing "Your choices" `<h2>` section's `<p>` stays, but its
  `draft-note` div changes — the old note mentioned "confirm any
  state-specific privacy rights (e.g. CCPA...)"; the new markdown removed
  that clause from "Your choices" and moved it into a new dedicated
  section. Match the new markdown exactly (`LEGAL_DRAFT_privacy.md`
  ~line 85): "Your choices" keeps only the "add a real contact method"
  note.
- Insert a new `<h2>Your US privacy rights</h2>` section immediately
  after "Your choices", before "Changes to this policy" (source ~lines
  88-98). Same split as above: policy-text `<p>`, then
  `<div class="draft-note">` for the bracketed note.
- Everything else in the privacy panel (What we collect, How we use it,
  Payment information, Email, Cookies and local storage, Data retention
  and deletion, Changes to this policy, Contact, the draft banner, the
  date placeholder) is UNCHANGED — do not touch those sections, do not
  reformat, do not reorder.

### 2. Terms panel sync (`#panel-terms`)
Re-read `LEGAL_DRAFT_terms.md` in full and insert a new
`<h2>Electronic communications</h2>` section, converting its paragraph
verbatim, positioned exactly where the markdown places it: immediately
after "Directory content" and its `draft-note`, immediately before
"Termination" — i.e. between the existing "Directory content" section
and the existing "Termination" section. This section DOES have its own
`[DRAFT NOTE:]` — split it the same way as every other noted section:
policy-text sentences in a `<p>`, the bracketed note in a sibling
`<div class="draft-note">`. (Historical note: an earlier draft of this
section had no note; it was added after a review round found the
original wording made an inaccurate claim about what happens to billing
emails after profile deletion — always convert whatever the current
`LEGAL_DRAFT_terms.md` actually contains, not what a prior version had.)
Everything else in the terms panel is UNCHANGED — same instruction as
above, do not touch, reformat, or reorder any other section.

## Design

Use the exact same HTML patterns already present in these two panels:
`<h2>` for section headings, `<p>` for body paragraphs, `<div class="draft-note">`
for the bracketed note split out of each source paragraph (matching the
existing pattern, e.g. "Data retention and deletion" already does this
split). No new CSS, anywhere, for any reason — this task does not touch
the `<style>` block. The one new element type is a bare
`<code>netlify/functions/lib/email.js</code>` tag inside one
`draft-note` div; it inherits the div's existing monospace styling with
no additional rule needed.

## Verification
- Semantic content comparison (not literal byte diff) between each new
  section's rendered HTML and its markdown source: collapse markdown
  soft line-wraps and HTML whitespace, strip the markdown backtick
  delimiters around the code reference (the text itself must still
  appear, now inside `<code>` tags), and confirm every sentence — both
  the policy-text `<p>` and the bracketed `draft-note` — appears with
  nothing added, removed, or paraphrased.
- Confirm section ORDER matches the markdown exactly in both panels: the
  two new privacy `<h2>` blocks land between Email/Cookies-and-local-storage
  and between Your-choices/Changes-to-this-policy respectively; the new
  terms `<h2>` block lands between Directory-content and Termination.
  That's three new `<h2>` sections total (two in privacy, one in terms),
  plus one modification to the existing "Your choices" `draft-note` text
  (not an insertion).
- Confirm all three new sections are children of the correct `<article
  class="legal-article">` in the correct panel (`#panel-privacy` vs.
  `#panel-terms`) — not accidentally outside the article or in the wrong
  panel.
- Confirm no other section of either panel changed and no other part of
  `public/index.html` was touched (diff the full file against its
  pre-edit state; every line outside the three new insertions and the
  one "Your choices" note replacement should be byte-identical —
  including the `<style>` block, which must have zero changes since no
  new CSS is being added).
- Confirm the footer's existing Privacy/Terms links still open the
  correct, now-updated panels (unchanged code path, but verify nothing
  broke).
- Extract the inline `<script>` block to a temp `.js` file and syntax-check
  it (it shouldn't have changed at all, since this task only touches the
  two `<article>` blocks — this is a regression guard, not an
  expected-change check).

## Build order
B1 privacy panel sync → B2 terms panel sync → B3 verification pass. No
git operations. Do not modify `LEGAL_DRAFT_privacy.md` or
`LEGAL_DRAFT_terms.md` — they are already correct and are the source of
truth for this sync; only `public/index.html` changes.

## Boss verification gate
- Every new sentence from both updated markdown files appears verbatim
  in the corresponding rendered panel, in the correct position.
- No regression to any other section of either panel, or to any other
  part of the file.
- The draft banner, draft-note styling, and overall visual pattern stay
  consistent with the existing panels — the new sections should be
  visually indistinguishable in style from the sections around them.
