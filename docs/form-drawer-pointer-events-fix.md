# Frozen page after closing a create drawer / dead search dropdowns

> Two symptoms, one underlying Radix defect: `@radix-ui/react-dismissable-layer`'s
> layer bookkeeping racing on slow environments (Replit; not reproducible on a fast
> local machine). Section 1–5 & 7 cover the page-freeze-on-close symptom and why
> `FormDrawer` clears `document.body.style.pointerEvents` on close. Section 6 covers a
> second symptom — a `SearchableSelect`/`MultiSearchableSelect` dropdown that opens but
> doesn't respond to typing or clicks — and why it needed a different fix.
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

> Same underlying Radix race as above, different visible outcome. Relevant files:
> `client/src/components/ui/searchable-select.tsx`,
> `client/src/components/ui/multi-searchable-select.tsx`.

### Symptom

Inside a `FormDrawer` (the enquiry/quote/booking drawers), a `SearchableSelect` or
`MultiSearchableSelect` dropdown opens and renders normally, but typing in it and
clicking its items does nothing — no filtering, no selection. Replit-only; not
reproducible on a fast local machine. The dropdown is not closed or missing, it is
simply inert.

### Root cause

Sections 1–3 above cover the **body-level** pointer-events lock, which is effect-based
(set/restored in a `useEffect`, keyed off a module-level `originalBodyPointerEvents`).
That is not what's at play here.

Separately, `@radix-ui/react-dismissable-layer` also computes **each layer's own**
`pointer-events` — including the `Popover`'s — synchronously at **render** time, and
applies it as an inline style:

```js
// node_modules/@radix-ui/react-dismissable-layer/dist/index.js
style: {
  pointerEvents: isBodyPointerEventsDisabled ? (isPointerEventsEnabled ? "auto" : "none") : void 0,
  ...props.style
}
```

`isPointerEventsEnabled` depends on the popover's index in a layer-set that lives in a
shared context (`DismissableLayerContext`, a single module-level object). When the
popover mounts, it isn't in that set yet; it only gets added inside a `useEffect`, which
then calls `dispatchUpdate()` — a `document`-level `"dismissableLayer.update"` custom
event every mounted layer listens for and re-renders on. So there's a real gap between
"popover paints" and "popover's layer is registered and its own render reflects that."
On a fast machine that gap closes within the same tick/frame, invisibly. On a slow one
(Replit), if the popover's DOM paints before the registration + re-render round-trip
lands, it paints with `pointer-events: none` baked into its `style` attribute —
looks completely normal, swallows every pointer and (because pointer-events also gates
whether the element can be focused by click) keyboard interaction inside it.

**A CSS class cannot fix this.** Because the value is applied as an inline `style`, not
a class, any `pointer-events-auto` utility class loses to it on specificity — it would
be a silent no-op in exactly the case that matters.

### The fix

Both `SearchableSelect` and `MultiSearchableSelect` pass their `PopoverContent` an
explicit `style={{ pointerEvents: "auto" }}`. This works — beating Radix's own inline
value — because of how `PopoverContent` is assembled: `FocusScope` and `DismissableLayer`
both wrap their child via `asChild`, which Radix implements with
`@radix-ui/react-slot`'s `mergeProps(slotProps, childProps)`. For a `style` key, that
merge is `{ ...slotPropValue, ...childPropValue }` — the **child's** value is spread
last and wins. Our `style` prop flows down through `popover.tsx`'s `{...props}` spread
into `contentProps` on the innermost `PopperPrimitive.Content`, which is the "child" in
every `asChild` merge in this chain — so it overrides whatever `DismissableLayer`
computed for itself, regardless of which way the registration race went.

This is deliberately **not** a `!important` override: it forces `auto` unconditionally,
which would be wrong if this popover could ever legitimately be non-interactive because
a *different*, actually-topmost modal was stacked on top of it while this one was still
mounted. Both components avoid that: `SearchableSelect` closes itself (`setOpen(false)`)
before invoking `onAddNew`, and `MultiSearchableSelect`'s "Add new" button was fixed to
do the same (previously it left the popover mounted while opening the nested "Add"
dialog on top — the one gap where forcing `auto` here could have let clicks leak through
to a popover that should have been covered). With both components always closing before
anything else can open on top of them, this popover is the top layer for its entire
mounted lifetime, so forcing it interactive is safe rather than a stacking hazard.

Scoped to these two components only — `components/ui/popover.tsx`, `dialog.tsx`, and
`sheet.tsx` are untouched, so every other popover/dialog/sheet in the app keeps Radix's
default (race-prone-only-in-the-body-lock-sense, otherwise correct) behavior.

### Verifying this one

Like the freeze bug, this was fixed by reasoning about the mechanism, not by reproducing
it — it didn't reproduce locally either. If it resurfaces on Replit, check in the
console right after the dropdown fails to respond:

```js
document.querySelector('[cmdk-input-wrapper] input')?.parentElement?.closest('[role="dialog"]')?.style.pointerEvents
```

- **`""` (empty)** → our forced `style` is in effect; the input itself, or something
  else entirely (e.g. a different overlay absorbing the click — see section 5's "empty
  string" case), is the culprit instead.
- Anything else → the `style` prop isn't reaching the rendered node for some reason;
  re-trace the `asChild`/`mergeProps` chain in `popover.tsx` → `PopoverContentImpl` →
  `DismissableLayer` → `PopperPrimitive.Content` against the then-installed
  `@radix-ui/react-popover`/`@radix-ui/react-slot` versions, in case an upgrade changed
  the merge order.

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
