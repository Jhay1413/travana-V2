# Frozen page after closing a create drawer / dead search dropdowns

> Two symptoms, one underlying Radix defect: `@radix-ui/react-dismissable-layer`'s
> layer bookkeeping racing on slow environments (Replit; not reproducible on a fast
> local machine). Section 1–5 & 7 cover the page-freeze-on-close symptom and why
> `FormDrawer` clears `document.body.style.pointerEvents` on close. Section 6 covers a
> second symptom — a `SearchableSelect`/`MultiSearchableSelect` dropdown that opens but
> doesn't respond to typing or clicks — and why it needed a different fix. **Section 8
> records that the §4 mitigation was reported as still failing** — both on plain
> open/close and after a successful create — and what replaced it: a page-wide
> `MutationObserver` + interval watchdog instead of a single 400ms one-shot check.
> Relevant files: `client/src/components/shared/form-drawer/form-drawer.tsx`,
> `client/src/components/ui/searchable-select.tsx`,
> `client/src/components/ui/multi-searchable-select.tsx`.

---

## 1. Symptom

On the client details page (`/clients/:clientId`), opening the **create** drawer for an
enquiry, quote or booking and closing it *without saving* left the entire page
unclickable. Everything still rendered and the drawer visibly closed, but no click
registered anywhere on the page. A browser refresh cleared it.

The page was not crashed or hung — React kept rendering, and the app responded to
keyboard focus. Only pointer input was dead.

---

## 2. Where it did and didn't happen

These boundaries were what identified the cause, so they're worth keeping on record.

| Surface | Froze? | Notes |
|---|---|---|
| Client details page — enquiry / quote / booking create drawers | **Yes** | All three |
| Social posts board — "Create Social Post" | No | Same `QuoteCreateDialog`, also `presentation="drawer"` |
| Replit dev server | **Yes** | Consistently |
| Replit deployment | **Yes** | Consistently |
| Developer's own machine | No | Never reproduced |

Two conclusions follow directly:

- **It is not the drawer component itself.** The social posts board renders the *same*
  `QuoteCreateDialog` with the *same* `presentation="drawer"` and never froze.
- **It is not a production-build problem.** Replit's dev server reproduced it too, so
  bundling and minification are ruled out. Dependency drift is also ruled out:
  `package-lock.json` is committed and pins `@radix-ui/react-dialog@1.1.15` and
  `@radix-ui/react-dismissable-layer@1.1.11`.

What is left is **timing** and **how many dialog roots are mounted**.

---

## 3. Root cause

Radix's `DismissableLayer` sets `document.body.style.pointerEvents = "none"` while a
modal layer is open, and on teardown restores the value it observed *before* it made
that change.

The drawers are full of nested Radix layers — `Select`, comboboxes, date pickers. Each
opens its **own** dismissable layer stacked under the drawer's. When an inner layer
mounts while the drawer has already set the body to `"none"`, the inner layer records
`"none"` as the value to restore. If the drawer then closes while that unwinding is
still in flight, the inner layer "restores" `pointer-events: none` instead of the
original empty string.

Nothing subsequently clears it, so the body stays unclickable until a reload.

### Why only on Replit

It is a race against the drawer's close animation. `SheetContent` carries
`data-[state=closed]:duration-300`, so the element lingers ~300ms after `open` flips to
`false`. On a fast machine the teardown ordering reliably comes out right; on a slower
box it does not. Same code, same versions — different timing. That is also why the
Replit *dev server* and the *deployment* both showed it while the developer's machine
never did.

### Why only the client details page

`client/src/pages/client/index.tsx` mounts **nine** Radix dialog roots simultaneously —
quote, booking, task, ticket, upload-file, client edit, enquiry wizard, merge, and
expiry — versus one on the social posts board. More mounted layers, more opportunities
to lose the race.

---

## 4. The fix

A guarded cleanup lives in `FormDrawer`, the single shell all three affected drawers
render through.

```ts
const POINTER_EVENTS_CHECK_DELAY_MS = 400; // close animation is 300ms; margin on top

function hasOpenRadixLayer(): boolean { /* see source */ }

function clearStuckPointerEventsIfOrphaned(): void {
  if (document.body.style.pointerEvents !== "none") return;
  if (hasOpenRadixLayer()) return;
  document.body.style.removeProperty("pointer-events");
}
```

The effect is **armed only while the drawer is open**, so its teardown fires on exactly
the two cases that matter, and schedules the check on both:

1. `open` flipping `true → false` — the ordinary close.
2. **Unmount while still open** — e.g. `BookingCreateDialog`'s
   `onSuccess={(bookingId) => navigate(...)}` navigates away, unmounting the client page
   and all nine drawers with it, possibly mid-close. Nothing else survives to clean up,
   so this path matters most.

The timer is deliberately **fire-and-forget and is not cancelled on unmount**. Cancelling
it would kill case 2 — and there is nothing to cancel it for: the callback touches only
`document.body`, which stays valid long after the component is gone.

### The guards

It only acts when the style is genuinely orphaned:

- `document.body.style.pointerEvents === "none"`, **and**
- no `[role="dialog"][data-state="open"]` (another open Dialog/Sheet) and no
  `[data-radix-popper-content-wrapper]` (an open Select/Popover/date picker) in the DOM.

Both conditions are re-evaluated **when the timer fires**, not when it is scheduled. So
if a second drawer opens inside the 400ms window, the check sees that drawer's open
layer and does nothing — it cannot clear a style another modal legitimately owns.

Whenever Radix cleans up correctly — the common case, and every case on a fast machine —
the whole thing is a no-op.

---

## 5. What this deliberately does not do

- **It does not fix the root cause**, which is inside Radix's layer bookkeeping. It
  clears the residue afterwards.
- **It does not touch `components/ui/sheet.tsx` or `dialog.tsx`.** Those are shared
  shadcn primitives used across the app; changing them has far wider blast radius than
  this bug justifies. Other `Sheet`/`Dialog` users are therefore *not* covered — if the
  freeze shows up on a modal that does not go through `FormDrawer`, the fix needs to be
  lifted to the primitive rather than copy-pasted.
- **It was never verified at runtime.** The bug does not reproduce on the machine where
  the fix was written. Correctness rests on reasoning about the mechanism, not on an
  observed before/after.

---

## 6. Second symptom: dropdown opens but is dead (search boxes)

> Not the same race as sections 1–5. This one is a focus/scroll ownership conflict
> between a portaled `Popover` and the `Dialog` it renders inside — and unlike sections
> 1–5, this one is **confirmed fixed at runtime**, not just reasoned about. Relevant
> files: `client/src/components/ui/searchable-select.tsx`,
> `client/src/components/ui/multi-searchable-select.tsx`,
> `client/src/hooks/use-fixed-dropdown-position.ts`,
> `client/src/hooks/use-close-on-outside-or-escape.ts`.

### Symptom

Inside a `FormDrawer` (the enquiry/quote/booking drawers), a `SearchableSelect` or
`MultiSearchableSelect` dropdown opens and renders normally, but you cannot click into
its search box (so typing does nothing) and its list would not scroll. Outside these
drawer forms, the same components worked fine.

### Attempt 1 — forcing `pointer-events: auto` (disproved)

The first hypothesis was that this was the same class of bug as sections 1–5:
`@radix-ui/react-dismissable-layer` computes each layer's own `pointer-events`
synchronously at render time and applies it as an inline style, and it was suspected
that a registration race could cause the popover to paint with `pointer-events: none`
baked in. The fix under that theory was to force `style={{ pointerEvents: "auto" }}`
onto both `PopoverContent`s.

**The user tested this on Replit — the actual environment where the bug reproduces —
and it did not fix the dropdown.** That disproves the theory. Reading
`react-dismissable-layer`'s source afterwards confirms it was never mechanistically
possible: a layer's `pointer-events` only computes to `"none"` when it sits *below* the
highest layer that has `disableOutsidePointerEvents: true`. The non-modal `Popover`
these components used at the time never set `disableOutsidePointerEvents`, and it
always mounted *after* (i.e. on top of, index-wise) the drawer's own `Dialog` layer —
so it was always the topmost layer and always resolved to `pointer-events: auto` on its
own, with or without the forced `style`. The dropdown was never actually receiving
`pointer-events: none`; something else was swallowing the input. This is recorded here
so nobody retries the same theory.

### Attempt 2 — Radix `modal` on the `Popover` root (partial fix, superseded)

`node_modules/@radix-ui/react-popover/dist/index.js` implements `PopoverContent` as one
of two variants, chosen by the `Popover` root's `modal` prop:

- `PopoverContentNonModal` — the default (`modal` defaults to `false`) — passes
  `trapFocus: false` and `disableOutsidePointerEvents: false` to its
  `DismissableLayer`/`FocusScope`, and does not wrap its content in `RemoveScroll`.
- `PopoverContentModal` — used when the `Popover` root has `modal` — wraps its content
  in `RemoveScroll` (`as: Slot, allowPinchZoom: true`), passes `trapFocus: context.open`
  and `disableOutsidePointerEvents: true`, and calls `hideOthers(content)`.

`SearchableSelect` and `MultiSearchableSelect` both used the default, non-modal
`Popover`, and `PopoverContent` is portaled to `document.body` — i.e. it renders
*outside* the drawer's own DOM subtree. The drawer itself is a Radix `Dialog`
(`SheetContent`) with its own `FocusScope` (`trapFocus`) and its own
`react-remove-scroll`, both scoped to the Dialog's content node. For a portaled,
non-modal popover mounted while that Dialog is open, the Dialog's `RemoveScroll` blocks
wheel/touch scroll events that originate outside its own node — so the popover's list,
mounted elsewhere in the DOM via the portal, couldn't be scrolled.

Setting `modal={true}` on the `Popover` root was tried next. It gives the popover its
own `RemoveScroll` (scoped to itself, with `allowPinchZoom`), and this part worked —
**the list scrolled**. But the search input still could not be focused: the Dialog's
`FocusScope` kept pulling focus back inside *its own* node regardless of the popover's
`modal` setting, so `PopoverContentModal`'s own `trapFocus` never got to hold focus
inside the popover in the first place. `modal` fixed scrolling; it did not fix the
reported symptom (a dead search box). This is why it's recorded here as a dead end
rather than as the resolution.

### Attempt 3 — disabling `@replit/vite-plugin-cartographer` (exonerated)

A secondary hypothesis was that cartographer's element-picker click interception (only
active in Replit dev, gated on `REPL_ID`) was intercepting clicks into the popover
before they reached the search input. `vite.config.ts` was changed to temporarily
disable `cartographer()` while leaving `devBanner()` on, and the user re-tested on
Replit dev. **The dropdown was still dead with cartographer disabled** — this
exonerated the plugin. `cartographer()` has since been restored in `vite.config.ts`.

### Root cause

Radix `Popover` (`PopoverContent`) portals its content to `document.body`, **outside**
the Dialog's own DOM subtree, regardless of `modal`. The Dialog's `FocusScope` and
`react-remove-scroll` are scoped to the Dialog's content node and have no reason to
cooperate with a sibling-of-`document.body` tree they don't know about — they fight the
portaled popover for focus and scroll ownership. `modal` (attempt 2) changes what the
*popover itself* does, but does nothing about the Dialog still claiming focus for its
own subtree; it could never fully resolve a conflict rooted in the portal.

### The resolution

Both `SearchableSelect` and `MultiSearchableSelect` were rewritten from scratch without
Radix `Popover` or cmdk (`Command`/`CommandInput`/etc.):

- The dropdown is rendered as a plain sibling of the trigger in the component's own
  JSX — **not** portaled to `document.body`. Since it never leaves the component's own
  subtree, it's naturally inside the Dialog's focus scope, so there's nothing left to
  fight for focus.
- Because it's no longer portaled, it would otherwise be clipped by the drawer's
  scrolling container (`overflow-y: auto`). It's positioned with `position: fixed`,
  with coordinates computed from the trigger's `getBoundingClientRect()`
  (`useFixedDropdownPosition`), which escapes that clipping the same way a portal would
  have, without leaving the component's own DOM subtree.
- Scroll/resize listeners recompute that position while open, registered with
  `capture: true` — the drawer's own container scrolls, not the window, so a
  non-capturing/`window`-only listener would miss it and the dropdown would drift out of
  place.
- Outside-click and Escape dismissal (`useCloseOnOutsideOrEscape`) and keyboard
  navigation are implemented directly in each component instead of relying on Radix's
  `DismissableLayer`, since that mechanism no longer applies once the popover isn't a
  Radix `Popover`.

Both components now share the position and dismiss logic via
`client/src/hooks/use-fixed-dropdown-position.ts` and
`client/src/hooks/use-close-on-outside-or-escape.ts`.

### Verifying this one

**Confirmed working on the Replit dev server by the user** — unlike the page-freeze fix
in sections 1–5 (and §7), which remains unverified at runtime, this fix has actually
been exercised in the environment where the bug reproduced: the search input can be
focused and typed into, and the list scrolls, inside the enquiry/quote/booking drawers.

### Implication for future work

Any other Radix portaled overlay used inside these drawers — `Select`, date pickers
(`client/src/components/ui/date-picker.tsx`, which still uses a Radix `Popover` with
`modal`), or other `Popover` usages — is exposed to the same defect (a Dialog fighting a
portaled child for focus/scroll) and **has not been audited**. Attempt 2 above shows
`modal` is not a full fix even where it partially helps; if one of these turns up dead
inside a drawer, the fix is the same in kind as this section's, not `modal`.

---

## 7. If the freeze comes back

Reproduce on Replit — open each of the three drawers from the client details page,
interact with a dropdown or date picker inside, then close without saving via the X, via
Esc, and via an overlay click. Also create a booking, which exercises the
navigate-away-mid-close path.

While the page is frozen, read in the console:

```js
document.body.style.pointerEvents                    // "none" => still the body-style cause
document.querySelectorAll('[role="dialog"]')         // orphaned dialog nodes?
document.querySelectorAll('[data-radix-popper-content-wrapper]')
```

- **`"none"`** → the guard is not firing. Check whether an orphaned open layer is
  tricking `hasOpenRadixLayer()` into bailing out, or whether 400ms is too short on that
  hardware.
- **Empty string** → the mechanism is *not* the body style. Most likely an orphaned
  overlay node left in the DOM absorbing clicks. This workaround will never help with
  that, and the investigation should start from the leftover element instead.

A Radix upgrade is the proper long-term fix. When one lands, re-test on a slow
environment and delete this workaround if the race is gone.

---

## 8. §4 mitigation reported as still failing — stale popper wrapper + one-shot design

### The report

After §4 shipped, the user reported the freeze **still happening on Replit**, on both
of the original triggers: opening a create drawer and closing it without saving, *and*
a new one — the page freezing after a **successful** enquiry create. Symptom
unchanged: everything renders, nothing is clickable, only a reload clears it. The §4
mitigation had never been runtime-verified (§5 said so explicitly), so this was the
first real evidence about whether it worked, and it said no.

### Investigating the leading suspicion: was `hasOpenRadixLayer` always bailing out?

Yes — reading Radix's source (pinned versions, from `node_modules`) confirms it
mechanistically. `hasOpenRadixLayer`'s second condition was:

```ts
document.querySelector("[data-radix-popper-content-wrapper]") !== null
```

`[data-radix-popper-content-wrapper]` is the wrapper `<div>` that
`@radix-ui/react-popper`'s `PopperContent` renders (`node_modules/@radix-ui/react-popper/dist/index.js`).
It carries no `data-state` attribute of its own — ever. The actual open/closed state
(`getState(context.open)`) is set as a prop on the *content* element nested inside it,
confirmed in `@radix-ui/react-popover`, `@radix-ui/react-select`, and
`@radix-ui/react-tooltip`'s `dist/index.js`, all of which follow the same pattern:
render `<Presence present={forceMount || context.open}>` around a
`PopperPrimitive.Content` that receives `"data-state": getState(context.open)`.

Two consequences follow:

1. **Radix's `Popover` (used by `client/src/components/ui/date-picker.tsx`, via
   `client/src/components/ui/popover.tsx`) keeps its `[data-radix-popper-content-wrapper]`
   mounted for the entire close animation.** `Presence`'s `present` prop stays true
   until the exit animation's `animationend` fires, and `PopoverContent`'s base
   classes (`data-[state=closed]:animate-out …`) mean that animation is real, not
   instant. Any drawer field using a date picker — and the enquiry/quote/booking
   drawers all have several ("Outbound"/"Inbound" per §3) — leaves this wrapper in the
   DOM well past the moment the picker visually looks closed, with **only its inner
   content** carrying `data-state="closed"`. The wrapper element itself gives no signal.
2. Radix `Select` (`@radix-ui/react-select`) turned out *not* to have this specific
   problem — reading its source shows `SelectContent` swaps to an off-DOM
   `DocumentFragment` **synchronously** the instant `context.open` goes false; it does
   not use `Presence` for exit animation, so its popper wrapper disappears immediately
   on close, not gradually. The wrapper-presence bug is real, but it is a `Popover`
   (and by the same pattern, `Tooltip`/`DropdownMenu`) problem specifically, not a
   `Select` one — worth recording since it narrows where the residue actually comes
   from.

So the theory held, but sharper than originally framed: it's not that *any* stale
wrapper anywhere in the session blocks the guard forever (that would require a Radix
`Presence`/teardown bug leaving the node orphaned indefinitely, which is plausible on a
slow/throttled tab but unproven); it's that **the guard's single 400ms check routinely
lands while a legitimately-closing `Popover` is still mid-animation**, and the guard
had no way to tell "closing" from "open" because it only checked for the wrapper's
existence.

### What is actually left behind

Two things, and they matter differently:

- `document.body.style.pointerEvents === "none"` — confirmed as the mechanism per §3;
  nothing in this investigation contradicts it, and §7's own diagnostic snippet (read
  `document.body.style.pointerEvents` while frozen) was not re-run here per this task's
  instructions not to attempt reproduction. **Not independently re-verified this
  round** — see "What remains unproven" below.
- A `[data-radix-popper-content-wrapper]` node whose *content* is `data-state="closed"`
  — a legitimately-closing (or, on Replit, possibly stuck) `Popover`. This is what was
  making the guard bail; it is not itself the thing blocking clicks (it's a small,
  positioned element, not full-page), the body style is.

### What changed and why it's more robust

Two independent fixes, both in `client/src/components/shared/form-drawer/form-drawer.tsx`:

1. **`hasOpenRadixLayer` now requires an actual open state, not just presence.** For
   the popper-wrapper check, it now does
   `poppers[i].querySelector('[data-state="open"]') !== null` for each
   `[data-radix-popper-content-wrapper]` on the page, instead of treating the wrapper's
   existence as proof of an open layer. A `Popover`/date picker mid-close (content
   `data-state="closed"`) no longer blocks the cleanup; a genuinely open one
   (`data-state="open"`) still does. The dialog half of the check was already correct
   in this respect (`[role="dialog"][data-state="open"]`) — this brings the popper half
   in line with it, which is exactly what the task asked to verify.
2. **Replaced the single 400ms `setTimeout` with a page-wide, self-correcting watchdog**
   (`startPointerEventsWatchdog`, `pollUntilPointerEventsSettle`): a `MutationObserver`
   watches `document.body`'s `style` attribute and starts polling
   (`setInterval`, 200ms) the instant `pointer-events` becomes `"none"`; each tick
   re-checks `hasOpenRadixLayer()` and either clears the style and stops, or leaves it
   and tries again next tick. It never "gives up" after one look. This is strictly more
   robust than the one-shot check for reasons the task specifically flagged:
   - It no longer depends on a single drawer's `open`/close/unmount lifecycle at all —
     it is started once (idempotently) from every `FormDrawer` mount and reacts to the
     *actual* DOM mutation Radix makes, so the create-and-navigate-away path (§4's
     point 2, `BookingCreateDialog`'s `onSuccess` navigating away mid-close) is covered
     the same way as an ordinary close, with no special-casing needed.
   - If, at one poll tick, a sibling dialog on `client/src/pages/client/index.tsx`'s
     nine mounted roots happens to be genuinely open, the very next tick (200ms later)
     re-evaluates instead of the page staying stuck for the rest of the session — this
     directly addresses the "single one-shot check may be the design flaw" concern.
   - It starts polling immediately when `pointer-events` becomes `"none"` — which
     Radix sets for a modal's *entire* open duration, not just while closing — so in
     the common case (an open dialog with an open nested layer) it polls a few times
     as a no-op and stops the moment nothing legitimate owns the style anymore, rather
     than waiting a fixed margin past an assumed close-animation duration.

### What this does not change

- `hasOpenRadixLayer`'s dialog check (`[role="dialog"][data-state="open"]`) was
  already correct and is untouched.
- The underlying Radix defect (§3) is still not fixed — this remains a residue-cleanup
  workaround, not a fix to `DismissableLayer` itself.
- `SearchableSelect`/`MultiSearchableSelect` no longer use Radix `Popover` at all
  (§6), so they were never part of this wrapper-presence problem; the audit note at
  the end of §6 (`Select`, date pickers, other `Popover` usages "have not been
  audited") is now partially answered for `Select` (confirmed not affected, per above)
  and confirmed *is* the mechanism for `Popover`/date pickers.

### What remains unproven

- **Not reproduced or verified at runtime.** Per this task's explicit instruction, no
  attempt was made to reproduce on Replit or locally. Whether the freeze actually stops
  is deferred to the user testing on Replit — exactly the environment where this bug
  and the prior mitigation attempt both showed different results than local reasoning
  predicted.
- Whether `document.body.style.pointerEvents === "none"` is *still* the correct
  mechanism for the after-create freeze specifically (as opposed to some other residue,
  e.g. a `react-remove-scroll` lock or `aria-hidden` left on the page root) was not
  re-checked against a live repro this round — §7's own diagnostic (read
  `document.body.style.pointerEvents` while frozen) is the way to confirm this if the
  freeze is reported again after this change.
- Whether a genuinely-orphaned (not just mid-animation) `[data-radix-popper-content-wrapper]`
  ever occurs in practice — i.e. one whose content never reaches `data-state="closed"`
  at all due to a stuck `Presence` teardown — was reasoned about as plausible on a slow
  tab but not confirmed. The new guard does not depend on this either way: it only
  ever needs the *open* state to be absent to proceed, so a wrapper stuck at
  `data-state="closed"` forever is handled identically to one that closed cleanly.
