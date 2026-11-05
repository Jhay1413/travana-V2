# What our automated tests cover

This page explains how Travana is checked automatically, what each kind of check catches, and, area by area, what the browser tests prove. It is written for two readers: developers who need to know where to add a test, and the agency owner who wants to know what is protected and what is not.

If you only read one thing: **before a feature is called done, a robot opens a real browser, signs in as a real kind of user (agent, branch manager, owner, homeworker and so on), and does what a person would do.** It checks what is on screen and what is saved. It runs against a throw-away practice database and cannot send a single real email, text or WhatsApp message.

---

## 1. The four kinds of check

| Kind | What it is | What it catches | How to run it |
|---|---|---|---|
| **Typecheck** | The compiler reads all the code and checks that every piece fits its neighbours. | Typos, a field that was renamed in one place but not another, a missing value. The kind of mistake that crashes a page. | `npm run check:ci` (the strict one used by the team) or `npm run check`. For the browser tests: `npx tsc -p e2e/tsconfig.json`. |
| **Unit tests** | Small, fast tests of one piece at a time (a price formula, a date rule, one server service with its database faked). No browser, no database. | A rule being worked out wrongly: profit maths, "6 months or less" passport rule, who is allowed to see a ticket. | `npm test` (watch mode: `npm run test:watch`). |
| **Integration tests** | Server code run against a real (practice) database, without a browser. | A database query that returns the wrong rows or leaks another agency's data. | `npm run test:integration`, with the practice database running (see below). |
| **Browser tests** ("end to end") | A real Chromium browser clicks through the real app, which talks to a real server and the practice database. Where it matters they also check the saved data and the server's answer. | Whole-journey problems: a button that does nothing, a screen that shows the wrong number, a person who can see something they should not. | `npm run test:e2e` |

They catch different things, so we keep all four. The browser tests are the slowest, so they cover the journeys and the permission rules that matter most, and the smaller rules are left to the unit tests.

### How to run the browser tests

1. Start the practice database (once per session): `npm run db:test:up`. Docker Desktop must be running. It lives on `localhost:55432` and is called `travana_test`. Stop it with `npm run db:test:down`.
2. Run everything: `npm run test:e2e`. It prepares the database, starts the app server by itself, runs the tests one at a time and writes an HTML report (`npm run test:e2e:report` opens it).
3. Run one file: `npx playwright test e2e/tickets/ticket-access.spec.ts`. Run tests matching a phrase: `npx playwright test -g "passport"`.
4. Other ways to run them:
   - `npm run test:e2e:headed` shows the browser window.
   - `npm run test:e2e:watch` runs the whole suite in **slow motion** (every click waits half a second) so you can watch.
   - `npm run test:e2e:journey` runs only the main client journey (client, enquiry, quote, booking) in slow motion. This is the best one to show someone what the robot does.
   - `npm run test:e2e:ui` opens Playwright's interactive panel, and `npm run test:e2e:debug` steps through a test.
5. Do not run the browser tests and the integration tests at the same time; they share the practice database.

Never start the app with `npm run dev` to try things out for testing: it loads the live settings. The test command starts its own safe copy.

### Safety guarantees

These are enforced by the test set-up itself, and checked by tests:

- **Practice database only.** The tests refuse to start unless the database is exactly `localhost:55432/travana_test`. A safety guard rejects anything else, and the server for the tests is started with a short, fixed list of settings: no real passwords or keys are inherited from the machine.
- **Nothing can be sent.** Email is only printed to a log. The test server has an *outbound block*: any attempt to connect to a machine outside this computer is refused and written to a violation log. The browser is also stopped from reaching anywhere except the test server. If the log has anything in it at the end of a run, the run fails, and the next run will not start until someone has looked at it.
- **The canary.** At start-up the server deliberately tries to reach an outside address to prove the block really works. The refusal is recorded in `e2e-results/outbound-canary.json`. That file is the only thing that should be in `e2e-results/` after a clean run. Safety tests (`e2e/safety/outbound-block.spec.ts`) read it and also prove that no SendSeven, WhatsApp or mailbox login exists in the practice database, and that a booking's text-message trigger ends as a *failed* row and never as a sent message.
- **Departure texts stay off.** The departure text sweep is off by default (`SMS_DEPARTURE_SWEEP_ENABLED`), and the tests never turn it on.

---

## 2. What the browser tests cover, by area

Each test below is a plain-English description of what the robot proves. The file name is where it lives. Run `npx playwright test --list` to see the exact test names (currently 411 tests in 37 files). That count includes 13 small "date helper" checks that sit at the top of the specs that use dates: they check the UK-day, week, month and clock-change helpers against answers worked out by hand, so a test cannot agree with a wrong helper. No expected failures remain (see section 4).

### Onboarding and users (`e2e/onboarding/`)

- **Sign up** (`signup.spec.ts`): a new agency is created and the owner is sent to "verify your email"; email addresses are lowercased; a duplicate email is refused (whatever the letter case); a second agency with the same business name gets its own space; short passwords, malformed emails, missing fields and a too-short business name are refused with a clear message and nothing is created; the sixth sign-up from one address is slowed down (429).
- **Verify email** (`verify-email.spec.ts`): the link verifies the owner, who then reaches the set-up wizard; used, made-up and expired links show the failed screen; the 60-second resend cooldown works and then issues a fresh link; an unknown address looks the same as a real one (no account guessing); signing in before verifying is blocked.
- **Forgot password** (`forgot-password.spec.ts`): reset, sign in with the new password, old password and used link stop working; a reset ends every running session; unknown emails get the same answer as real ones; expired and invalid links and too-short passwords are refused.
- **Invites** (`invite.spec.ts`): every role is invited, accepts and lands on the right first screen; unknown, expired, resent, revoked and used links behave; seats are enforced (409 "All N seats are in use"), referral partners do not use a seat; a branch manager can invite agents into their own branch only; plain agents cannot invite; weak passwords and missing details are refused.
- **Remove a team member** (`remove-user.spec.ts`): their open work is handed to a new owner before they are removed; they can no longer sign in and their sessions end; you cannot remove yourself; homeworkers are archived, not removed; pending invites are revoked; a branch manager cannot remove anyone; people in another agency are a 404; the freed seat can be used again.
- **Set-up wizard** (`wizard.spec.ts`): single-shop and multi-shop set-up end to end; phone, address, website and shop-name checks; plan limits on shops; every people step can be skipped; spreadsheet upload rules (CSV only, 500 rows, 2 MB, bad rows flagged and only good ones sent); refreshing keeps your place; the wizard does not restart once complete.
- **Suspended agency** (`suspended-org.spec.ts`): a suspended agency's running sessions and logins are refused with a clear message, and un-suspending restores both.

### Deals: clients, enquiries, quotes, bookings (`e2e/deals/`)

- **Clients** (`client.spec.ts`): create through the New Client drawer (the button stays disabled until name and phone are filled); edit; postcode lookup (against a fake postcode service); duplicates are allowed but only an admin sees the duplicate group; a phone number must be exactly 11 digits once spaces are removed (UK format; +44 / 0044 is converted to 0...; any other country code is refused): a short, long, foreign or non-numeric number shows the plain-English inline error, keeps Create Client disabled and saves nothing, spaced and +44 numbers are accepted, typing is capped at 20 characters, the API answers 400 on create and on update with a bad number and stores +44 numbers as 07..., an update that does not touch the phone still works, an old-format number sent back unchanged is not re-checked (only a new or changed phone is), the edit dialog only checks a number that was changed, and creating a client from an inbox contact (`/contact-links/:id/client`) uses the same rule (400 for a bad, foreign or empty number, nothing saved; a +44 number is stored as 11 digits); merging moves deals and archives the duplicate, and merged clients cannot be edited; another agency gets 404 on everything; read-only roles cannot create. **Client header**: there is no Pin or Share button; "Referred by" sits on the same row as the name, phone and tier badge, with the address directly under that row.
- **Enquiries** (`enquiry.spec.ts`): a full enquiry saves every value and appears on the client page and in the pipeline; the title is the only hard requirement; sections keep what was typed; editing updates the same enquiry; an enquiry with no holiday type is refused and leaves no half-made deal. The Travel Date picker greys out past days and allows today; editing an enquiry with an already-past travel date still shows it.
- **Quotes** (`quote.spec.ts`): converting an enquiry pre-fills the quote and keeps its details; creating a quote keeps every value (dates, party, children's ages, destination, hotel, prices, discount, service charge); missing holiday type or travel date is refused; only the agency's linked tour operators are offered; a deal holds several quotes with exactly one main; lost and revived deals; Duplicate, Set as main, delete rules (a main quote with live siblings needs a replacement). In the Room Type select the chosen room type moves to the top and is ticked on reopening.
- **Bookings** (`booking.spec.ts`): converting a quote to a booking from all three places it can be done; HAYS Ref is always `HAY-` plus 7 or 8 digits and is tidied into that shape, Supplier Ref is required but free text; one booking per deal; everything on the quote is copied onto the booking; older bookings with old-style references can still be edited; manual booking creation.
- **Form money fixes** (`form-money-fixes.spec.ts`): an upsell added on Create Booking is saved with the booking and appears in the Upsells block on the booking page Costings tab; on the quote edit form, adding an extra (transfer, not included in package) with a commission raises Total Profit by that amount, and after saving, the Costings tab "Your profit", the database (package plus extras commission) and the re-opened form all show the same figure.
- **Whole journey** (`journey.spec.ts`): a new client becomes an enquiry, a quote and a booking and ends in the Booked column. This is the one `test:e2e:journey` plays in slow motion.

### Pipeline (`e2e/pipeline/`)

- **Board** (`board.spec.ts`): the card's 3-dots menu opens right under its button (not at the far left of the screen) and the hover toolbar stays visible while the menu is open; every column shows exactly its own deals; the money on each card matches the code's formula (cost = price - discounts + service charge, profit = package + line-item commission); column totals equal the server's sums; "Cost TBC", budgets, "+N" copies, booked refs; the board hides test deals, expired quotes and bookings from earlier months; empty states, paging and collapsing.
- **Drawer** (`drawer.spec.ts`): the deal drawer matches its card; the main button names the next stage; Add quote, Set as main, Move to In-Play, Mark as lost and Reopen.
- **Filters** (`filters.spec.ts`): search by title, client, phone and booking reference (each with a control showing other deals are hidden); priority, operator, No task scheduled and Quiet 7+ days chips; My Deals / All Deals / agent picker; sorting.
- **Moves** (`moves.spec.ts`): drag and drop between stages; the rules for forbidden moves (nothing goes backwards, an enquiry cannot jump to Booked); Future needs a date; Lost asks first; a booking move finishes the quote's tasks and sends nothing.
- **Scope** (`scope.spec.ts`): an agent sees their shop's deals, a branch manager their branch, an org admin every shop in the agency and nothing from another agency; moving another shop's deal is refused with the exact reason (403) and another agency gets 404.
- **Live updates** (`live.spec.ts`): other people's changes appear after a reload, your own moves refresh the board at once.

### Access and security (`e2e/access/`)

These tests are mostly about **who is allowed to do what**. Each has a "control" that proves the right person can still do it, so a test cannot pass just because everything is blocked.

- `deal-create.spec.ts` and `deal-create-followups.spec.ts`: a new deal is always made in the caller's own agency and shop whatever the request claims; foreign clients, owners and branches are refused with nothing written; agents with no shop cannot create deals; malformed requests are a 400, never a crash.
- `deal-writes.spec.ts`, `deal-scope-followups.spec.ts`, `deal-images.spec.ts`, `quote-children.spec.ts`: editing another shop's deal (quotes, bookings, notes, tasks, images, sharing, wallet credit, flights/transfers/passengers) is refused with "This deal belongs to another shop" (403); another agency gets 404; reading stays agency-wide; the shop's own agent and the owner still can.
- `no-shop-agent.spec.ts`: an agent or branch manager with no shop sees and changes no deals (fail closed) but their pages still load.
- `referral-agent.spec.ts`: referral partners are refused (403) on every deal and client call, and still reach their Affiliate Hub.
- `image-urls.spec.ts`: private files cannot be served or stored through the image proxy.

### Settings (`e2e/settings/`)

- `settings-roles.spec.ts`: agents can read reference data (airports, board bases and so on) but not change or delete it; the owner can; everyday quick-adds from forms keep working for agents; tour operators stay platform-admin only; tags are global, so renaming and deleting is admin-only while an agent can detach a tag from their own quote.

### Message safety (`e2e/safety/`)

- `outbound-block.spec.ts`: the outbound block was loaded before the app started and has refused nothing real; the canary connection was refused; the practice database holds no SendSeven, WhatsApp or mailbox settings; a booking conversion's text-message trigger runs, is **not** delivered (it ends as a failed row) and makes no outside connection.
- Throughout the suite, every browser test also fails automatically if the page tried to reach anywhere except the test server, and the whole run fails if the server tried to.

### Tickets (`e2e/tickets/`)

- **Queue and creating tickets** (`ticket-queue.spec.ts`): create a ticket for a client through New ticket and see every field saved (kind, subject, description, priority, assignee, status, reply-due time in UK time); create an internal ticket (kind Build) with no client; saving without a subject, an assignee or (for a Sales ticket) a client is refused and creates nothing; a picked file shows as a chip and can be removed; the four statuses (Open, In Progress, Resolved, Closed) each have their own board column and dragging a card changes the saved status and the resolved date; the chips (All open, Needs attention, Unassigned, Closed) count and list the right tickets; "My tickets" versus "Raised by me"; search by subject, client name, short reference and assignee with an empty-state check; priority and kind filters; **newest first** (open tickets by when raised, resolved and closed ones by when resolved); priority and due-soonest sorting; the reply-due pills (Due in, Overdue).
- **Ticket page** (`ticket-page.spec.ts`): status, priority, assignee and reply-due each save on change and the assignee is notified once; Resolve, Close and Reopen set and clear the resolved date; **team notes** are full-width messages in time order (not replies) and only an answer to a note nests, narrower, under it; authors can edit and delete their own notes and nobody else's; the **Message** button is always shown for a client ticket and leads to that client's inbox (for a client with no chat it opens New message for them, and nothing is sent); an internal ticket has no Message button; linking and unlinking a holiday (only the client's own holidays, another client's is refused); deleting with confirmation; "Ticket not found" for a ticket you cannot see; previous / next walks the queue order; pinning floats a ticket to the top (a Pinned group above Needs attention in the queue). **Pin and unpin** (written, not yet run): from the ticket page and from the enquiry holiday Tickets tab a ticket pins then unpins, the button reads Pin / Pinned correctly after each click (the unpin used to leave it on Pinned), the saved pin is removed, the Tickets tab card turns amber while pinned, and a pin made in the tab shows on the ticket page. **Client-page Create Ticket due time** (written, run with the suite): the drawer uses the same date + 15-minute London time picker as the Tickets centre (no due date by default) and saves exactly the chosen instant. **Holiday Tickets tab list**: every ticket starts collapsed, only five are listed with "Show more (n)" / "Show less", and a pinned ticket from beyond the first five moves to the top and can then be opened.
- **Who can see and change which ticket** (`ticket-access.spec.ts`): exact results for agent, colleague, branch manager (own shop only), other shop's manager, org admin, homeworker, agent with no shop, a branch manager with no shop, social media manager, referral agent and another agency. The rule: org admins see everything in the agency; a branch manager sees their shop; everyone else sees only tickets they raised or were given; anything else is "not found". Only the creator, the shop's manager or the owner can delete; the social media manager is read-only; the referral agent has no ticket access; replies and attachment lists follow the ticket; the "All tickets" view exists only for managers and admins; tickets cannot be filed against another agency's client or assigned across the shop / homeworker divide (except by the owner).

### Tasks (`e2e/tasks/`)

- **Creating** (`tasks.spec.ts`): from the dashboard "New task" button, a client page and a quote or booking page. The "what needs doing?" dropdown offers exactly Enquiry call, Quote call, Quote follow up, Re-quote, Booking call and Custom (Custom needs words); priority is Low, Medium, High or Urgent (Medium by default and shows no pill); linking a client and one of their live deals; a booking task is stored against the booking. **Add task description**: the client-page Add task pop-up has a Description box; typed text is trimmed and saved, a blank one saves as no description.
- **Changing** (`tasks.spec.ts`): ticking a task done on the dashboard and on the client page (the row changes on screen straight away, without a reload), editing every field including marking Done, deleting from the client page and from a quote (the row disappears at once).
- **Reassigning and who can change what**: handing a task to a colleague notifies them once; someone outside the team is refused ("That person is not on your team"); a task with no deal belongs to its owner (plus the shop's manager and the owner), and **an unassigned task with no deal can only be recovered by a branch manager or an admin, not by an agent** (owner decision, 3 Nov); a task on a deal follows the deal's shop (colleagues yes, another shop "belongs to another shop", another agency 404); social media managers are read-only.
- **Date order and UK days**: the dashboard lists tasks in date order, **soonest due first** (owner decision, 31 Oct); "Today" ends at UK midnight (23:30 is today, 00:30 is tomorrow); Overdue counts and lists only unfinished past tasks; on the client page open tasks come first in date order, undated last, finished ones at the bottom.
- **Finishing by themselves**: converting an enquiry to a quote finishes the enquiry's tasks and nothing else; deleting a quote finishes its tasks, both from the normal delete and from the admin "Delete Quote" dialog (the dialog used to leave them open; fixed 3 Nov). (Quote-to-booking is covered under Deals and Pipeline.)

### Dashboards (`e2e/dashboards/`)

- **Agent dashboard** (`agent-dashboard.spec.ts`): Today, This week and This month profit are booking plus line-item commission plus upsell commission, counted in UK days (the week starts on Monday), with old, inactive, other people's and removed items left out, and an upsell counted on the day it was *added*; Target, "% to target" and "Run to target" use the same figures; a new agent sees zero and the empty-state messages; the Pipeline card and Pipeline Live show the same money as the pipeline page (and "Budget" for enquiries); Quote Engagement shows only the viewer's own quotes (even for an owner) by UK day; daily goals are kept per person and per UK day and clear when UK midnight passes; the add button reads **New Ticket** on the Tickets tab and **New Task** elsewhere; the Tickets tab lists the newest open tickets assigned to the viewer.
- **Admin dashboard** (`admin-dashboard.spec.ts`): the headline numbers, profit per booking (upsells included) and the team table add up to what was seeded across two shops and ignore another agency; the Departures and balances card lists departures from today to seven days ahead (not later, earlier, lost or other agencies'), counts them and changes its pill as checks are ticked; Luna's morning briefing is checked only to confirm it is labelled "Sample" (it is made-up content on purpose); every other role (branch manager, agent, homeworker, social media manager) is refused (403) when the figures are asked for directly, but only the **branch manager's** screen is opened and checked for "Access denied" (the other roles are checked at the server, not on screen); a platform admin with no agency is refused (403) and the page shows the friendly "This dashboard needs an organisation, open an agency from All Agencies" screen.
- **Branch manager view** (`admin-dashboard.spec.ts`): the branch overview shows only that shop's month, not the other shop's or another agency's, and its Today, Week and Month are **UK days** (owner decision, 3 Nov): a booking made at 23:30 UK time yesterday is not counted as today's, whatever time zone the server is in. A unit test also pins the 23:30 / 00:30 UK boundary by hand.

### Passengers (`e2e/passengers/`)

- `passengers.spec.ts`: **(4 Nov rules, enforced on screen and at the server, on add and on edit, lead passport included)** all six fields (title, first name, surname, date of birth, passport number, passport expiry) are mandatory, tested by leaving each out in turn; a passport number must be exactly 9 digits (8, 10 digits, letters without the tick, are blocked with the message and Save is disabled with the reason shown), unless the **Non-UK passport** tick is set, then 5-20 letters/digits with no spaces (AB12345 saves, stored upper case with the flag; too short or with a space is blocked); the passport must expire MORE than 6 months after the next *booking's* departure (otherwise after today in UK time): the exact 6-month day and earlier are blocked with "Passport must be valid for more than 6 months after travel (until after DD/MM/YYYY)", one day later saves, the hint shows the deadline date, and quotes, lost and past bookings do not set the departure; an older passenger with gaps cannot be saved (even for an unrelated change) until completed, and editing a valid passenger to an invalid value is blocked on screen and by the API (merged stored + patch); the lead passenger is the client (name, title and date of birth come from the client), the lead's passport follows the same rules, and a lead whose client record lacks a title or date of birth cannot save a passport (Save off with a clear message, API 400); a legacy short-dated passenger still shows the card warning; passengers belong to their client and survive a reload; whoever can open the client sees the passengers with the passport number in full, the social media manager can see but not change, another agency, a referral agent and another shop's manager see nothing. **Agents versus branch managers (owner decision, 3 Nov):** an agent may see and add passengers, passport numbers included, for any client in the agency, even one belonging to another shop; a branch manager stays pinned to their own shop and gets "not found" for another shop's client; a merged client's passengers can be read but not changed.

### Social Posts platform picker (`e2e/social/`)

- `platform-picker.spec.ts`: staff choose which connected OnlySocials accounts (Facebook Page and/or Instagram) a post goes to. OnlySocials cannot be reached from the suite, so the account list, the "is OnlySocials configured" check and the schedule call are faked in the browser (`page.route`); the grid, the editor and the database are real. Covered: a new post starts with every selectable account ticked; a locked Instagram account ("Instagram coming soon") and a disconnected page ("Reconnect in OnlySocials") show their reason and cannot be ticked; the preview has one tab per ticked platform, the Instagram preview shows a square image and the note that links are not clickable, and the Facebook-only options appear only while Facebook is ticked; Instagram with no image is blocked on screen with the reason, and unticking it frees Schedule; ticking nothing blocks Schedule; scheduling sends exactly the ticked ids as `accountIds` in the multipart body (both accounts, and Facebook only); an account that went away after the editor loaded comes back as a 422 toast naming it and leaves the editor open; "Save text as draft" sends the ticked accounts; a post with saved targets reopens with exactly those ticked; an old scheduled post with no saved targets opens with only its Facebook Page ticked; when the account list cannot load the editor says so, keeps Schedule disabled, and Retry recovers; cards and calendar chips show a Facebook and/or Instagram dot from the saved targets, and old posts show Facebook only.
- The quick Schedule dialog's first-schedule path is not reachable from any screen today (drafts open the full editor), so its account defaults (a draft with saved accounts sends none; Instagram dropped with 0 or more than 10 images) are covered by unit tests only.
- The server rules (agency allow-list, Instagram flag, disconnected accounts, 422 before anything is sent, Instagram image and caption limits, the strict PATCH whitelist, the platform-admin allow-list) are unit-tested; the database columns have an integration test (`social-post.integration.test.ts`).

---

## 3. Not covered yet

These are known gaps. Some are deliberate.

- **A real OnlySocials post.** Whether OnlySocials accepts a version with a real account id, and how Instagram options must look, is unconfirmed; nothing in the suite can prove it. The owner checks it with one real post.

- **Latest chat from a ticket's Message button.** Following the button for a client who *has* a chat (it should open the latest open chat) needs a faked messaging service, which does not exist yet. The "no chat, so New message" path is tested. The rule itself is unit-tested.
- **Ticket attachments being uploaded and downloaded.** Files go to cloud storage, which the test block forbids. Choosing and removing a file on screen, and the attachment list's access rules, are tested.
- **Real messages.** Sending texts, WhatsApp, email or SendSeven chats is never exercised. A faked messaging service is the plan for a later stage.
- **Other areas with no browser tests yet:** the customer portal and public quote link pages (beyond keeping working), money screens (wallet, statements, reports, targets editing), destructive admin actions, platform-admin screens (including the new OnlySocials accounts card on an agency), social posts beyond the platform picker (generating, calendar drag and drop, settings page), the inbox itself, the HR and training areas, and the Departures / Balances pages (only the dashboard card is covered).
- **Mobile layouts.** Tests run at a desktop window size; the phone layouts of the tickets queue and ticket page are not driven.
- **Weekdays and month ends.** Dashboard windows are computed from today's date, so the tests work every day, but a special case (for example the first of a month, or a Monday) is only exercised when the suite happens to run on one.

## 4. Known problems the tests have found

**None are open.** When a test describes the correct behaviour but the app does not do it yet, the test is kept in the suite as an *expected failure* (`test.fail`): it shows as passing while the bug exists and turns red the day the bug is fixed, which is the signal to remove the mark. There are no such marks left.

The four problems the browser tests found were fixed on 3 Nov, and their tests are now ordinary passing tests:

- Client page: ticking or deleting a task now updates the list straight away. (Every task list is refreshed after any task change.)
- Deleting a quote with the admin "Delete Quote" dialog now finishes the quote's open tasks, the same as the normal delete. The dialog also now removes a free quote's AI reference like the normal delete does. Its other steps (promoting a replacement main quote, the audit record, the soft delete) already matched; images and tags are left alone by both deletes.
- A platform admin with no agency now sees the friendly "open an agency from All Agencies" page on the agency overview instead of a generic error card. The same mistake (reading the error status the wrong way) was also found and fixed in the quote screens: "Mark as lost" on a converted deal, "Reassign the primary quote first", "Pick a quote to promote" when deleting a main quote, "Set as main" messages and removing an already-removed tag.
- The branch overview now works out Today / Week / Month in UK days instead of the server's own clock.

## 5. Keeping this up to date

**Every heavy feature ships with its own tests, and this page is updated in the same change:**

1. Unit tests next to the code for the rule that changed (`<feature>.<layer>.test.ts`).
2. A browser test in `e2e/<area>/` for the screen a person would use, with a control that proves the allowed person can still do it. Compute dates from today (in UK time), not from fixed dates, build a time from a UK date plus a UK clock time (`londonAt` in `e2e/helpers/london.ts`) so clock-change days cannot move it, and call `pinLondonHelpers` at the top of the spec for any date helper it relies on.
3. An integration test (`*.integration.test.ts`) when the feature adds or changes a database query. These are written even if you cannot run them locally.
4. Update the relevant bullets in section 2, and the "Not covered yet" list in section 3 (remove what is now covered, add what you chose to leave out and why).
5. Before finishing, run `npm run check:ci`, `npx tsc -p e2e/tsconfig.json`, `npm test`, `npm run test:e2e` and `npm run test:integration`, and confirm `e2e-results/` holds only `outbound-canary.json`.

Rules every browser test follows: it must be able to fail; it waits for a positive "the page has loaded" (or "the server refused") signal before it checks that something is absent; searches and filters have a control showing the other items; it counts rows by the ids or the agency it created, never whole tables, so a retry cannot find a second copy; it never uses fixed sleeps except to prove that nothing happens (three places: the live-updates check and two text-message checks); and it never sends anything real.

## Drawer footer, client rail and notification tabs (Nov 2026)
- **Drawer** (`e2e/pipeline/drawer.spec.ts`): on every stage (Enquiry, Quoted, In Play, Booked, Lost) the footer's main button reads "Open full deal", there is no "Move to" button and no second header link, and the button opens the deal page. Moves are covered by the board drag-and-drop specs. `e2e/deals/booking.spec.ts` reaches the convert dialog through drawer -> full deal page.
- **Client rail** (`e2e/pipeline/client-rail.spec.ts`): a booking row shows no "Profit" line.
- **Notifications** (`e2e/notifications/notifications.spec.ts`): Unread is the default tab; ticking moves an item to Read and the bell badge drops (unread only); the X deletes; both tabs have empty states; Mark all read empties Unread.

## Import Deal on quote and booking forms (`e2e/deals/import-deal.spec.ts`)

- Quote drawer shows "Import Deal" and no raw "Import JSON" (no JSON file input).
- Booking drawer shows "Import Deal", no "Import JSON"; importing a faked bookmarklet capture (clipboard and the import-page / map-to-ids calls are faked) fills title, price and check-in.
- Check-in rule on a normal import: outbound landing 17:30 gives 18:30 (supplier's 12:00 ignored); a hand-typed check-in time is kept.
- Unit level: `client/src/lib/scraper-json-parser.test.ts`, `check-in-time.test.ts` (before 15:00, after, past midnight, missing arrival).
- Written but NOT run: the test database was unreachable when this was added.

## Ticket comment delete cascade (`e2e/tickets/reply-delete-cascade.spec.ts`)

- Holiday Tickets tab: deleting a comment with replies from another user shows "This will also delete 2 replies."; a comment without replies shows no warning.
- Confirming removes the comment, all its replies (including the other user's) and their likes; an unrelated comment stays.
- A non-author cannot delete someone else's comment (403), nothing is removed.
- Unit level: `ticket-reply.repository.test.ts` (nested/multi-level collection, attachment filenames, one transaction), `ticket-reply.service.test.ts` (file cleanup, permission unchanged).
- Written but NOT run: the test database was unreachable.

## Save changes on a scheduled social post (`e2e/social/scheduled-text-update.spec.ts`)

- Future-scheduled post: button reads "Save changes", PATCH carries only the text, toast "Scheduled post updated" (PATCH faked with page.route).
- OnlySocials failure (faked 502): error shown, editor stays open, text not saved.
- Post whose time has passed: "Save text as draft", text saved locally, toast says it already went out (real server, no OnlySocials call).
- Unit level: `social-post.targets.service.test.ts` (same date/time/accounts/media sent first then local save; failure saves nothing; posted and draft local only).
- Written but NOT run: the test database was unreachable.

## Delete client - soft delete, admin only (`e2e/clients/delete.spec.ts`)

- Admin opens the client page more-menu, Delete client, sees "Their deals stay in the Pipeline. The portal link stops working.", confirms: toast, back on the clients list, client row has deleted_at/deleted_by set (not removed).
- Deleted client is gone from the clients list, global search and GET /neon-clients/:id (404); the client URL shows "Client not found"; a second delete answers 409.
- The deal created for that client stays on the pipeline and its card still shows the client's name.
- An agent sees Merge but no Delete in the menu; DELETE on both /neon-clients/:id and /clients/:id answers 403 and the client is untouched.
- Written but NOT run: the test database was unreachable (global setup failed on CREATE EXTENSION).
- Follow-up: admins can open a deleted client read-only (banner `client-deleted-banner`, no create/edit/more menu), writes still 404, agent GET 404; deleted clients get no automatic texts; client counts exclude them. Unit: `sms.repository.deleted.test.ts`, `dashboard.repository.deleted.test.ts`, `viewClientById` cases in `client.service.test.ts`. Written, not run.
- Unit level: `client.service.test.ts` (soft delete, role guard, scope 404, already deleted 409, merged 400), `client.routes.test.ts` / `neon-client.routes.test.ts` (admin passes, agent / SMM 403), `client.controller.delete.test.ts`, `client.repository.deleted.test.ts` (list, search, find filters). Written, not run: `client-delete.integration.test.ts`.

## Extras and the customer total (e2e/deals/extras.spec.ts)

Written but not yet run (the e2e test database was unreachable). Covers:
- A not-included extra with a cost raises the quote form's Final total; switching Included back on removes it from the total but keeps the typed cost, and switching back to not included brings it straight back; after save, `sales_price` is unchanged, the Costings money card and the pipeline card show the new value.
- An extra left as Included in package changes nothing.
- New extras auto-fill dates from the quote (pick-up/visit/usage/parking/check-in = travel date, drop-off = travel date + nights).
- The client page "The Trip" tab shows a transfer, car hire, attraction ticket, lounge pass, airport parking and an extra hotel check-in.
- Extras cost behaviour: typing a cost on an Included extra shows a hint and leaves the total alone; turning Included off moves the Final total live as the cost is typed (2,400 -> 2,475 -> 2,520.50); after save the cost and flag are in the database and the re-opened form shows the same cost and total. Written, not run.
- Extras commission and per person: a not-included extra shows its auto-calculated commission on its card (included extras show none); a hand-typed commission sticks when the cost changes; Total Profit = package + extras commission; Per person = (price + not-included extras) / travellers. Unit: `extra-commission.test.ts` (own operator %, main-operator fallback, included = 0, manual override), `pricing.test.ts`, `customer-price.test.ts`, `quote-price-per-person.service.test.ts` (stored price_per_person refreshed after extras are saved). Written, not run.
Existing specs updated for the new value formula: pipeline/board.spec.ts, dashboards/agent-dashboard.spec.ts (2,940 -> 2,980), deals/booking.spec.ts (hero total 3,550).

## Tickets: pinned first, pin from the queue, nested replies (Nov 2026)
- **Pinned first** (`ticket-page.spec.ts`, `ticket-queue.spec.ts`): a pinned ticket leaves Needs attention / Open and sits in a Pinned group at the top of the open queue.
- **Pin from the queue** (`ticket-queue.spec.ts`): every list row and board card has a pin (muted off, orange on); clicking pins / unpins without opening the ticket and the row moves in or out of the Pinned group.
- **Nested replies** (`tickets/reply-nesting.spec.ts`): on the ticket page and the holiday Tickets tab a reply sits indented on a thread line under its parent with "Replying to <name>"; top-level notes stay as before.
- **Agent filter** (`ticket-queue.spec.ts`, written not run): the queue has an Agent menu (All agents + assignees visible in scope); picking one lists only that agent's tickets, the API honours `assignedTo` inside the caller's scope and an unknown id returns nothing.
- Unit level: `ticket-queue.test.ts` (agent options, Pinned group, sort kept among unpinned).
- Written but NOT run: the test database on localhost:55432 was not checked/used.
