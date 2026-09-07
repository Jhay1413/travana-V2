# Extraction Work — Status

**Last updated:** 6 September 2026
**Companion doc:** [`EXTRACTION_AUDIT.md`](./EXTRACTION_AUDIT.md) — findings, evidence and the full plan
**Git HEAD:** `da08627c` ("wip") — all earlier work in this effort is committed there

---

## 1. Where we are in one paragraph

Four supplier extraction specs were found broken and fixed (database + seeder). Six interpreter/client
bugs found and fixed with tests. A full audit of the pipeline was then completed and written up in
`EXTRACTION_AUDIT.md`, identifying the root cause as an **open-loop pipeline** — specs induced from
one page, persisted, and trusted with no verification, no fixtures and no telemetry. Implementation
of the remediation plan is underway: Phases 1 and 2 are complete and wired, the field picker is built
end-to-end (bookmarklet → derivation → merge → storage → review UI),
and the currency work is the remaining Phase 1 item, blocked only on where the FX rate comes from.

---

## 2. Decisions taken

| Decision | Answer | Consequence |
| --- | --- | --- |
| Non-GBP deal storage | **Store source currency + FX rate** | Three columns: `currency`, `fx_rate`, `base_amount`. The supplier's true figure is never destroyed. |
| Validation blocking | **Never block; refuse to auto-fill bad money** | Deal always lands in the form. Fields that failed validation are left empty with the issue shown, so the agent types the number rather than trusting a wrong one. |

**Still open:**
- Second capture per supplier at onboarding (needed for Phase 5 multi-example induction).
- Fixture retention / redaction policy (Phase 3).
- **Where the FX rate comes from** — there is *no* FX source anywhere in the codebase today
  (no API, no config, no column). Recommendation: ship `fx_rate` nullable and agent-entered, with
  `base_amount` derived; add an automatic rate source later. Not yet agreed.

---

## 3. Completed and committed (`da08627c`)

### 3.1 Supplier spec fixes — database *and* `scripts/seed-data/supplier-scrapers.ts`

| Supplier | What was wrong | Fixed to |
| --- | --- | --- |
| **virginvoyages** | `ship_name` pinned to one voyage's literal name and blind to a blank line → matched nothing → entire cruise block dropped, deal imported as a package holiday | Anchored on the `N NIGHTS` / bullet header shape |
| | `cabin_type` returned `"  Aruban Nights"` | Anchored on `Choose cabin` → `"The Insider"` |
| | `quote_title` / `cruise_title` truncated to `"Southern Caribbean &"` | Line after the ship → full voyage name |
| **royalcaribbean** | Spec written against the US/USD site: every price regex required a literal `$`, so **all prices returned 0** on the GBP site | Currency-agnostic `[£$€]?\s*([\d,]+\.\d{2})` |
| | `currency` constant was `USD`; `wait.textMatches` waited for a USD amount that never renders on GBP (would time out a live scrape) | Currency read from URL `selectedCurrencyCode`, fallback GBP; currency-agnostic wait marker |
| | `ship_name` matched the prose *"Thrilling onboard activities"* (case-insensitive `Onboard`) | Anchored on `On Board` **as a line-ending label** |
| | `embarkation` swallowed three extra lines; `debarkation` rule demanded a US-format date and never matched | Bounded to one line; `debarkation` rule deleted (port table supplies it) |
| | `cabin_number` was a *detector* (`group: 0`) writing `"Room location\nTo be assigned *"` into the field | Digits-only rule — empty on a guarantee cabin, reads `1426` when assigned |
| **carnival** | `quote_title`/`cruise_title` returned **`"IMPORTANT NOTICE"`** (a site banner) — a positional *headings* rule silently coerced to read the page body | `from: "headings"`, second heading |
| | `debarkation` read the **state code** out of "from Miami, FL" → `"FL"` | Rule deleted; port table supplies it |
| **cunard** | `ship_name` matched *"our ships to make your voyage as comfortable as possible"* | Anchored on the voyage-header shape |
| | `quote_title` pinned to the literal heading "On this voyage" → empty | Read from page title |
| | `no_of_nights` read the browser title (28); body and calendar both say 27 | Read from body |
| | A **per-person** fare stored as the party total (£2,564 for two people) | `sales_price` rule dropped; interpreter derives pp × pax = £5,128 |

Backups of every pre-change config are in the session scratchpad.

### 3.2 Interpreter / client fixes (with tests)

- **Cruise detection gate widened** — a spec that *declares* cruise fields now counts as evidence, and
  the ship is no longer part of the gate. Previously one broken `ship_name` regex dropped the entire
  cruise block (line, sailing date, cabin, itinerary).
- **`On Board` / `Onboard`** both accepted as the ship label.
- **`parseDate` now handles month-first dates** (`Jul 02, 2027`). Previously these parsed to nothing,
  so the date fell back to Carnival's `sailDate=07022027` — MMDDYYYY read as DDMMYYYY, dating a
  **2 July sailing as 7 February**.
- **`MAX_DAY_RANGE = 21`** — a row spanning a long block of sea days (`Day 7-13`) was capped at 3 days
  and collapsed, which then broke day-run continuity and truncated a 28-day voyage at day 7.
- **`headings` added to the validator's `SOURCES` enum** — the root cause of the Carnival title bug.
- **Cruise import now sets the tour operator** — `handleCruiseJson` resolved every catalog value
  except this one, so imported cruises landed with an empty operator dropdown.
- **Package type resolution no longer fails silently** — `resolvePackageTypeId` falls back to the live
  query cache and warns if it still can't resolve, instead of leaving a cruise labelled
  "Package Holiday" with nothing said.

**Test count at commit: 917 passing.**

---

## 4. Implemented — Phase 1, Phase 2, and the field picker

**All tracks complete. Full suite: 1,053 tests passing across 77 files; zero client type errors.**

| Track | Status | Files |
| --- | --- | --- |
| Spec guards (Phase 2) | ✅ | `extraction-ai.service.ts`, `spec-sources.test.ts` |
| Validator (Phase 1) | ✅ wired | `extraction.validate.ts` + test, `scraper.service.ts`, `scraper.controller.ts` |
| Tenancy + date ordering | ✅ | `scraper.routes.ts`, `extraction.interpreter.ts` + test |
| Picker mode (bookmarklet) | ✅ | `public/capture-bookmarklet.js` (v14), `client/public/capture-bookmarklet.txt` |
| Picker → spec derivation | ✅ | `picker-spec.ts` + test |

### 4.0 The validator, wired

`validateQuote` runs from the SERVICE layer on both `importFromPage` and `scrapeFromUrl`, returns
`{ quote, validation }`, and **never throws or blocks** — the deal always lands in the form. Checks:
zero/​mismatched money, currency resolution and `CURRENCY_UNVERIFIED`, ISO+range dates, nights vs
itinerary vs title, prose in identity fields, spec coverage, and `CAPTURE_INCOMPLETE` (the spec's own
`wait.textMatches` re-applied as a post-hoc gate on the capture path).

**One correction made to the delivered work.** The prose check had been tuned to flag any value of
3+ words. Measured against the values this pipeline actually produced, that flagged **7 of 10 correct
values** — "Freedom of the Seas", "Southern Caribbean & Aruban Nights", "3-Day The Bahamas from
Miami, FL", "Plaza Prague Hotel" — while *still* missing "IMPORTANT NOTICE" and "Best room". A
warning that fires on most valid imports teaches agents to ignore the panel, hiding the real
failures. Replaced with a loose word limit (7) plus a **marketing-word lexicon**: 0 false positives,
0 missed bugs on the same data. Both lists are now regression tests in
`extraction.validate.test.ts` — keep them green when tuning.

### 4.1 Spec guards

Rejects four constructs **at generation time**, each mapped to a shipped bug: `group: 0` without a
`map` (TUI's whole-sentence airport), a proper-noun `fallback` (TUI's "Prague"), a `|` outside any
group (Jet2's dead alternation), and a literal run > 30 chars (Carnival's marketing-sentence anchor).
Exposed as a pure `findUnsafeRules(spec)` so it can also audit stored specs later, and mirrored into
the system prompt.

`imageContainerIncludes` added to `specSchema` (it was being silently stripped), with a round-trip
test typed `Record<OptionalSpecKey, unknown>` so **adding an `ExtractionSpec` key without adding it
to `specSchema` fails to compile**. That drift class caused two production bugs; it is now guarded at
the type level.

### 4.2 Field picker (bookmarklet v12)

Running the bookmarklet now offers **Instant capture** (unchanged) or **Field picker mode**. Picker
mode shows a draggable panel of fields grouped Always / Cruise / Hotel-Package; arm a field, click
the element. A capture-phase click listener suppresses the page's own navigation — essential, since
deal pages are mostly links. Hover highlights reuse the existing `setProperty(..., 'important')` +
undo-stack pattern; `Esc` restores every style touched. The panel is hidden before `innerText` is
read, so the picker's own UI can never leak into the payload and poison a spec.

### 4.3 Derivation — a click becomes a *verified* rule

`deriveSpecFromPicks(picks, ctx)` is pure and deterministic. Per field it tries five strategies in
order of durability and takes the first that **verifies**:

1. `url-param` — most durable; URL params outlive redesigns
2. `label-anchored` — `(?:^|\n)\s*<label>\s*\n+\s*([^\n]+)`, deliberately not a bare `^`, because the
   interpreter compiles without the `m` flag (§1.8) so `^` means start of the whole page
3. `heading-position` — positional, never by wording
4. `title-prefix`
5. `line-offset` — last resort, always `low` confidence

**Verification is the point:** every candidate is run against the real capture and kept only if it
reproduces exactly the value the agent clicked. Nothing unverified is ever emitted — an unmappable
pick becomes a `DerivationProblem`, not a guess. Derived rules are additionally passed through the
real `findUnsafeRules`, so the picker cannot produce a rule the AI generator would be refused for.
Transforms are inferred from the ground-truth value; confidence is downgraded to `low` when the
anchor is ambiguous (the "Taxes and fees" repeated-label class).

The bookmarklet and the server were built by separate agents against a fixed contract; the
`PickedField` shape was verified to match on all 11 fields.

### 4.4 Collapsed panels — the RC itinerary drawer

An agent captured a Royal Caribbean checkout **without opening the "View Ports" drawer** and the
entire itinerary was absent, silently. The content was in the DOM the whole time — an image inside
the collapsed drawer was captured and "Itinerary" survived in `headings`; `innerText` just excludes
collapsed content. Three layers now cover it:

1. `unfurlPanels()` (bookmarklet v14) expands `<details>`, `[hidden]` containers, `aria-expanded`
   targets resolved via `aria-controls`, and drawer/accordion/collapse classes — **style and
   attribute forcing only, never clicks** (clicking a live booking page can navigate or mutate a real
   reservation), with both styles and attributes restored even if it throws.
2. `deepText` is sent as its OWN payload field — never merged into `text`, because deep text also
   contains inactive tabs, other cabin grades and pre-rendered alternatives, and silently widening
   what every existing regex sees is how "Thrilling onboard activities" became a ship name. Rules opt
   in via `from: "deepText"`. The itinerary falls back to it only when the visible text yielded nothing.
3. `CRUISE_ITINERARY_MISSING` warns when a cruise still lands with no itinerary, narrowed so a
   genuinely itinerary-less cruise page isn't flagged.

Measured on the real capture, against the real stored spec: **0 days → 8 days**, and `debarkation`
recovered from `""` to `"Southampton, England"`.

Two bugs were caught during this work that the delivering agents' own tests had missed:
- **`debarkation` stayed blank** even after the ports were rescued, because it was derived from the
  visible-text port table *before* the fallback ran. Now derived from the resolved itinerary.
- **A third instance of the silent-source bug.** `normaliseFrom` lowercased its input and compared
  against the sources array — fine while every source was lowercase, but `"deepText"` would have been
  rewritten to `"text"`, exactly as `headings` was. Now a case-insensitive match returning the
  canonical spelling.

### 4.5 Picked rules merge, and carry provenance

`mergePickedIntoSpec` starts from the EXISTING spec and overwrites only the picked field keys.
Spec-level keys are preserved by spreading the existing spec first — deliberately not an allow-list,
so a key added later is preserved automatically rather than silently dropped by a list nobody updated.

Verified against the real Royal Caribbean spec: picking 2 fields on a 20-field spec left **18 rules
untouched and byte-identical**, and preserved `constants` (which supply `tour_operator` and
`currency`), `wait.textMatches` (which `CAPTURE_INCOMPLETE` depends on), `itineraryRegex` and
`imageUrlIncludes`. Saved wholesale, all of that would have been destroyed.

Every picked rule carries `origin: 'picked'`, `verifiedValue`, `strategy` and `pickedAt`. That
matters because a picked rule was **verified against ground truth a human confirmed**, while a
generated rule has only passed shape checks and has never been proven to produce a correct value.
The review dialog shows that asymmetry, and the overfitting heuristic exempts picked rules.

**Precedence, unchanged by any of this** — a picked rule occupies the same tier as a generated one
(they replace per-field, they don't stack): `jsonPath` → the rule's regex → the rule's `fallback` →
`constants` → the supplier-neutral conventions → hard defaults. A picked rule that stops matching
falls through the same safety nets as any other.

`POST /scrapers/picks` is open to any authenticated agent — gating it behind `requirePlatformAdmin`
would make the picker unusable by the people whose job it is. Protection sits in the service instead:
a non-admin's pick that would overwrite an **existing** rule in an **approved** spec is dropped and
reported as a problem, while a pick for a field the approved spec never covered still applies.
`specNeedsReview` is always true, and the pre-merge spec is archived before every write.

### 4.6 Validation reaches the agent

Import validation is now rendered. Following the "never block" decision: the deal always lands, but a
money field with an **error**-level issue is withheld rather than auto-filled, so the agent types the
number instead of trusting a wrong one. Warnings still populate. Verified: an error on `sales_price`
removes that key from the imported quote; a warning leaves it; no validation returns the quote
unchanged.

**A fourth guard against the recurring silent-strip bug**: `FieldRule` keys now have their own
round-trip test typed `Record<keyof FieldRule, unknown>`, so a future field-rule key missing from the
Zod schema fails to COMPILE. That class has already cost `headings`, `imageContainerIncludes`, and
nearly `deepText`.

### 4.1 Spec guards — complete

Rejects four constructs **at generation time**, each mapped to a shipped bug:

1. `group: 0` without a `map` — TUI's whole-sentence airport name
2. Proper-noun `fallback` — TUI's `"Prague"`
3. A `|` outside any group — Jet2's dead alternation
4. A literal run > 30 chars — Carnival's marketing-sentence anchor

Exposed as a pure, testable `findUnsafeRules(spec)` so it can later audit already-stored specs.
The four constraints were also added to the system prompt so the model is told up front.

`imageContainerIncludes` added to `specSchema` (it was being silently stripped), plus a round-trip
test typed as `Record<OptionalSpecKey, unknown>` so that **adding a new `ExtractionSpec` key without
adding it to `specSchema` fails to compile**. That drift class has now caused two production bugs;
it is guarded at the type level rather than by a hand-maintained list.

### 4.2 Uncommitted working tree

```
 M scripts/seed-data/supplier-scrapers.ts          (RC cabin_number fix)
 M server/v2/modules/scraper/extraction/extraction-ai.service.ts
 M server/v2/modules/scraper/extraction/extraction.interpreter.ts
 M server/v2/modules/scraper/extraction/extraction.interpreter.test.ts
 M server/v2/modules/scraper/extraction/spec-sources.test.ts
 M server/v2/modules/scraper/scraper.routes.ts
?? EXTRACTION_AUDIT.md
?? server/v2/modules/scraper/extraction/extraction.validate.ts
?? server/v2/modules/scraper/extraction/extraction.validate.test.ts
```

---

## 5. Not started

| Phase | Work | Blocked by |
| --- | --- | --- |
| Picker | **Endpoint to store a picker-derived spec**, and the review UI (extend `SupplierSpecReviewDialog`). The bookmarklet copies a payload and the deriver turns it into a verified spec — nothing yet carries one to the other. | — ready to build |
| Picker | Surface validation issues in the import dialog — the API now returns `validation`, the client ignores it | — ready to build |
| 1 (rest) | Currency columns + client mapping; suppress auto-fill of failed money fields | FX-source decision |
| 3 | Provenance columns (`source_url`, `spec_id`, `rule_id`, **raw matched substring**) and capture fixtures replayed in CI | — (provenance is the one item that is irrecoverable if deferred) |
| 4 | `scrape_run` table + per-field fill-rate drift alarms | Phase 3 |
| 5 | Multi-example spec induction | Phase 3 + second-capture decision |
| 6 | LLM as verifier (never extractor) | Phases 1–5 |

---

## 6. Known issues carried forward

- **`ncl` is in the database but not in the seed file** — it will vanish on a fresh environment.
  `celebritycruises`, `pocruises` and `msccruises` are also unseeded and unaudited; every cruise spec
  examined so far had at least one real bug, so assume these do too.
- **Royal Caribbean `tourist_tax_total` reads a per-guest amount** (£108) into a field named *total*
  (£216). A field rule captures one match and cannot sum; the page has no combined tax line.
- **`price_per_person` returns 0 on the RC GBP site** — its rule anchors on US disclaimer wording.
  Harmless (`sales_price` is correct) but the field is empty.
- **`country` on Royal Caribbean is `"GBR"`** — the booking *market* from the URL, not a country name
  and not the destination.
- **`tsc --noEmit` reports 99 pre-existing errors in the legacy v1 `server/` layer.** Unrelated to
  this work, but it means "typecheck is clean" was only ever true for the scraper paths that were
  being filtered for — the repo as a whole does not typecheck.
- **Parallel agents share one working tree.** One track observed the tree transiently reverting to
  HEAD mid-task, suspected to be a concurrent `git stash`/`checkout`. All edits were verified present
  afterwards and nothing was lost, but concurrent tracks should be kept to disjoint file sets and
  ideally sequenced in batches — a second track running `tsc`/tests while another is mid-edit reports
  the other's half-finished state as its own failure.

---

## 7. Things established that are worth not re-litigating

- **Structured data will not rescue cruise operators.** Measured live: Royal Caribbean emits
  `AggregateOffer` microdata ten times with `lowPrice` **empty** while rendering `$520`; Carnival,
  Celebrity, Princess and Cruise Nation publish no usable price; Cunard, P&O, MSC, TUI, easyJet and
  Iglu return **403** to any non-browser client. Google has no rich result for cruises, so operators
  have no incentive to publish it. Parse it opportunistically; DOM extraction stays the primary path.
- **Do not parse Next.js RSC payloads.** React 19's own notes say the underlying APIs do not follow
  semver; `?_rsc=` is a validated header hash returning 307 on mismatch, not a cache-buster. An HTML
  selector breaks when one site redesigns, visibly; an RSC parser breaks when *any* supplier upgrades
  Next.js, silently, across all of them at once.
- **Server-side headless discovery is not viable for these suppliers** — confirmed bot-blocked. The
  bookmarklet runs in the agent's real logged-in browser and is already past that wall.
- **Single-example spec induction is the core accuracy problem**, not just a robustness one:
  single-shot code synthesis measures ~29 F1 points *worse* than per-page extraction; only
  multi-candidate ensembling closes the gap. Every rule in the seed file today is single-example.
- **Schema-valid is not correct.** Constrained decoding drives validity to 100% while accuracy falls
  and wrong-but-well-formed output rises — so the validation gate must be **semantic** (cross-field
  arithmetic, ranges, page cross-checks), not a shape check.
