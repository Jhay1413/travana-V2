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

> Not the same race as sections 1–5. This one is a focus/scroll ownership conflict
> between a portaled, non-modal `Popover` and the `Dialog` it renders inside. Relevant
> files: `client/src/components/ui/searchable-select.tsx`,
> `client/src/components/ui/multi-searchable-select.tsx`.

### Symptom

Inside a `FormDrawer` (the enquiry/quote/booking drawers), a `SearchableSelect` or
`MultiSearchableSelect` dropdown opens and renders normally, but you cannot click into
its search box (so typing does nothing) and you cannot scroll its list. Outside these
drawer forms, the same components work fine.

### Dead end: the pointer-events theory (disproved, keeping this on record)

The first hypothesis was that this was the same class of bug as sections 1–5:
`@radix-ui/react-dismissable-layer` computes each layer's own `pointer-events`
synchronously at render time and applies it as an inline style, and it was suspected
that a registration race could cause the popover to paint with `pointer-events: none`
baked in. The fix under that theory was to force `style={{ pointerEvents: "auto" }}`
onto both `PopoverContent`s.

**The user tested this on Replit — the actual environment where the bug reproduces —
and it did not fix the dropdown.** That disproves the theory. In hindsight, reading
`react-dismissable-layer`'s source confirms why it could never have been the cause
here: a layer's `pointer-events` only computes to `"none"` when it sits *below* the
highest layer that has `disableOutsidePointerEvents: true`. The non-modal `Popover`
these components used never set `disableOutsidePointerEvents`, and it always mounted
*after* (i.e. on top of, index-wise) the drawer's own `Dialog` layer — so it was always
the topmost layer and always resolved to `pointer-events: auto` on its own, with or
without the forced `style`. The dropdown was never actually receiving
`pointer-events: none`; something else was swallowing the input. This is recorded here
so nobody retries the same theory.

### Root cause

`node_modules/@radix-ui/react-popover/dist/index.js` implements `PopoverContent` as one
of two variants, chosen by the `Popover` root's `modal` prop:

- `PopoverContentNonModal` (~line 213) — the default (`modal` defaults to `false`) —
  passes `trapFocus: false` and `disableOutsidePointerEvents: false` to its
  `DismissableLayer`/`FocusScope`, and does not wrap its content in `RemoveScroll`.
- `PopoverContentModal` (~line 173) — used when the `Popover` root has `modal` — wraps
  its content in `RemoveScroll` (`as: Slot, allowPinchZoom: true`), passes
  `trapFocus: context.open` and `disableOutsidePointerEvents: true`, and calls
  `hideOthers(content)`.

`SearchableSelect` and `MultiSearchableSelect` both used the default, non-modal
`Popover`, and `PopoverContent` is portaled to `document.body` — i.e. it renders
*outside* the drawer's own DOM subtree. The drawer itself is a Radix `Dialog`
(`SheetContent`) with its own `FocusScope` (`trapFocus`) and its own
`react-remove-scroll`, both scoped to the Dialog's content node.

For a portaled, non-modal popover mounted while that Dialog is open:

- the Dialog's `FocusScope` keeps pulling focus back inside *its own* node, so the
  popover's `CommandInput` can never hold focus — clicking into it does nothing, and
  nothing typed goes anywhere;
- the Dialog's `RemoveScroll` blocks wheel/touch scroll events that originate outside
  its own node, so the popover's list — mounted elsewhere in the DOM via the portal —
  can't be scrolled.

Both effects look identical to "the dropdown is dead," which is why the earlier,
disproved pointer-events theory seemed plausible before it was tested.

### The fix

Both components now expose a `modal` prop on their `Popover` root, **defaulting to
`true`**:

```tsx
<Popover open={open} onOpenChange={setOpen} modal={modal}>
```

With `modal`, Radix renders `PopoverContentModal` instead: it gets its own
`FocusScope` trap and its own `RemoveScroll` (scoped to the popover, with
`allowPinchZoom`), so it stops fighting the Dialog's for either focus or scroll. This
fixes both parts of the symptom with one change, and needs no special-casing for
`onAddNew`/`setOpen(false)` beyond what already existed (see below).

`disableOutsidePointerEvents: true` also becomes active. Per the mechanism above
(confirmed by re-reading `react-dismissable-layer`'s source), this legitimately makes
the popover the layer that disables outside pointer events — the correct, intended use
of that mechanism, not a workaround — and there was never a need to force `style` on
the `PopoverContent`, so the old `style={{ pointerEvents: "auto" }}` and its
explanatory comment were removed from both components. It was solving a problem that,
per the dead end above, never actually existed for these popovers.

This also means these popovers now participate in the **body-level** pointer-events
locking described in sections 1–3 (`disableOutsidePointerEvents: true` sets
`document.body.style.pointerEvents = "none"` while open) — i.e. slightly more exposure
to the freeze race, already mitigated by the `FormDrawer` cleanup in section 4.

### Trade-off: `modal` changes behavior outside dialogs too

Defaulting `modal` to `true` is a real behavior change for every existing usage of
`SearchableSelect`/`MultiSearchableSelect`, not just the ones inside `FormDrawer`. While
either dropdown is open, the page's scroll now locks, focus is trapped inside the
popover, and the rest of the page becomes `aria-hidden` — everywhere these components
are used, including places with no surrounding `Dialog`. For a combobox, that is normal
and generally expected behavior, and any call site that needs the old, non-trapping
behavior can opt out with `modal={false}` — but it is a behavior change beyond the
reported drawer bug, and is being called out explicitly here rather than left implicit.

### Verifying this one

Not reproducible on a fast local machine — same as the rest of this doc. The `modal`
fix has not yet been verified at runtime; that verification is deferred to the user
testing on Replit, the same way the earlier pointer-events theory was tested (and
disproved) there. If it resurfaces, check whether the search box can hold focus
(`document.activeElement` after clicking it should be the `CommandInput`, not something
inside the Dialog) and whether the list scrolls — if either still fails with `modal`
already in effect, re-check that the `Popover` root is actually receiving
`modal={true}` (e.g. a call site passing `modal={false}` unintentionally) before
looking elsewhere.

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
