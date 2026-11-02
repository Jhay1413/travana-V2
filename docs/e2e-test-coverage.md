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

- **Clients** (`client.spec.ts`): create through the New Client drawer (the button stays disabled until name and phone are filled); edit; postcode lookup (against a fake postcode service); duplicates are allowed but only an admin sees the duplicate group; merging moves deals and archives the duplicate, and merged clients cannot be edited; another agency gets 404 on everything; read-only roles cannot create.
- **Enquiries** (`enquiry.spec.ts`): a full enquiry saves every value and appears on the client page and in the pipeline; the title is the only hard requirement; sections keep what was typed; editing updates the same enquiry; an enquiry with no holiday type is refused and leaves no half-made deal.
- **Quotes** (`quote.spec.ts`): converting an enquiry pre-fills the quote and keeps its details; creating a quote keeps every value (dates, party, children's ages, destination, hotel, prices, discount, service charge); missing holiday type or travel date is refused; only the agency's linked tour operators are offered; a deal holds several quotes with exactly one main; lost and revived deals; Duplicate, Set as main, delete rules (a main quote with live siblings needs a replacement).
- **Bookings** (`booking.spec.ts`): converting a quote to a booking from all three places it can be done; HAYS Ref is always `HAY-` plus 7 or 8 digits and is tidied into that shape, Supplier Ref is required but free text; one booking per deal; everything on the quote is copied onto the booking; older bookings with old-style references can still be edited; manual booking creation.
- **Whole journey** (`journey.spec.ts`): a new client becomes an enquiry, a quote and a booking and ends in the Booked column. This is the one `test:e2e:journey` plays in slow motion.

### Pipeline (`e2e/pipeline/`)

- **Board** (`board.spec.ts`): every column shows exactly its own deals; the money on each card matches the code's formula (cost = price - discounts + service charge, profit = package + line-item commission); column totals equal the server's sums; "Cost TBC", budgets, "+N" copies, booked refs; the board hides test deals, expired quotes and bookings from earlier months; empty states, paging and collapsing.
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
- **Ticket page** (`ticket-page.spec.ts`): status, priority, assignee and reply-due each save on change and the assignee is notified once; Resolve, Close and Reopen set and clear the resolved date; **team notes** are full-width messages in time order (not replies) and only an answer to a note nests, narrower, under it; authors can edit and delete their own notes and nobody else's; the **Message** button is always shown for a client ticket and leads to that client's inbox (for a client with no chat it opens New message for them, and nothing is sent); an internal ticket has no Message button; linking and unlinking a holiday (only the client's own holidays, another client's is refused); deleting with confirmation; "Ticket not found" for a ticket you cannot see; previous / next walks the queue order; pinning floats a ticket to the top.
- **Who can see and change which ticket** (`ticket-access.spec.ts`): exact results for agent, colleague, branch manager (own shop only), other shop's manager, org admin, homeworker, agent with no shop, a branch manager with no shop, social media manager, referral agent and another agency. The rule: org admins see everything in the agency; a branch manager sees their shop; everyone else sees only tickets they raised or were given; anything else is "not found". Only the creator, the shop's manager or the owner can delete; the social media manager is read-only; the referral agent has no ticket access; replies and attachment lists follow the ticket; the "All tickets" view exists only for managers and admins; tickets cannot be filed against another agency's client or assigned across the shop / homeworker divide (except by the owner).

### Tasks (`e2e/tasks/`)

- **Creating** (`tasks.spec.ts`): from the dashboard "New task" button, a client page and a quote or booking page. The "what needs doing?" dropdown offers exactly Enquiry call, Quote call, Quote follow up, Re-quote, Booking call and Custom (Custom needs words); priority is Low, Medium, High or Urgent (Medium by default and shows no pill); linking a client and one of their live deals; a booking task is stored against the booking.
- **Changing** (`tasks.spec.ts`): ticking a task done on the dashboard and on the client page (the row changes on screen straight away, without a reload), editing every field including marking Done, deleting from the client page and from a quote (the row disappears at once).
- **Reassigning and who can change what**: handing a task to a colleague notifies them once; someone outside the team is refused ("That person is not on your team"); a task with no deal belongs to its owner (plus the shop's manager and the owner), and **an unassigned task with no deal can only be recovered by a branch manager or an admin, not by an agent** (owner decision, 3 Nov); a task on a deal follows the deal's shop (colleagues yes, another shop "belongs to another shop", another agency 404); social media managers are read-only.
- **Date order and UK days**: the dashboard lists tasks in date order, **soonest due first** (owner decision, 31 Oct); "Today" ends at UK midnight (23:30 is today, 00:30 is tomorrow); Overdue counts and lists only unfinished past tasks; on the client page open tasks come first in date order, undated last, finished ones at the bottom.
- **Finishing by themselves**: converting an enquiry to a quote finishes the enquiry's tasks and nothing else; deleting a quote finishes its tasks, both from the normal delete and from the admin "Delete Quote" dialog (the dialog used to leave them open; fixed 3 Nov). (Quote-to-booking is covered under Deals and Pipeline.)

### Dashboards (`e2e/dashboards/`)

- **Agent dashboard** (`agent-dashboard.spec.ts`): Today, This week and This month profit are booking plus line-item commission plus upsell commission, counted in UK days (the week starts on Monday), with old, inactive, other people's and removed items left out, and an upsell counted on the day it was *added*; Target, "% to target" and "Run to target" use the same figures; a new agent sees zero and the empty-state messages; the Pipeline card and Pipeline Live show the same money as the pipeline page (and "Budget" for enquiries); Quote Engagement shows only the viewer's own quotes (even for an owner) by UK day; daily goals are kept per person and per UK day and clear when UK midnight passes; the add button reads **New Ticket** on the Tickets tab and **New Task** elsewhere; the Tickets tab lists the newest open tickets assigned to the viewer.
- **Admin dashboard** (`admin-dashboard.spec.ts`): the headline numbers, profit per booking (upsells included) and the team table add up to what was seeded across two shops and ignore another agency; the Departures and balances card lists departures from today to seven days ahead (not later, earlier, lost or other agencies'), counts them and changes its pill as checks are ticked; Luna's morning briefing is checked only to confirm it is labelled "Sample" (it is made-up content on purpose); every other role (branch manager, agent, homeworker, social media manager) is refused (403) when the figures are asked for directly, but only the **branch manager's** screen is opened and checked for "Access denied" (the other roles are checked at the server, not on screen); a platform admin with no agency is refused (403) and the page shows the friendly "This dashboard needs an organisation, open an agency from All Agencies" screen.
- **Branch manager view** (`admin-dashboard.spec.ts`): the branch overview shows only that shop's month, not the other shop's or another agency's, and its Today, Week and Month are **UK days** (owner decision, 3 Nov): a booking made at 23:30 UK time yesterday is not counted as today's, whatever time zone the server is in. A unit test also pins the 23:30 / 00:30 UK boundary by hand.

### Passengers (`e2e/passengers/`)

- `passengers.spec.ts`: Add Passenger needs **all six** fields (title, first name, surname, date of birth, passport number, passport expiry), tested by leaving each one out in turn, on screen and at the server; a passport number that is not 9 digits shows a warning but still saves; an expiry of 6 months or less is flagged (against the next *booking's* departure, otherwise against today in UK time) but never blocks, tested on the exact boundary day; the next departure ignores quotes, lost bookings and past bookings; editing is never blocked, including for older passengers with gaps and for the lead's passport; the lead passenger is the client (name, title and date of birth come from the client and follow any change); passengers belong to their client and survive a reload; whoever can open the client sees the passengers with the passport number in full, the social media manager can see but not change, another agency, a referral agent and another shop's manager see nothing. **Agents versus branch managers (owner decision, 3 Nov):** an agent may see and add passengers, passport numbers included, for any client in the agency, even one belonging to another shop; a branch manager stays pinned to their own shop and gets "not found" for another shop's client; a merged client's passengers can be read but not changed.

---

## 3. Not covered yet

These are known gaps. Some are deliberate.

- **Latest chat from a ticket's Message button.** Following the button for a client who *has* a chat (it should open the latest open chat) needs a faked messaging service, which does not exist yet. The "no chat, so New message" path is tested. The rule itself is unit-tested.
- **Ticket attachments being uploaded and downloaded.** Files go to cloud storage, which the test block forbids. Choosing and removing a file on screen, and the attachment list's access rules, are tested.
- **Real messages.** Sending texts, WhatsApp, email or SendSeven chats is never exercised. A faked messaging service is the plan for a later stage.
- **Other areas with no browser tests yet:** the customer portal and public quote link pages (beyond keeping working), money screens (wallet, statements, reports, targets editing), destructive admin actions, platform-admin screens, social posts, the inbox itself, the HR and training areas, and the Departures / Balances pages (only the dashboard card is covered).
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
