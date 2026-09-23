# Frozen page after closing a create drawer

> Why `FormDrawer` clears `document.body.style.pointerEvents` on close, what the
> underlying Radix defect is, and what to check if the freeze ever comes back.
> Relevant file: `client/src/components/shared/form-drawer/form-drawer.tsx`.

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

## 6. If it comes back

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
