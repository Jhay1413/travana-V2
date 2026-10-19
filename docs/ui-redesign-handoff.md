# UI redesign handoff (Social Posts + Inbox) — 15 Oct 2026

Context for a fresh Claude Code session continuing the UI redesign of travana-V2.
Everything below is uncommitted in the local checkout on branch `dev`.

## The task

Port the designs from the prototype app at `C:\Users\admin\Desktop\travana-app`
(React 19 + Tailwind v4 prototype with hand-written `tv-*` CSS, no backend, hash
router, in-memory stores) into this app, page by page, as **re-skins on the
existing backend**. The prototype's `#/brief` page (`src/data/brief.ts`) is the
design spec: Poppins, navy `#2D4262` shell, white rounded cards, orange
`#F59E0B` actions, green/red/blue status, 14px base type, radii 8/10/12/16/20.
Rebuild in Tailwind on shadcn primitives; never copy the prototype CSS.

Design tokens already added to `client/src/index.css` (light + dark): `social-navy`,
`social-navy-ink`, `social-orange`, `social-orange-text`, `social-page`,
`social-border`, `social-muted`, `status-{scheduled,posted,draft,failed}-{bg,fg}`.
Shared segmented control classes: `SEGMENTED` / `SEGMENT_ITEM` exported from
`client/src/features/social/components/social-page-header.tsx`.

## Working rules (from CLAUDE.md, memory and the user)

- Follow `CLAUDE.md`: Route → Controller → Service → Repository on the server;
  features/<feature>/api hooks and `*.api.ts` for HTTP on the client; no `any`;
  named exports; tests next to code; delegate work to the coder / reviewer /
  tester / planner agents.
- **Never read `.env`, never touch the database, never run git commands that
  write** (no add/commit/rm/stash/branch). One agent once ran `git rm --cached`
  on the old inbox file; the user was told to run
  `git restore --staged client/src/features/conversations/components/conversations-inbox.tsx`.
- Gate = `npm run check:ci` (must be fully clean — the old duplicate AppError
  import in conversations.service.ts was removed on 16 Oct),
  `npm test` (vitest, node env only, no DOM), `npx vite build`. Plain
  `npm run check` has ~100 legacy v1 errors and is not a gate.
- Ask the user before guessing on behaviour, money or visibility.
- Pages cannot be opened in a browser from the session (needs DB + login);
  the user checks visually and reports back.

## Done: Social Posts (`/social-posts`, `/social-posts/calendar`, `/social-posts/settings`)

Code: `client/src/features/social/components/{grid,editor,calendar,schedule,create,settings}/`,
`social-page-header.tsx`, `lib/` (post-status, calendar-grid, quote-card-fields,
schedule-time, error-message), api hooks for settings and unschedule.
Server: `server/v2/modules/social-settings/` (+ `org_social_settings` table in
`shared/schema.ts`; the hand-written 0058 migration was REMOVED on 16 Oct — the
user runs `npm run db:generate` to produce one migration + snapshot, then
migrates; see "Pending migration" below), `socialStatus`
filter and `GET /api/v2/quotes/free/status-counts` in the quote module.

Decisions: statuses are DERIVED (no deal = not_generated; no onlySocialsId =
draft; future schedule = scheduled; else posted); publishing stays on the single
hardcoded OnlySocials account; org timezone is label-only (scheduling uses the
browser zone); the editor's Facebook option switches are preview-only; "Duplicate
as draft" not built; `social_media_manager` reaches `/social-posts*` via a new
`SOCIAL_ROLES` list (`client/src/config/homeworker-access.ts`).

## Done: Inbox (`/conversations`)

The 2,354-line `conversations-inbox.tsx` was deleted and replaced by
`client/src/features/conversations/components/inbox/`:
`list/`, `thread/`, `composer/`, `client-pane/`, `new-message/`, `enquiry/`,
`shared/`, `lib/`, `state/` (`use-inbox-state.ts`, `use-inbox-drafts.ts`,
`use-thread-actions.ts`, `derive-rows.ts`), `conversations-inbox.tsx`.
`message-thread.tsx` has a `variant="inbox"` branch; the classic default is
shared with tickets and the client chats tab and must not change.
Server: `ai-suggest-reply` accepts `{ tone, count }` and returns
`{ suggestion, suggestions[] }`; Zod validators on the list query and that route.

Decisions: "Mark done" keeps the pre-existing FAKE close (year-long snooze +
internal note); the Done tab merges the closed query with year-long snoozes from
the snoozed query; the Snoozed tab trusts the server list (lapsed snoozes show
"Snooze ended"); tags read-only; "Mark as unread" omitted; sort and
channel/tag/status/date filters are client-side over the loaded page (50 rows
for non-latest sorts), search is server-side; New message needs a SendSeven
contact linked to the client; client pane tiles are Bookings / Profit / Spend
(profit = Σ booking `package_commission`, spend = Σ booking total/sales price;
visible to every inbox role); deals show one row per transaction at its current
stage, latest two only; right panel is 380px, inline at ≥1500px else a slide-over.
Deferred: triage view with the views rail, mobile swipe actions, templates and
the WhatsApp 24h window, scheduled messages, the design's ticket drawer.

## Done: Create enquiry from this chat (inbox)

`inbox/enquiry/` replaces the wizard for the inbox entry point only. It keeps the
design's layout (client box, HOLIDAY DETAILS grid with source chips, quote of
the last inbound message, "Still needed" callout with "Ask {first}", WHEN YOU
SAVE switches, assignee) but carries all V2 fields: title + holiday type
(required), lead source from the channel, destinations/resorts/UK airports as
lookups, travel date + flexibility (date required unless flexibility is
"Any Time" / "Anytime in Month") + nights, adults/children(ages)/infants, budget
+ type, board basis, star rating, notes, hot-tub and cruise extras. Save =
`POST /api/v2/transactions` (`user_id` = chosen assignee), optional follow-up
task (tomorrow 10:00) and internal note, green "Enquiry created" bar in the
thread. The drawer opens immediately with a "Luna is reading the chat…" state;
all three entry buttons show "Drafting…". Labels/values are regular weight.

## Done: Pipeline (`/pipeline`) — 16 Oct 2026

Client: `client/src/features/pipeline/` split into `state/` (filters, collapsed
stages, columns, cache, parking, moves, dialogs), `lib/` (helpers, stage style,
money, board filters, column visibility, quiet, deal-meta, london-day),
`components/{header,board,card,list,drawer,dialogs,mobile,shared}/`, and a
~220-line `pipeline-board.tsx` keeping `PipelineBoard({agentId, embedded,
hideBooked})` (also used by the agent-stats Pipeline tab). New shared primitive
`client/src/components/ui/segmented.tsx` (`SEGMENTED`, `SEGMENT_ITEM`,
`Segmented<T>`, `variant="black"`) now backs Social, Inbox and Pipeline.
Pipeline/stage/priority tokens added to `index.css`.
Server (transaction module): `/transactions/pipeline/:status` gained optional
`search`, `priority` (CSV), `tourOperatorId` (CSV uuid), `quick`
(`due_today|no_task|quiet_7`) and sorts `latest_activity|value_desc|profit_desc|
name_asc|quiet_first`; real `totalValue/totalProfit` on page 1 only (later pages
return 0); new `GET /transactions/pipeline-counts`. SQL builders in
`transaction-pipeline.sql.ts`. No new params = old behaviour (dashboard panels).
Indexes `idx_tasks_entity_id`, `idx_notes_transaction_id` in `shared/schema.ts`.

Decisions: money = today's card formula (value = sales price − discounts +
service charge; profit = package + line-item commission), stage-aware (booked
reads the booking row, enquiries 0), server totals match cards; quick chips
apply to open columns only (Booked/Future/Lost empty while a chip is on); "Due
today" = London calendar day, overdue excluded; default sort latest activity
(Lost uses newest unless the user picks another sort); New deal = client search
→ EnquiryWizard drawer in place; Move to Booked keeps HAYS + tour ref only (no
target box/cost edits); drawer has no Luna "quote opened" hint or timeline;
"Mark as lost" always confirms; list has no checkboxes; mobile ≤900px one stage
at a time incl. Future; `/pipeline` removed from the social media manager nav.
Not verified against a real DB — the SQL was only rendered and reviewed offline.

## Done: Agent Dashboard (`/agent-overview`) — 16 Oct 2026

Prototype Layout A (`#/home`, five tiles) re-skinned on the existing endpoints.
Client: `pages/agent-overview/index.tsx` (~85 lines);
`features/agent-overview/components/{home,tasks,live}/` (HomeCard,
UnderlineTabs, StatTile, AgentDashboardCard, task row/filters, live row) and
`features/agent-overview/lib/` (greeting, tile-math, task-ranges, live-value,
live-panel, pipeline-rows, target-link, use-profit-stats). `london-day.ts`
moved to `client/src/lib/`. `features/pipeline/index.ts` now exports
StagePill, OperatorTile, FilterChip, money/stage helpers, formatCurrency.
`ProfitStatBoxes` and `PipelineLivePanel` were re-skinned in place (agent-stats
and organization overview get the new look); `DashboardCard`, `StatCard`,
`SegmentedTabs`, `InitialsAvatar`, `timeAgo` are untouched for other consumers.
Server: `GET /quotes/engagement/recent` gained optional `mine=true` (caller's
quotes for every role; 401 if no user) and `period=today|yesterday|week|all`
(HAVING on max(viewed_at), London days); no params = unchanged.
`/dashboard/agent-stats` and `/dashboard/my-profit` windows are Europe/London
(`server/v2/utils/london-time.ts` on `london-dates.ts`, moved from
organization-overview).

Decisions: Layout A only; Pipeline list profit and Pipeline Live value use the
pipeline page's stage-aware helpers (enquiries show "Budget £X"); engagement on
this page = own quotes with server-side period; profit tiles and dashboard task
ranges use UK days; Pipeline Live inline 382px from xl, stacked below it;
Goals tab keeps localStorage daily goals (now keyed by London day) plus a
"Monthly profit £x of £target" row; "Set a target" links only for org_admin
(`/agency/targets`) and branch_manager (`/branch/targets`) by primary role;
social_media_manager home is `/social-posts` and its Dashboard/Pipeline nav
items are gone (relies on the `/social-posts` route allowing SOCIAL_ROLES — ship
together). Engagement view counts still cover all of a quote's views, and the
Yesterday tab drops quotes viewed again today (filter is by latest view).
Follow-up not done: `getAdminOverviewStats` still uses server-local windows.

## Done: Tickets (`/tickets`, `/tickets/:ticketId`) — 16 Oct 2026

Client: the 3-pane inbox (`tickets-inbox`, 1154-line `ticket-thread-panel`,
`ticket-client-panel`) is gone. `/tickets` = `TicketsQueue` (List | Board,
search, priority/kind filters, sort, My / Raised by me / All, chips All open /
Needs attention / Unassigned / Closed, bulk assign + status, board drag to
change status). `/tickets/:ticketId` = `TicketPage` (`pages/tickets/ticket.tsx`;
client | conversation | booking panels, ≥1560 three columns, below a 400px
Booking|Client column, ≤900 tabs; prev/next through the saved queue order;
editable status/priority/assignee incl. Unassigned/reply due). Code under
`client/src/features/tickets/{lib,state,components/{shared,queue,list,board,
page,panels,thread,composer,dialogs}}`. The tickets-feature CreateTicketDialog
moved to `components/dialogs/new-ticket/` (prototype modal look, same fields);
the client-feature CreateTicketDialog (client page, header menu, inbox) is
untouched. `PersonAvatar`, `UnderlineTabs`, `RowButton` moved to
`client/src/components/shared/` (home-ui re-exports them). Tokens added:
`priority-urgent`, `ticket-amber-*`, `ticket-dashed`.
Server (`server/v2/modules/ticket/`): list/detail rows gain `clientPhone`,
`lastActivityAt`; `GET /tickets` gains `holiday` summary; `resolvedAt` is set on
Resolved/Closed and cleared on reopen; replies and attachments use the ticket's
own scope (`findByIdScoped`, 404 when out of scope); attachment delete =
reply author / ticket raiser / branch_manager / org_admin / platform_admin;
files can only be attached to your own replies; assignee is notified of
replies; createTicket ignores body userId/id/timestamps; a foreign clientId is
rejected and the client join is org-checked; changing a ticket's client clears
its holiday link; linking a holiday requires same org, same client and pipeline
visibility (`findByIdScopedForWrite`); ticket scope fails closed (only
platform_admin, org_admin and branch_manager WITH a branch see beyond their
own raised/assigned tickets). The v1 `/api/tickets`, `/api/replies`,
`/api/attachments` mounts (no auth) were removed from `server/routes/index.ts`
(files left on disk).

Decisions: prototype queue + page layout; V2's four statuses kept; team notes
only (client reply, supplier email, Luna drafts, quick replies and the inbox
"create ticket from email" drawer deferred); kind = existing type, no
categories; Pin replaces Watch; no snooze; reply-due labels in UK days, legacy
date-only due values (London or UTC midnight) mean "end of that day"; new
picks that land on those instants get +1s. Route-level staff gating was NOT
added because the sidenav badge and the client page tickets tab call these APIs
for non-staff roles (the fail-closed scope covers them).

## Done: Teams & Roles (`/agency/team`, `/agency/team/invite`) — 16 Oct 2026

Client: new `client/src/features/team/` (api, lib, state, components/{header,
invite,table,drawer,dialogs,invite-page,shared}). Layout A: header (Upload
spreadsheet, Add user), tiles (Active, Suspended, Seats used incl. pending
invites), quick invite, member table (Active|Suspended, role/branch filters,
search, inline role change with confirm, branch pills, "n of 17", status word,
Edit + menu), pending-invite rows (resend/revoke), user drawer (Details |
read-only Permissions), Add user (incl. homeworker share/display name),
Suspend (optional email), Remove (workload counts, new owner, type REMOVE),
"What each role can do" matrix. `/agency/team/invite`: up to 200 rows, CSV only
(+ template), per-row results, seats sidebar. `pages/agency/utils/role-helpers`
is a shim over `features/team/lib/role-helpers`. Billing reads seats from
`GET /organizations/me/seats` and no longer lets org admins switch plan
("Contact us to change plan"). Landing page shows a one-time notice when a
session is ended for suspension/deactivation. Portal wallet transactions use
`/api/portal/wallet/transactions`.
Server: account standing (`middlewares/auth/account-standing.ts`) — banned or
suspended (all memberships inactive, not a pending invite, not platform admin)
users are refused at login (403 + code), on every `orgBranchScope` route and
`/api/auth/user` (401 + code, session destroyed), in OIDC verify, in
`requirePlatformAdmin` and on change-password/profile/avatar; suspend, remove,
homeworker archive and platform deactivate revoke sessions (session-store pool,
`config/session-database.ts`) and close realtime streams. Remove = one
transaction moving open enquiries/quotes, own open tasks, open tickets and
active clients' created_by to the new owner, then ban ("Removed by …") and
deactivate memberships; booked deals stay. Seats (`organization-seat.*`):
active members incl. homeworkers + pending invites, referral partners free,
enforced on invites, homeworker invites, reactivation and role change; plan
changes are platform-admin only and set `organization.seatLimit`; signup with
no starter plan = unlimited. Member endpoints validated + audited
(`admin_audit_log`). Users: PATCH self-or-platform-admin, DELETE always 409,
POST platform-admin only with a strict schema, secrets stripped from every
user response, deal-details agent uses explicit columns, users can't change
their own email. quote-share is org-scoped. Several isAuthenticated-only v2
routers now use the full auth chain. ALL v1 routes in `server/routes/index.ts`
are unmounted (files kept), incl. `/wallet`.

Decisions: Layout A; permissions read-only per role (17 = 5/3/3/6; Owner/Admin
17, Branch Manager 15, Agent 7, Social Media Manager 3, Homeworker 6; referral
partner "Referral hub only"); no Sales Manager role (rows rejected with a
hint); removed people can't be re-invited (platform admin reactivation only);
homeworkers are archived, not removed. Gate note: the conversations.service.ts
duplicate AppError import was removed, so `npm run check:ci` must now be fully
clean (0 errors).
Not verified against a real DB: removal SQL/rollback, seat counts, session
deletion — `organization-member-removal.repository.integration.test.ts` is
written but not run.

## Done: Onboarding wizard (`/signup`, `/onboarding`) — 16 Oct 2026

Prototype `#/onboarding` + `#/admin` checklist, as a post-signup wizard.
Client: `client/src/features/onboarding/` (api, lib, state, components incl.
84px-rail shell, business/agents/shops/team/review/done steps, people table,
upload box, setup checklist card); `pages/onboarding/index.tsx`;
`pages/signup-agency/index.tsx` is now a thin wrapper over `SignupForm`
(business name, first/last name, email, password → verify-email as before).
`App.tsx`: `/onboarding` full-screen route; primary-role org_admin with status
`pending` is sent there from `/`. Checklist card on `pages/organization-overview`
(dismissible per user). `requestErrorMessage` → `client/src/lib/request-error.ts`,
CSV helpers → `client/src/lib/csv.ts` (team files re-export). Drafts
(`travana.onboarding.draft.v1.<userId>`, incl. `sentEmails`) cleared on logout.
`branch-helpers.ts` `ensureSevenDays` now reads "Monday" as well as "Mon".
Server (`server/v2/modules/onboarding/`): slim `POST /signup` (slug generated
from the business name, retry on clash; one placeholder default branch;
`settings.onboarding={status:'pending',version:1,placeholderBranchId}`); new
org_admin routes `GET /state`, `PUT /business`, `POST /shops`,
`PUT /homeworker-commission`, `POST /complete` (`onboarding-setup.*`). Writes
return 409 `ONBOARDING_NOT_PENDING` unless pending; orgs without the key read
as complete. `branch/branch-defaults.ts`: wizard branches = 08:00–17:00 Mon–Fri,
Sat/Sun closed, `mon-fri`, bank holidays closed, "Mon".."Sun" keys. `/shops`
runs each row under `pg_advisory_xact_lock` (claim + plan-limit count + insert);
plan refusal now carries `code:'BRANCH_LIMIT_REACHED'` (plan.service, all
callers). `organizationRepository.mergeSettingsSection` = atomic jsonb section
merge. Shared `utils/website-schema.ts` (blank or http(s)) also on the org
settings PATCH `profile.website` / `billing.website`.

Decisions: no opening hours in the wizard (default as above); roles Agent and
Branch Manager only (design's Sales Manager = branch_manager, no sells flag),
Homeworker is a shop choice; owner is a locked row, never invited; shop manager
email (optional) is invited as branch_manager by the server, skipped if blank or
the owner's; plan branch limit per shop row ("Contact us to add more shops"),
never bypassed; existing orgs never redirected; commission optional 0–100;
checklist targets = current London month; uploads CSV/TSV only; owner phone
stored as "". Not verified against a real DB or in a browser.

Follow-ups (16 Oct): `organizationService.update` now merges settings
atomically in SQL (`settings || patch`) and strips the server-owned
`onboarding` key; profile.tsx / billing.tsx send only their sections. Hard gate:
`features/onboarding/lib/gate.ts` `onboardingRedirectFor` sends a pending
primary-role org_admin to `/onboarding` from ANY non-allowlisted path, fails
open on a load error (`isError && !data`), shows a loader instead of flashing
pages; "Continue to dashboard anyway" sets a per-user sessionStorage bypass;
state query retries only 5xx/network, max 2. Error screen: Try again /
Continue to dashboard / Sign out.

## Done: Targets (`/agency/targets[/shops|/agents|/homeworkers|/allocate]`, `/branch/targets`, `/my-targets`) — 16 Oct 2026

Prototype Direction B (B1–B7). Client: `client/src/features/targets/` (api via
`TARGETS_ENDPOINTS`, lib: status/pace, months spread/scale, money, allocation +
plan with draft snapshot and conflict detection, chart, drafts; components:
overview tabs, dialogs, agent/override drawers, 4-step wizard, my-targets,
branch-targets). `components/admin/admin-financials-targets.tsx` unmounted (kept);
`reports/api/targets.api.ts` left for old consumers. Homeworker nav "My Targets"
(`MY_TARGETS_ROLES`); `target-link.ts` → `/my-targets` for homeworkers;
`use-profit-stats.ts` uses London month (`londonYearMonth`). Drafts
`travana.targets.draft.v1.<org>.<user>.<year>` (v2 format) cleared on logout.
Server (`server/v2/modules/targets/`): `GET /year`, `PUT /business`, `PUT /mine`,
`PUT|DELETE /homeworkers/:userId/override`, `POST /allocation` (one tx);
`POST /shop` now org_admin/platform_admin only; every write audited
(`targets.*` actions). Schema: new `org_target_table`; `agent_target_table` +
`source`/`self_amount`/`note`/`updated_by`. Org overview uses the stored business
month when > 0, else Σ shops + homeworkers; branch leaderboard now includes
upsell (matches branches performance and dashboard).

Decisions: business target stored, drift shown; profit = agent-dashboard
formula (package + line-item + upsell commission, London month); shop actual by
`transaction.branch_id`, homeworker actual gross branch commission; org_admin
edits business/shops/overrides/allocation, branch_manager only splits own shop
across agents (no shop total, no business, no other shops), homeworker sets own
target (overridden months only change `self_amount`), agents no page; exact
whole-pound balance (old £500 tolerance gone); £0 business month = not set;
legacy homeworker rows (`source='admin'`, `updated_by` null) read as self-set
(`normalizeHomeworkerRow`), revert never deletes them; wizard draft in
localStorage, sends only boxes changed vs its snapshot, Keep mine / Use latest on
conflicts. Not verified against a real DB; `targets.repository.integration.test.ts`
written, not run.

## Done: Client details page (`/clients/:clientId`, Layout C) — 16 Oct 2026

Client: overview branch of `pages/client/index.tsx` rebuilt from
`features/client/components/page/` (header, stat boxes, dashboard card + tabs,
side cards, live-deals rail with page-owned `use-live-deals-state`, new-deal
menu, modals edit/referrer/portal-pin/share) and `features/client/lib/`
(client-stats, live-deal-rows, deal-labels, task-rows, client-tabs,
client-access, portal-pin). `detailLayout` (`?holiday=`) kept, with a `readOnly`
prop through AllHolidaysPanel / HolidayHeaderActions / HolidayDetailView
(default false; social-quote unchanged). Deleted `client-index-view.tsx`,
`client-index-header.tsx`, `sections/{PortalAccessCard,ReferralNetworkCard,
ReferrerSelector}.tsx` and the `live-deals` variant of all-holidays-panel.
`use-portal-pin.ts` on axios + `NEON_CLIENT_ENDPOINTS.portalPin`; files via
`CLIENT_FILE_ENDPOINTS`. Inbox client-pane reuses `isLostBooking`.
Server security: client files scoped (`client-file.*` take Scope; 404 out of
scope; `client_files.uploaded_by` + `uploadedByName`); portal PIN moved to
`GET|PUT|DELETE /api/v2/neon-clients/:id/portal-pin` (bcrypt, on_pin_set) and
the v1 `portalStaffRouter` + v2 `/portal/staff/*` deleted; neon-client PATCH
`.strict()` without system fields, create/import strip them
(`neon-client.guards.ts`), referrer must be an active in-scope non-self client
(checked only when changed); `/api/v2/clients` (still used by `client.api.ts`)
got the same guards; `toPublicClient` / `publicClientColumns` strip `portalPin`
from neon-client, clients, contact-link and `GET /transactions/:id` responses
(`sms.repository.ts` still selects full rows internally). AI webhook file tools
use `systemScope(orgId)`. Read-only guard
`middlewares/auth/block-read-only-roles.ts` (primary role) refuses
social_media_manager writes on clients, client files, neon-clients, contact
links, notes, note attachments, transactions/enquiries/bookings/upsells, tasks,
tickets/replies/attachments, ai-enquiry, SMS opt-in; `/quotes` uses
`quote-social-guard.middleware.ts` (writes allowed only on free quotes,
social-post create and presign). Social posts/settings, inbox replies, SMS send,
favourites stay open.

Decisions: Layout C; profit = Σ booking package_commission; bookings/profit/PPB
exclude LOST (page and inbox pane); live-deal price = pipeline value;
social_media_manager read-only for all client data incl. deals, tasks and
tickets (primary role wins for multi-role users); Delete client, portal preview,
club points hidden; Add deal = enquiry/quote/booking menu; Pin stays for
read-only users; file delete stays Admin-only in the UI; chat button opens
`/conversations` (no per-client filter). Open: social media managers can no
longer raise internal (Admin/Build) tickets either.

## Done: Admin Dashboard (`/agency/overview`) — 17 Oct 2026

Prototype board A1 (`#/admin`). Client: new `client/src/features/admin-dashboard/`
(api: compare + profit-sources hooks; lib: money, dashboard-date (London
labels, next-briefing text, clock), headline-math, health-copy, compare-copy,
sources-math, supplier-math, team-math, chart-model, sample-briefing,
sample-departures, branch-selection; state: dashboard branch (same localStorage
key `admin-dashboard.branch`), departures, briefing settings, use-now;
components: page-head, headline-band (navy `admin-hero` token), sales-health,
briefing-card, departures-card/row, compare-card/table, sources-card,
team-performance-card/row, homeworkers-card, commission-chart-card/chart/table
(recharts; target tick on a hidden second X axis), supplier-league-card,
shared/{pills,bits}). `pages/organization-overview/index.tsx` is a thin wrapper.
Deleted (no importers): organization-overview/{admin-stat-boxes,
multi-branch-stats-card, tour-operator-league-card, homeworkers-overview-card,
commission-trend-card, branches-performance-table, agents-performance-card,
kpi-cards, forwards-synopsis-card, org-profile-strip}.tsx; `helpers.ts` kept
(leaderboard + homeworker statement). `ORGANIZATION_OVERVIEW_ENDPOINTS` added to
`client/src/api/endpoints.ts`. Pipeline Live removed from this page.
Server (`server/v2/modules/organization-overview/`): NEW `GET /compare?period=
week|month|year&against=prev|year|two_years[&branchId]` (London wall-clock,
like-for-like to date, clamped month/year ends; profit incl. upsells, bookings,
ppb, close rate for both windows; `organization-overview-windows.ts`,
`.sql.ts`, `.math.ts`, `-compare.repository.ts`) and NEW `GET /profit-sources
[?branchId]` (current London month grouped by `transaction.lead_source`;
"Not recorded" for NULL). `/stats` `kpis.avgCommission` now = month profit
INCL. upsells ÷ bookings (was booking-only). `/agents-performance` rows gain
`ppb` (incl. upsells) and `openDeals` (same definition as
`kpis.openQuotesCount`); `avgPerBooking` unchanged for the leaderboard.
`effectiveOrgId` now FAILS CLOSED (403 "Select an organisation first") when
the scope has no org — a platform admin not impersonating previously got an
unscoped cross-tenant aggregate on /stats, /agents-performance,
/branches-performance (also used by `/agency/leaderboard`).

Decisions: Layout A1 full-width (no Pipeline Live, no Export, no header
"Sample data" chip; "Add booking" → `/pipeline` — the pipeline has no `?new=1`);
Luna's morning briefing and Departures & balances are HARDCODED prototype
sample content (user's choice; V2 has no balance/payment data), locally
interactive, with a muted "Sample" pill, real first name + London weekday in
the greeting, "Ask Luna" toasts; PPB includes upsells everywhere on this page;
team totals "to go" = Σ each agent's own shortfall (not Σtarget − Σprofit);
team filter All / Shop staff / each shop (server re-query by branchId) /
Homeworkers; setup checklist stays on top; branch selector kept. Not verified
in a browser or against a real DB (compare/profit-sources SQL rendered and
reviewed only; integration tests written, not run).

## Done: Agent profile A3 (`/agents/:agentId[/earnings|/training|/hr|/pipeline]`) — 19 Oct 2026

Prototype `#/admin/team/:id` (+ `/earn`, `/train`, `/hr`, `?eng=hw`) rebuilt on
the existing `/agents/:agentId` route (MANAGER_ROLES; new `/agents/:agentId/:tab`
route beside it). Client: new `client/src/features/agent-profile/` (api hooks,
`state/use-profile-period`, lib: dates, period presets, period-target pro-rata,
hero/health copy, before-start, tenure, week-model, chart-model, earnings-model,
working-days, leave-calendar, holiday-model, documents-expiry, pills,
profile-tabs, payouts-model; components: shell (breadcrumb by role, 132px
photo card, pills, facts, tabs with HR lock), overview (period controls, navy
hero, health, week planner), earnings (tiles incl. homeworker/"Hidden"
variants, monthly Chart|Table with shaded period via the admin-dashboard
`CommissionChart` `shadedMonths` prop, biggest deals, payouts), training
(Hub courses, certificates & documents, leave calendar), hr (lock line,
read-only contact, employment/engagement with `EmployeeEditDialog` via new
`features/hr-v2/index.ts`, documents upload/open/delete, holiday, 1-2-1
notes), pipeline (`PipelineBoard` embedded + `ExpiringQuotesSection`)).
`pages/agent-stats/index.tsx` is a thin wrapper; `AGENT_PROFILE_ENDPOINTS` in
`client/src/api/endpoints.ts`; `features/agent-overview/components/pipeline-tab.tsx`
deleted; `profit-stat-boxes`, `whats-on-tab`, `expiring-quotes-section` kept.
Server: NEW `server/v2/modules/agent-profile/` mounted at `/api/v2/agent-profile`
(roles platform_admin/org_admin/branch_manager; branch managers see only their
branch's members, deals, departures and tasks; platform admin without org →
403; pay admins-only): `GET /:userId` (header: user, roles, branches,
homeworker, startedAt hr→membership→account, openDeals, biggestDeal,
bestMonth, lifetimeProfit, viewer flags), `/performance?from&to` (London
half-open; profit incl. upsells, bookings, sales, ppb, quotesSent, quotedDeals,
quoteViews, closeRate = bookings ÷ quoted deals, commissionRate, comparator org
or branch), `/week?start=Monday` (departures + incomplete tasks per London
day), `/monthly?year` (targets `getActualsForYear` per user + comparator +
targets via new `targets.service.getMemberYearTargets`), `/biggest-deals`,
`/training` (new `training-progress.repository.listEnrollmentDetailsByUser`),
`/payouts` (new `homeworker.repository.listStatementsByBranch` + live month via
`buildStatement`). Additive: `getOpenDealCounts(orgId, branchId?, userId?)`.
HR: `holidayUsedDays` now = working days (branch opening pattern, default
Mon–Fri) of approved Annual leave in the current London year
(`server/v2/utils/leave-days.ts`; HR row selects `branchOpeningPattern`).

Decisions: close rate = bookings ÷ quoted deals (as the admin dashboard);
holiday days = working days this year, HR page aligned; attendance = LEAVE
calendar from HR leave (Holiday/Sick/Leave/Pending/Not working/Today — no
"Worked"/"Late"), homeworkers get the "not tracked" note; supplier
accreditations → "Certificates and documents" = HR documents with an expiry
(Valid / Expiring soon ≤60d / Expired); Pipeline kept as a 5th tab, What's On
dropped here; no 1-2-1 goals (no data); contact card read-only (no admin
endpoint for address/emergency contact); period target = Σ month targets
pro-rata by overlapping days ("This month" = whole month); branch managers'
figures = the agent's deals in the manager's branch (as targets). Accepted and
commented: two comparator definitions (window via client org vs monthly via
targets actuals); LOST bookings stay in profit/lifetime/best month; homeworker
"Paid out" tile (profit × share) differs from statement amounts (commission −
discounts − service charge, UTC months). Not verified in a browser or against a
real DB; `agent-profile.repository.integration.test.ts` written, not run.

## Done: dev-only email link fix — 17 Oct 2026

Outside production every emailed link (verification, team / homeworker / HR /
onboarding-setup invites) uses the requesting browser's origin (else the
request host), falling back to `BASE_URL`/`PUBLIC_BASE_URL`, then
`http://localhost:5000`; production uses only the configured URL
(`server/v2/utils/link-base.ts`: `resolveLinkBase`, `isProductionRuntime`,
`requestOrigin`). SMS portal/quote links and OAuth/webhook URLs unchanged.
Also repaired on 17 Oct: a corrupt duplicated `percentString` block in
`shared/schema.ts` and a duplicated `Button` import / `LoadFailed` in
`tickets/components/page/ticket-page.tsx` (both restored to HEAD's content;
origin unknown — a line-based edit or sync at 23:18 on 16 Oct).

## Pending migration (user action)

16 Oct additions need `npm run db:generate` then migrate: `org_target_table`,
the four new `agent_target_table` columns, `client_files.uploaded_by`.


`npm run db:generate` produced `migrations/0058_dark_hawkeye.sql` (+
`meta/0058_snapshot.json`). The user's DB already had `org_social_settings`
from the old hand-written 0058, so the first migrate failed with "already
exists". The file was edited to be idempotent (`CREATE TABLE IF NOT EXISTS`,
FKs wrapped in `DO … EXCEPTION WHEN duplicate_object`, `CREATE INDEX IF NOT
EXISTS`); re-run migrate.

## Global fixes worth knowing

- Outline buttons looked heavy because `--button-outline` was undefined; it is
  now `hsl(var(--border))` in `:root` and `.dark`.
- `MultiSearchableSelect` gained an optional `chipClassName` prop.

## Suggested next steps (the brief's order)

1. Shell: navy sidebar/header to the exact design (84px rail / 280px nav / 58px bar).
2. Tickets queue + ticket page, then Teams & Roles, Client page, Home, Targets
   (Pipeline, Agent Dashboard, Tickets, Teams & Roles, Onboarding, Targets,
   Client page, Admin Dashboard and Agent profile are done).
3. Inbox triage view; social "Duplicate as draft" (needs an endpoint that copies
   post text without re-running the AI).

Memory files with the same decisions live in
`C:\Users\admin\.claude\projects\c--Users-admin-Desktop-travana-V2\memory\`.
