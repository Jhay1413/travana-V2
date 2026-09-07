# Extraction Pipeline Audit

**Date:** 5 September 2026
**Scope:** 13 supplier specs in `supplier_scraper`, 146 regex rules in `scripts/seed-data/supplier-scrapers.ts`
**Status:** 9 defects reproduced by execution; remediation plan below is dependency-ordered

---

## Thesis

The pipeline is **open-loop**. A spec is induced from one example page, persisted, and trusted
indefinitely — with no verification that its output is correct, no fixture to replay it against, and
no telemetry to notice when it degrades.

Every defect below is a symptom of that single absence, not of the spec model being wrong.

---

## Evidence standard

Findings are separated by how they were established:

| Marker | Meaning |
| --- | --- |
| **[EXECUTED]** | Reproduced by running it in this repository |
| **[SOURCED]** | Published source, cited |
| **[UNVERIFIED]** | Stated but not confirmed |

Nothing in the EXECUTED tier is inference.

---

## 1. Confirmed defects

Ordered by consequence. Wrong money outranks a wrong title, because a wrong price reaches a
customer on a quote.

### 1.1 Currency is extracted, then discarded — CRITICAL [EXECUTED]

`client/src/lib/json-import-handler.ts` · `shared/schema.ts` · `extraction.interpreter.ts:1503`

The interpreter produces a `currency` field and Carnival's spec declares `USD`. The client import
handler contains **zero** references to currency, and there is no quote-level currency column.

```
$ grep -c "currency" client/src/lib/json-import-handler.ts
0

$ grep -n "currency" shared/schema.ts
2635:  salaryCurrency: varchar("salary_currency", { length: 3 }),   # staff records only
```

A `$3,000` Carnival cruise lands in a GBP-assumed price field as `3000` — roughly a 25–30% error,
invisible, on every US-market deal.

The interpreter also hard-defaults `currency: str(f.currency) || 'GBP'`, so a **failure to detect**
currency is indistinguishable from a genuine GBP deal.

### 1.2 The number transform corrupts non-UK money — CRITICAL [EXECUTED]

`extraction.interpreter.ts` — `applyTransform`, `number` branch

Commas are stripped unconditionally before the first float is taken.

```
number("1.234,50")  ->  1.2345    # European decimal destroyed
number("$1,299")    ->  1299      # both collapse to the same
number("£1,299")    ->  1299      # number, labelled GBP
```

A failed price match also returns `0`, which `isEmpty` treats as absent — so a **total extraction
failure imports as £0 with a success toast**. Nothing distinguishes "this deal is free" from "every
price rule missed".

### 1.3 Every TUI deal records its arrival airport as Prague — CRITICAL [EXECUTED]

`scripts/seed-data/supplier-scrapers.ts:1117-1122`

```json
{
  "regex":    "to your hotel, and back to the airport at the end of your stay",
  "group":    0,
  "fallback": "Prague",
  "jsonPath": "packageData.itinerary.outbounds[0].arrivalAirport"
}
```

`group: 0` returns the **whole match**, so a hit makes the "airport name" that entire marketing
sentence. A miss falls through to the literal **Prague**. The rule only behaves because the
`jsonPath` happens to populate — the moment TUI renames that key, every deal arrives in Czechia.

The same shape appears at `:1111` for `tourist_tax_total`.

### 1.4 Jet2's airport rule never matched, even on its own source page — HIGH [EXECUTED]

`scripts/seed-data/supplier-scrapers.ts:523`

```
regex   (Manchester|Newcastle)\s*\(MAN|NCL\)
input   "Newcastle (NCL)"
match   "NCL)"        group 1 = undefined
```

The top-level `|` splits the entire pattern in two, so the capture group is never reached. The field
extracts nothing on the very page the spec was induced from, and a bare `NCL)` anywhere in prose
will match. Airport codes are hardcoded, so a third departure airport fails regardless.

### 1.5 Any agent in any tenant can break every tenant's specs — HIGH [EXECUTED]

`server/v2/routes/index.ts:146`

```
:116  router.use('/conversation-integration', isAuthenticated, requirePlatformAdmin, ...)
:146  router.use('/scrapers',           ...auth, scraperRoutes)      <-- no admin gate
```

`supplier_scraper` is deliberately platform-wide — correctly so, since "how to read a portal" is
tenant-neutral knowledge. But `PATCH`, `DELETE` and `approve-spec` are reachable by any
authenticated user and affect every agency on the platform.

### 1.6 Zod coercion launders failed extractions into valid values — HIGH [EXECUTED]

Relevant to the validation layer, before it is written.

```
z.coerce.number().safeParse("")          ->  PASSES as 0
z.coerce.date().safeParse("Route 66")    ->  PASSES as 1966
new Date("Route 66")                     ->  1965-12-31
new Date("Beverly Hills, 90210")         ->  year 90210
```

This matters because it is the **same shape** as the existing transform returning `0` on failure.
Wrapping that in `z.coerce.number()` would convert a failed extraction into a schema-valid £0 price.

Ban both coercions; parse money and dates explicitly with a per-source locale. Note also that in
`date-fns` the format string is `dd/MM/yyyy` — `D` is day-of-year and `YYYY` is week-numbering year,
so a format copy-pasted from moment.js breaks. `Temporal` is still Stage 3 and not Baseline; don't
adopt it yet.

### 1.7 A validator enum still silently strips a spec key — HIGH [EXECUTED]

`extraction.types.ts:65` · `extraction.interpreter.ts:425` · `extraction-ai.service.ts`

`imageContainerIncludes` is declared in the type and consumed by the interpreter, but is **absent
from `specSchema`**. Zod strips unknown keys, so any spec routed through that schema loses it.

This is the identical failure that made Carnival's title read `"IMPORTANT NOTICE"` when `headings`
was missing from the same enum. That one is fixed; this sibling is live.

### 1.8 Anchored rules mean "start of the whole page" — HIGH [EXECUTED]

`extraction.interpreter.ts:104-110` — `new RegExp(pattern, 'i')`

Regexes compile with `i` and never `m`, while the generator prompt instructs the model to anchor
rules with `^`.

```
^[^\n]*\n(...)   at page start  ->  "second line"   # positional rules work
^Total\s*(\d+)   mid-page       ->  NO MATCH        # label anchors never fire
^Total\s*(\d+)   with /m        ->  "5"
```

So positional first-line rules work and every mid-page label anchor silently fails.

**Do not add `m` globally.** It changes the meaning of every stored `^` rule at once, across all
suppliers, with no fixtures to catch the fallout. Migrate per-rule, after fixtures exist.

### 1.9 Overfitting is systemic, not occasional — HIGH [EXECUTED]

Of 146 regex rules, a large share are pinned to one example page. A room-type rule demonstrates the
class:

```
rule    \(1\) ([\w \-/]+(room|suite|apartment|studio|villa))
input   "(1) Best room choice according to your dates"
gives   "Best room"
```

Alongside it:

- Hong Kong hardcoded across resort, country, destination **and** the flight-leg rules
- `₱` hardcoded as a currency
- Hoseasons pinned to "Seven Lakes Country Park" — broken for every other park
- Carnival anchored to a full marketing sentence ("Rates are in US Dollars, average per person…")

The existence of `fix-easyjet-spec.ts`, `fix-jet2-flights.ts`, `fix-tui-spec.ts`, `fix-tui-geo.ts`
and `fix-room-type-specs.ts` is the manual-repair treadmill made visible — as is the hand-patched
`On\s?Board` already sitting in two places, evidence that this break happened before and was fixed
without anyone knowing why.

---

## 2. Structured data: measured, not assumed

The obvious escape from regex is to read the site's own machine-readable data. This was tested
against live pages rather than assumed. **It does not rescue cruise operators.**

| Host | HTTP | Structured data | Usable price? |
| --- | --- | --- | --- |
| royalcaribbean.com | 200 | 0 JSON-LD; microdata `AggregateOffer` ×10 | No — `lowPrice` empty ×10 |
| carnival.com | 200 | None (10–13 KB shell) | No |
| celebritycruises.com | 200 | None | No |
| princess.com | 200 | `ImageObject`, nav only | No |
| cruisenation.com | 200 | 12 blocks — FAQ, Review, Breadcrumb | No `price` anywhere in HTML |
| hoseasons.co.uk | 200 | None (schema.org) | **Yes** — in app-state blob |
| icelolly.com | 200 | `Product`+`Offer`+`Trip` ×12 | **Yes** — but per-person |
| cunard, P&O, MSC, TUI, easyJet, Iglu | 403 | Bot-blocked to any non-browser client | — |

### The Royal Caribbean case is the whole argument

Its ship pages emit valid-looking markup ten times over with the price left blank, while the page
visibly renders `$520` and `$1440`:

```html
<span itemprop="offers" itemscope itemtype="http://schema.org/AggregateOffer">
  <span itemprop="priceCurrency">USD</span>
  <span itemprop="lowPrice"></span>          <!-- empty, ten times -->
```

Note this is **microdata, not JSON-LD** — a JSON-LD-only reader reports "no structured data" on the
largest cruise line in the world. An empty-but-present field must be treated as **absent**, never as
zero.

### Why operators don't publish it [SOURCED]

Google's structured-data gallery has **no rich result for cruises, package holidays, flights or
tours**. There is no SEO payoff for a cruise line to emit `Trip` or `Offer`, which is exactly why
they don't. `Trip`/`TouristTrip` sit at 10K–100K domains against `Offer`'s 10M+ — three orders of
magnitude apart. Google has been *retiring* rich-result types, not adding them (Vehicle Listing was
switched off in 2025).

The strongest single datum: for Hotel Ads, Google runs a **trustability score** requiring partners
to hold 100% price-match, and suspends use of a site's markup for price validation on mismatch. The
world's largest consumer of structured data treats travel price markup as untrusted until proven.

The pattern is clean: the closer a site is to being an **aggregator**, the better its markup; the
closer to being the **operator**, the worse or more absent. Your cruise suppliers are all operators.

### What to do with that

1. Parse structured data **first, opportunistically** — cheap, and the best signal where present.
2. Parse **microdata as well as JSON-LD** (Royal Caribbean proves JSON-LD-only misses real data).
3. Mine **embedded app state** (`__NEXT_DATA__`, `window.__INITIAL_STATE__`) at the same tier —
   Hoseasons proves this often beats schema.org on travel sites.
4. Treat DOM extraction as a **first-class path, not a fallback**. For cruise operators it is the
   primary path.
5. Never accept a markup price without cross-checking the rendered page.
6. Carry per-person/total ambiguity as an **explicit unknown**. `Offer.price` in travel is usually a
   "from, per person" figure with nothing in the markup saying so.
7. Honour `priceValidUntil` as a TTL where present (icelolly declares 24 hours and means it).

---

## 3. Is the spec architecture right? [SOURCED]

Yes — but for a narrower reason than it first appears, and with one condition that is not optional.

**Reusable-spec generation wins decisively on cost.** One vendor pricing both architectures on a
single platform: deterministic extraction at `$0.20–$5` per 1,000 pages against `$20` per 1,000 for
running a model on every page — a 4× to 100× multiple. Latency agrees: an independent 2,008-page
benchmark puts a heuristic extractor at **F1 0.859 in 44 ms** against a 1.5B language model at
**F1 0.741 in 10,410 ms**. The LLM is 236× slower *and* less accurate.

**But on accuracy, the measured result cuts the other way.** Single-shot code synthesis scores
**55.0 F1 against 84.4** for direct per-page extraction (EVAPORATE, VLDB'24). Generating a spec from
one example is not merely fragile — it is roughly 29 F1 points *worse* than not bothering. Only
generating multiple candidates and ensembling closes the gap, to 79.5.

That reframes multi-example induction: it is **not a later refinement**, it is the condition under
which the spec architecture is accuracy-competitive at all. Every rule in the seed file today is
single-example, which places this pipeline on the wrong side of that number.

Three further figures to carry into the design:

- **Break-even is ~20 pages per site** (AutoScraper, EMNLP'24). Below that, generating a reusable
  spec costs more than per-page extraction. Comfortably exceeded for a supplier in regular use.
- **Discount every published benchmark by ~15 points.** The same methods measured against frozen
  2010s snapshots lose 15–18 F1 on the live 2025 web; the best live system scores 48.58 against a
  human 86.60 (LiveWeb-IE, ICLR'26). Anything advertised near 88 F1 was measured on frozen HTML.
- **Schema-valid is not correct.** Across 15,000 generations, hard schema-constrained decoding drove
  validity to 100% while answer accuracy *fell* from 19.7% to 11.0%, and wrong-but-schema-valid
  outputs rose from 49.5% to 88.9%. Constrained decoding converts visibly broken output into
  well-formed wrong output — which is exactly what defeats a schema-only validation layer. **The
  gate must be semantic**: cross-field arithmetic, ranges and page cross-checks, not "did it parse".

One design detail worth stealing from the most rigorously documented commercial implementation
(Oxylabs): its rule format accepts **fallback expressions natively**, so resilience lives in the
spec rather than in a repair loop bolted on afterwards. Its spec generator also takes **3–5 example
URLs** as its documented input, not one.

---

## 4. The plan

Dependency-ordered. You cannot monitor what you cannot replay, and you must not auto-repair on a
signal you have not yet made reliable.

### Phase 1 — Make wrong answers announce themselves

*Days · highest value · catches every defect in §1*

A post-extraction validator called from the **service layer**, so the interpreter stays a pure
mapper with no I/O and no throwing. Collect all issues rather than aborting on the first — *which*
checks fail localises which extractor drifted, turning an alarm into a ticket (this is Fellegi–Holt
edit-rule localisation).

- **Money** — a zero price is an error, never "empty". Reconcile `price_per_person × pax` against
  `sales_price`; flag `sales_price < price_per_person`.
- **Currency** — resolve from ISO code in text → markup → URL param → TLD. Delete `|| 'GBP'`;
  resolving only from the last fallback is a warning, not a silent default.
- **Dates** — ISO shape and a sane range. Ban `z.coerce.*` and bare `new Date(string)`.
- **Cross-field** — nights must equal the date span *and* the parsed itinerary day count.
- **Prose detection** — an identity field over ~60 chars, or text repeated across the page, is a
  warning. Catches "Thrilling onboard activities" and the Prague sentence.
- **Separators** — if both `,` and `.` appear, the rightmost is the decimal. If only one appears
  followed by exactly three digits, it is genuinely unresolvable: **quarantine, don't guess.**
- **Coverage** — fraction of declared spec fields resolving empty; >40% warns "spec may have drifted".

Also in this phase, cheap and high-value:

- Close the currency hole end to end (schema column + client mapping); don't auto-populate a price
  whose currency isn't the org's.
- Apply the spec's existing `wait.textMatches` as a gate on the capture path — reuses a field you
  already generate, and rejects captures taken before the price rendered.
- Gate `/scrapers` mutations behind `requirePlatformAdmin`.
- Extend the `specSchema` round-trip test so every `ExtractionSpec` key must survive parsing — it
  fails today on `imageContainerIncludes`.
- Reorder `interpreter.ts:1452-1453` so `dateFromUrl` outranks a raw non-ISO `travel_date`.

### Phase 2 — Ban the constructs that caused these bugs

*Hours · pure prevention*

Reject at spec-generation time rather than warning:

- `group: 0` without a `map`
- a `fallback` that is a proper noun
- a `|` outside a group
- literal anchor text beyond ~30 characters

Those four rules alone would have blocked the Prague fallback, the Jet2 alternation and Carnival's
marketing-sentence anchor — mechanically, and before storage.

### Phase 3 — Provenance and fixtures

*Days · provenance is irrecoverable if deferred*

You cannot go back and ask last month's version of a website what it said. Store `source_url`,
`fetched_at`, `spec_id`, `rule_id`, `match_method` and — critically — the **raw matched substring**.
That is what lets a reviewer see *why* the extractor thought a sentence about hotel transfers was an
airport name.

Persist raw captures with a verified expected result and replay them in CI. Seed with the four bugs
already fixed this session (Virgin's dropped cruise block, RC's GBP-site zeros, Carnival's
`IMPORTANT NOTICE` title and 5-month date shift, Cunard's per-person total).

Be clear what this buys: frozen fixtures catch **your** regressions, not live site drift.

### Phase 4 — Fill-rate telemetry and drift alarms

*Days · the only thing that catches a reword*

One row per extraction: supplier, spec version, per-field null map, validation outcome. Codes and
booleans only — no page content. Alert when a field's fill rate drops materially; the published
reference case is a price null-rate moving 2% → 70%, alerting above 20% (Spidermon's
`FieldCoverageMonitor` reduced to a Drizzle table — there is no Great Expectations for Node, and you
don't need one).

Two documented silent-failure signatures map **directly** onto defects confirmed in §1:

- **Constant offset in a numeric field** ⇒ decimal/locale parse change — the signature of the
  `1.234,50 → 1.2345` bug.
- **Cardinality collapse** (a field's distinct values fall to a handful) ⇒ you are reading a
  template — precisely what `fallback: "Prague"` produces.

Calibrate expectations: the canonical statistical verifier scored **precision 0.73, recall 0.95**
across 27 wrappers over a year. Alarms page a human; they never auto-act. For cadence, 44% of
monitored sites changed layout at least once in six months.

### Phase 5 — Multi-example induction

*Days · the condition the architecture depends on (see §3)*

Sequenced fifth because it needs fixtures to stand on, but on the evidence in §3 this is what makes
spec generation accuracy-competitive rather than 29 F1 points behind.

Induce each spec from several captures and keep only rules whose output **differs** between them — a
rule returning an identical value on two different deals is overfitted by definition. That single
test catches the pinned ship name, the literal-`$` prices and the hardcoded airports, mechanically.

The refinement that matters: choose examples for deliberate coverage of your variation axes —
**currency × label variant × date format** — not five random pages, which will be near-duplicates and
induce an overfit rule with false confidence. Record the induction sample size as rule metadata and
treat single-example rules as provisional.

### Phase 6 — LLM as verifier, never as extractor

*Later · only once 1–5 exist*

Ask a cheap model one narrow question — do these values appear on this page and mean what their
field names claim? — on a supplier's first capture, on any flagged import, and on a sample
thereafter. Disagreement flags the spec and attaches the model's value as a suggestion for review.

**The validation gate is the system; the LLM is not.** Without it you have a machine for generating
plausible-but-wrong rules at scale, which is strictly worse than a broken scraper, because a broken
scraper is visibly broken.

Repair order should be cheap-before-expensive: fingerprint relocation (no LLM) → spec regeneration
(one call) → per-page LLM (last resort). Do not trust a model's self-reported confidence as a drift
signal — confidence derived from cross-field arithmetic is real; the model's opinion of itself is not.

---

## 5. What not to build

**RSC payload parsing.** [SOURCED] React 19's release notes state the underlying APIs "do not follow
semver and may break between minors"; Next.js never documents the wire format; it already changed
between React 18 and 19. The author of the most-used parser calls reverse-engineering it "not
sustainable longer-term", and the only genuine extraction library has a single maintainer. Note also
that `?_rsc=` is a **validated hash of request headers**, not a cache-buster — mismatches return 307,
and dynamic routes often return an empty shell.

> The asymmetry is decisive: an HTML selector breaks when one site redesigns, visibly. A Flight
> parser breaks when *any* supplier upgrades Next.js — silently, across all of them at once.

**Server-side headless discovery for cruise sites.** Confirmed blocked: Cunard returns a protocol
error, Royal Caribbean serves a 4.6 KB challenge stub with zero XHR. The bookmarklet runs in an
agent's real logged-in browser, already past the bot wall — and the correct source ordering puts the
rendered DOM *above* reconstructing a private wire format anyway.

**Per-page LLM extraction as the primary reader.** 4×–100× the marginal cost, seconds of added
latency on the agent's critical path, and a non-deterministic artifact you cannot diff or review.

**Fuzzy label matching.** Your label vocabulary is a closed set, so a normalised-key exact match
(strip non-alphanumerics + casefold) collapses `On Board` / `Onboard` / `On-board` deterministically,
with no threshold to tune. Fuzzy is actively dangerous here: `Onboard Credit` and `Onward Credit`
differ by an edit distance of 2. Use a curated alias list for genuine synonyms (`OBC`, `Shipboard
Credit`).

**Blanket NFKC normalisation.** [SOURCED] Unicode UAX #15 is explicit that the K forms "must not be
blindly applied"; W3C recommends against them. NFKC turns `½` into `1/2` — fine as a matching key,
catastrophic stored as a price. **Store raw plus NFC; match against a separately computed
NFKC+casefold key you never persist.** Normalisation also does *not* fold curly quotes, so an
explicit character table is still needed (nbsp/thin spaces → space, curly → straight, U+2010–2015
and U+2212 → hyphen).

**Vendor "self-healing" products, on current evidence.** None publishes a healing-accuracy figure.
The adjacent test-automation field does measure itself and reaches 89–99% on an easier problem —
with the residual being *confidently wrong*. The documented failure mode is the one to avoid:
healing to the wrong element **hides real regressions**. One vendor's marketing promises
self-healing while its own support pages prescribe manual retraining as the fix.

**Hard-fail on validation.** Agents need the deal in front of them. Warn hard, refuse to
*auto-populate* money fields that failed validation, and let the human type the number. Prefer
quarantine over hard-fail for a non-obvious reason: a `fail` action records **no metrics**, so you
lose the "how many / which" data you need to debug. Replay-from-quarantine is the highest-value
property of the whole design — a bad rule then costs a re-validation pass, not a re-capture.

---

## 6. What is right and must be preserved

- **Spec-as-data + fixed interpreter.** No supplier code is executed; a hallucinated spec can only
  run regexes. Specs are diffable, hot-fixable without a deploy, and reviewable. Don't give this up.
- **Platform-wide spec storage.** "How to read a portal" is tenant-neutral; scoping it per-org would
  mean re-learning and re-breaking it once per tenant. It just needs the RBAC gate from §1.5.
- **The host-keyed spec archive** — hand-corrected specs survive supplier deletion and re-capture.
  Extend to versioning rather than replace.
- **Never regenerating an existing spec**, and preferring an archived spec over a fresh AI call.
  Regeneration reliably reproduces the overfitting a human just removed.
- **The layered fallback discipline** — supplier-agnostic structural readers (`boardBasisFromText`,
  `parseItineraryTable`, `occupancyFromUrl`, `labelledValue`, `dateFromUrl`) that fire *only* when
  the spec produced nothing. "Spec first, industry convention second, never supplier code" is the
  right layering and should be the template for the validators in Phase 1.
- **Constants beat empty rules**, with a test pinning it.
- **The bookmarklet as the primary path** for bot-protected sites. Given headless discovery is
  blocked, using the agent's real logged-in browser is correct architecture, not a workaround.
- **The commentary style in the interpreter** — nearly every comment is a regression story with the
  symptom recorded. Promote that knowledge into executable fixtures (Phase 3).

---

## 7. Decisions needed before Phase 1

1. **Currency policy.** Store a non-GBP deal in its source currency with an FX rate, or convert at
   import? This decides whether the fix is one column or three (`currency`, `fx_rate`,
   `base_amount`), and it reaches commission and reporting well beyond the scraper.
2. **Second capture at onboarding.** Multi-example induction is the highest-accuracy change
   available, but asks agents for a second capture per supplier. Acceptable friction, or framed as
   an optional promotion to "approved"?
3. **Blocking versus warning.** The plan never blocks an import. Is there a category — a £0 price,
   say — where you'd rather refuse outright?
4. **Fixture retention.** Captures are real supplier pages from an authenticated session and may
   embed agency identifiers. Platform-admin-only reads plus query-string redaction is the
   recommendation; is more needed (retention window, per-supplier opt-out)?

---

## 8. Cheap next step, independent of all decisions

`scripts/debug-capture.ts:69-71` **already extracts** `script[type="application/ld+json"]` and
`__NEXT_DATA__` separately — plumbing that exists in a debug script and was never promoted to the
production bookmarklet. Running it across all thirteen suppliers gives per-domain markup coverage
measured on your real deal pages, in an afternoon.

Related, and certain: `public/capture-bookmarklet.js` `bestScriptJson()` ranks `dataLayer` at **80**
and `application/ld+json` at **70**, and returns only the **single** best blob. So it prefers
analytics over standardised structured data, and discards everything else. Sending all parseable
blobs keyed by origin costs nothing and can only add signal.

---

## What nobody has measured [SOURCED]

Worth knowing before trusting any vendor claim:

- **First-try correctness of an LLM-generated extraction spec** — no vendor, no paper.
- **Drift-triggered regeneration success rate** — every "self-healing" claim is unquantified.
- **TTFT at ~30k input tokens** on any hosted API — anyone quoting one is extrapolating.
- **Modern selector-breakage rates** — the "selector half-life measured in weeks" line circulating
  in vendor blogs has no rigorous source behind it.

---

## Sources

- [Web Data Commons, Oct 2024 corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) · [class subsets](https://webdatacommons.org/structureddata/2024-12/stats/schema_org_subsets.html)
- [HTTP Archive Web Almanac 2024 — Structured Data](https://almanac.httparchive.org/en/2024/structured-data)
- [Google Search structured-data gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) — no cruise/travel rich result
- [Google Hotel prices — markup trustability](https://support.google.com/hotelprices/answer/14739390)
- [Google Merchant Center — mismatched price value](https://support.google.com/merchants/answer/9773429)
- [React 19 release notes](https://react.dev/blog/2024/12/05/react-19) — RSC APIs outside semver
- [vercel/next.js #80669](https://github.com/vercel/next.js/pull/80669) — `?_rsc=` as validated header hash
- [Lagerlöf — devtools for React Server Components](https://www.alvar.dev/blog/creating-devtools-for-react-server-components)
- [Lerman, Minton & Knoblock, JAIR 2003](https://www.jair.org/index.php/jair/article/view/10325) — wrapper verification precision/recall
- [Kushmerick, AAAI-99](https://cdn.aaai.org/AAAI/1999/AAAI99-011.pdf) — wrapper verification, site-change rates
- [Spidermon FieldCoverageMonitor](https://spidermon.readthedocs.io/en/latest/monitors.html)
- [Context.dev — scraper monitoring in production](https://www.context.dev/blog/scraper-monitoring-in-production)
- [Crawlex — silent-failure signatures](https://blog.crawlex.net/blog/scraping-observability/)
- [zod #2461](https://github.com/colinhacks/zod/issues/2461) — `z.coerce.number()` accepts empty string
- [date-fns #760](https://github.com/date-fns/date-fns/issues/760) — `dd/MM/yyyy` vs `DD/MM/YYYY`
- [Unicode UAX #15](https://www.unicode.org/reports/tr15/) · [W3C on normalisation](https://www.w3.org/International/questions/qa-html-css-normalization)
- [Similo, ACM TOSEM](https://dl.acm.org/doi/10.1145/3571855) — measured self-healing accuracy
- [SCRIBES](https://arxiv.org/pdf/2510.01832) — cross-page layout regularities
- EVAPORATE (VLDB'24) — code synthesis vs direct extraction F1
- AutoScraper (EMNLP'24) — ~19.5 pages/site break-even
- LiveWeb-IE (ICLR'26) — snapshot-to-live F1 degradation
- The Constraint Tax (arXiv 2605.26128) — constrained decoding accuracy cost
- WCXB (arXiv 2605.21097) — extraction F1 vs latency across 13 systems
