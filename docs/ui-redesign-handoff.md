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

## Done: feedback round 1 (Pipeline drawer, Inbox, Tickets, Social) — 20 Oct 2026

Prototype re-download of 20 Oct was byte-identical to 15 Oct for Pipeline,
Tickets, Inbox and Social (checked against the zips in Downloads); the only new
prototype pages are `/admin/departures(+/balances)`, `/admin/ideas` and
`/clients/:id/quotes/:quote` (NOT built). The user's visual review was
verified item-by-item against the prototype (see memory
`verify-feedback-against-reference`) and applied:
- Shared: `components/shared/next-task-row.tsx` (prototype task box; used by
  pipeline cards, deal drawer and inbox client pane) and
  `components/shared/note-cards.tsx` (inbox-style yellow note cards; used by
  the inbox client pane and the deal drawer); `CreateTaskDialog` dialog mode
  gained optional title/description/labels/defaults/hide props and
  `layer="above-drawer"` (z-600) — `DialogContent` accepts `overlayClassName`.
- Pipeline drawer: email removed from the customer card; tour operator row
  with "Open quote"; "Next task" box with View quote link; notes as inbox note
  cards; "Add task" is a centred pop-up (tomorrow 10:00, title only) that sits
  above the drawer (previously the 780px task sheet slid in BEHIND it); card
  and list "+ Add task" now open it.
- Inbox: Add task pop-up; client pane 310px inline / 340px sheet with the
  client type pill (`client.badge`) under the name; next-task box as pipeline;
  list avatars pastel with dark initials, 11px pills, waiting/snoozed plain,
  600 unread time, no Admin/Sales line; static "Luna spotted a holiday
  request · Review enquiry" banner on sales chats with a linked client (AI runs
  only on click; dismissible per conversation); grey `social-page` thread
  background (bubbles already navy/white); Generate enquiry is an outline
  button beside Luna AI and Send.
- Tickets: board is the default view (prefs key `tickets.queue.v2`); "Create
  ticket" added to the Booking actions menu; client page / quote page pass the
  selected holiday's transactionId; server errors surfaced; link-a-holiday list
  grouped Bookings / Quotes / Enquiries with operator tile, title and ref ·
  date; `?transaction=` + `initialTransactionId` on the tickets dialog.
- Social: "Not generated" → "Not scheduled" and folded into the Drafts chip
  (client-side; server status unchanged); pen icon on every card (generates
  then opens the editor on unwritten posts); `/social-posts/quotes/:id` now
  shows the full client quote view incl. tabs and the profit panel at all
  widths (user chose to show profit internally, unlike the prototype's lock).
- Security found by the review: notes are rendered as HTML (`NoteCard`,
  `RichTextDisplay`) but the new plain-text forms saved raw text and the
  server never sanitised. Fixed: client `plainTextToNoteHtml` (escape + `<p>`
  per line) in the drawer and inbox note forms; server `sanitizeRichText` on
  transaction notes (create/update, incl. the ai-ask and
  createTransactionWithEnquiry direct writers); client notes and enquiry
  replies are rows of the same `notes` table so they are covered. Then closed
  the rest: chat messages (`chat.service.sendMessage` + the portal bridge —
  the live one is `server/services/portal-chat-bridge.ts`, a deliberate v1
  one-liner), inbound email HTML on read (`server/v2/utils/sanitize-email-html.ts`,
  email-specific allowlist: tables/images https/mailto kept; scripts, styles,
  forms, handlers, cid/data images stripped — email is fetched live over IMAP,
  nothing stored), social post text is escaped on the CLIENT before it goes
  into the Facebook preview and the editor (`preview-text.ts`; the body itself
  is plain text published to Facebook, so no server HTML sanitising), and notes
  + chat are sanitised ON READ too so rows written before 20 Oct are covered
  without a DB backfill. Still raw: the unmounted v1 `server/services/
  ai-ask.service.ts` / `server/repositories/note.repository.ts`.

## Done: Departures & Balances (`/agency/departures`, `/agency/departures/balances`) — 20 Oct 2026

Prototype A1 "Departures and balances" (`#/admin/departures[/balances]`): a flat
table of upcoming bookings with tick boxes — Tickets tab: Check in, Tickets in
house, Passport info, Tickets pick up, Completed (unlocks when the four are
ticked; unticking reopens); Balances tab: Fully paid. Every tick stamps who /
when / what. No money amounts anywhere (the prototype has none).
Server: NEW table `booking_departure_checks` in `shared/schema.ts` (one row
per booking, created on first tick: six booleans + last_change_by/_name/_at/
_what; **needs `npm run db:generate` + migrate — no hand-written migration**);
NEW module `server/v2/modules/departures/` at `/api/v2/departures`
(`GET /?from&to` rows of active, not-LOST bookings with travel_date ≥ today
London; `PATCH /:bookingId/checks {key, value}` with the unlock/reset rules and
stamp; `GET /summary?days`), roles platform_admin/org_admin/branch_manager
(branch-scoped), fail closed without an org. The SMS `balance_due`
days-before-departure sweep now skips bookings ticked Fully paid.
Client: `client/src/features/departures/` (lib filters/search/counts/day
labels/unlock rule/stamp text with tests; api hooks with optimistic ticks;
components: page head + tabs, Tickets table/cards, Balances table/cards);
`pages/agency/departures.tsx`; routes registered before `/agency/*`
(MANAGER_ROLES); nav "Departures" for org admins (Sales) and branch managers.
The admin dashboard's Departures card now uses REAL data (next 7 days; pills
"All set" / "Passport info missing" / "Balance not paid" / "Checks outstanding";
links to both lists) — the sample departures module is deleted. Luna's
morning briefing stays hardcoded sample.
Decisions: new table rather than sample pages; admins + branch managers,
upcoming bookings only; dashboard card switched to real data (£ amounts gone —
no payment data exists); SMS reminder skips fully-paid; "next N days" includes
day N (prototype `daysAway <= N`). Not verified in a browser or against a real
DB. The SMS skip tolerates the table not being migrated yet (treated as not
paid); the departures endpoints 500 until the migration runs.
Pre-existing SMS bugs found by the review (backlog, untouched): the
days-before-departure sweep fires every active days-before template for a
booking matched at ANY offset (no `triggerDaysBefore` filter); the message
context describes the client's latest booking, not the swept one; the cron
uses UTC dates rather than London.

## Done: Client quote / booking / enquiry detail (`/clients/:id?holiday=quote:|booking:|enquiry:<id>`) — 21 Oct 2026

Prototype "Quote page (agent view)" (`/clients/:id/quotes/:quote`, booking
sister route) rebuilt IN PLACE on the existing `?holiday=` deep link (no new
route; every producer — pipeline, inbox, agent overview, deal-links, convert —
still works). Rail selection now pushes the URL (`openHoliday` in
`pages/client/index.tsx`), so refresh/back work and the URL is the single
source of truth. Layout: 290 | 1fr | 320 grid (≤1480 two columns, ≤1180 one,
≤860 stacked, ≤620 mosaic 2-col) built from
`client/src/features/client/components/holiday/`: top-bar (+ quote/booking-
enquiry top actions, breadcrumb, use-quote-preview), holidays-rail (+
holiday-link, components/shared/create-menu/), hero (+ hero-mosaic, use-holiday-photos),
facts-card / enquiry-facts, refs-card (+ refs-form), convert-dialog,
money-card, stage-box, activity-card (+ activity-actions), compare-card,
trip-card (+ trip-stop, enquiry-trip-card), views-card, holiday-page-shell
(frame + portal slots so the rail persists across selections),
quote-detail / booking-detail / enquiry-detail, holiday-detail-page;
`components/shared/photo-viewer.tsx` (z-600, keyboard). Pure libs with tests:
`features/client/lib/{holiday-rail,booking-refs,hero-mosaic,holiday-facts,
holiday-format,money-format,trip-timeline(+trip-extras/trip-types),
compare-rows,activity-tabs}.ts`, `features/quote/lib/{quote-money,quote-stage,
quote-views,preview-search}.ts`, `lib/photo-nav.ts`. Tokens `qp-*` (chips,
money bar, profit row, note card, current tint, refs card, trip stop tones,
step done, live dot, now ring, viewer overlay) in `index.css` light + dark.
Move-only extractions from the 2261-line `holiday-detail-view.tsx` (now ~810,
renders identically for `pages/social-quote`): `quote/booking/enquiry-actions-
menu.tsx` (new optional controlled props, `hideItems`, `showSetPrimary`,
`copySuccessToast`, ticket dialog closes on create), `assigned-agent-button`,
`holiday-notes-tab`, `holiday-tasks-tab`, `holiday-composer` (`variant="note"`),
pure `holiday-fields.ts` + `holiday-field-icons.ts`, `holiday-header-classes`,
hooks `use-controllable-open`, `use-set-as-main-quote`. `HolidayTasksTab` /
`HolidayTicketsTab` gained `hideCreateButton`.
Server: `quote.accepted_at` / `accepted_by` (FK user, set null — **needs
`npm run db:generate` + migrate; quote reads 500 until then**); `PATCH
/api/v2/quotes/:id/accepted {accepted}` (uuid param, strict body, scope 404,
free quotes 400, idempotent first stamp, read-only roles blocked, returns the
enriched quote); quote + booking detail GET add `service_commission` (same SQL
as the transaction list, moved to `transaction/service-commission.repository.ts`),
`main_tour_operator_logo_url`, `accepted_by_name` / `owner_name`; `createQuote`
strips accepted_*/sent_*/token, `duplicateQuote` strips sent_*/accepted_*;
quote-share `PATCH /:id/sent` validated (`sentVia` link|sms|email|whatsapp) and
now CALLED by the Share dialog (copy = link, SMS = sms) — the admin dashboard's
"sent" counts start moving; quote-share reads (views, customer actions) open to
social_media_manager within scope, writes still owner-only; booking refs
trimmed + required non-empty on PATCH and on convert (validators); the booking
edit drawer omits empty refs instead of sending null.
Decisions: profit = package + line-item commission (pipeline parity), margin =
profit ÷ total, 1 dp; NO balance due date (no payment data); upsells shown on
bookings as separate lines outside profit; stage Accepted = customer action OR
manual "Mark accepted" (+ Undo, manual only); all three branches share the
shell, booking gets the refs card ("Booked {date_created} by {deal owner}");
client `badge` pill shown; Preview opens `/view-quote/:token?preview=1` and the
public page skips the view log for it; read-only: Share/Duplicate/Convert/menu/
"+"/Mark accepted/Edit/refs/composer/tickets hidden, Pin + Guru stay; Compare
has no "Send side by side"; Luna read / client card not built (prototype did
not render them either). Not verified in a browser.
**21 Oct, later:** the social "View quote" page (`/social-posts/quotes/:id`)
was rebuilt on the same components — `features/social/components/quote-page/`
(page, two-column shell without the holidays rail, social top bar with
Supplier page / Guru / Pin / Edit / Update expiry / Copy to client / Delete,
copy flow, delete dialog) + `features/social/lib/quote-copy-values.ts`;
`pages/social-quote/index.tsx` is a thin wrapper. The legacy
`holiday-detail-view.tsx`, `holiday-details-panel.tsx`, `circle-action.tsx`,
`all-holidays-panel.tsx`, `holiday-header-actions.tsx` and the social copy of
`QuoteSummaryTimeline` are DELETED (no importers). The no-op "Export" button
is gone. `features/social/components/social-quote/{StatusPill,hooks,utils}`
are probably dead now (left for a later sweep).

**Done: reference update 27 Oct — hero ref chips, wide details, Trip/Costings tabs.**
Booking references moved from a centre card into the booking hero
(`holiday/ref-chips.tsx` chips + copy, `holiday/refs-dialog.tsx` 520px edit
dialog; `refs-card.tsx` and `RefsForm` deleted, `RefsFields` kept for the
convert dialog). "Holiday details" is now full width with a 5-column `wide`
grid (4/3/2/1 below 1700/1280/860/620px) on quote, booking, enquiry and the
social quote page; `HolidayTwoUp` removed. The right column starts with
`holiday/trip-costings-card.tsx` (tabs "The Trip" / "Costings", same underline
look as the activity card) built from `TripBody` and `MoneyBody`; the old
`TripCard`/`MoneyCard` wrappers are gone. The enquiry keeps its own trip card
(no money). Not verified in a browser.

## Done: Tour operators — global catalogue + per-org config, page `/agency/tour-operators` — 21 Oct 2026

Prototype "Admin: tour operators" (`#/admin/tour-operators`, Sales nav next
to Targets): one flat list (name, phone, weblink, username, password,
commission %, balance due weeks, updated), search, sort, inline add/edit/
delete, copy buttons, CSV import with "Check the import" preview, export,
template. Data model changed per the user: `tour_operator_table` is now a
PLATFORM-WIDE catalogue (name NOT NULL, unique on lower(name), code, website,
phone, logo_url, created_by, timestamps — NO org_id / commission any more) and
a NEW `org_tour_operator` link table holds the per-org config
(commission_percentage, balance_due_weeks default 14, username,
encrypted_password via `utils/encryption.ts`, is_active, created_by,
updated_by, unique (org, operator)). Quote/booking/line-item FKs keep
pointing at catalogue ids.
**Migration is a three-step user action (see "Pending migration")**: the
one-off `scripts/migrate-tour-operators-to-catalogue.sql` (dry-run block,
guard, dedupe by lower(trim(name)) — canonical = has logo, then global seed,
then lowest id —, links with each org's commission, 20 FK repoints, inactive
links for referenced-but-unowned operators, delete duplicates, post-checks,
one transaction) runs FIRST against the old schema, then `npm run
db:generate` (answer "create column" to every rename prompt; delete the
generated CREATE TABLE/FK/index statements for `org_tour_operator` because the
script already created them), then migrate. Old code must not run after the
script; new code 500s until migrate.
Server: `server/v2/modules/tour-operator/` rewritten (routes with
`noResponseLog` + role guards, validator, controller, access, mapper,
service, import plan/service, csv, catalogue + org-link repositories, link
service, collect-operator-ids): `GET /` bare array of safe options (id =
catalogue id, linkId, name, logo_url, code, commission_percentage string,
balance_due_weeks, is_active) for the quote/booking forms; `GET /manage`
`{rows, canWrite, canSeePasswords}`; `GET /catalogue?q`; `POST /` (link an
existing catalogue row or create one by name + link; 409 "already in your
list"); `PATCH /:linkId` (diff; "" clears; commission null allowed);
`DELETE /:linkId` (link only); `GET /:linkId/password` (audited in
`platform_admin_audit_log`, fails closed if the audit write fails);
`POST /import/preview` + `/import` (one transaction; blank commission on a
NEW row = NULL "not set", not 0; catalogue fields fill blanks only);
`GET /export` CSV (formula guard, passwords blank for non-admins). Readers:
platform_admin/org_admin/branch_manager/agent/homeworker; writers: the first
three; social_media_manager 403 on the whole router; fail closed without an
org (platform admins must impersonate). `server/index.ts` response logger
honours `res.locals.skipResponseLog`. Operator-in-org check ("Tour operator is
not in your list", 400) on every quote/booking/upsell/transaction create and
add-line path, updates check only changed ids, convert + duplicate exempt
(`tourOperatorLinkService.assertPayloadOperatorsLinked`). json-mapper resolves
names among the org's linked operators first, then the catalogue (a
"contains" match only when unique), creates rows/links for writer roles only
(seed % carried when the name is a seed operator; others get a warning); SMM
may read `GET /tour-operators` (options only) and still import. `POST
/quotes` and the nested quote on `POST /transactions` accept
`source_quote_id` so Copy-to-client / duplicate of a quote with an unlinked
operator still works. Upsell rows carry `tour_operator_name`. Forms show a
hint when the rate is not set or the list is empty; org-admin bookmarks to
`/settings/tour-operators` redirect to `/agency/tour-operators`. Onboarding links the SEED
operators (`shared/tour-operator-seed.ts`) with their seed % for a new org —
never 0% (0 counts as a set rate and would zero auto-filled commission).
admin-import: catalogue columns only, delete/clear refused. Settings catalogue
`/api/v2/settings/tour-operators` platform_admin only (name/code/website/
phone/logo; delete refused while referenced). Seeds retargeted
(`seed-org-tour-operators.ts` upserts the catalogue, `-- link <org|all>`;
`seed-tour-operator-commission.ts` fills NULL link rates; `seed-org.ts` step
9 removed; `backfill-after-fresh-migration.sql` §1 now a comment;
`backfill-commission.sql` joins through the link table — its header formula
still disagrees with the client formula, untouched). New utils
`escape-like.ts`, `pg-errors.ts` (23505 → 409).
Client: `features/tour-operators/` (page, libs with tests: csv template,
header aliases, parse-import (CSV/TSV only — no xlsx dependency; 2 MB / 500
rows), import preview, sort/filter, summary, form validation (diff-based
PATCH; commission required on add, blank allowed on edit), format, access;
components ≤300 lines; copy-password via the reveal endpoint for agents,
masked); `pages/agency/tour-operators.tsx` thin wrapper; `TourOperatorSheet`
deleted; nav "Tour Operators" (Handshake) for org admins (Sales), branch
managers and agents/homeworkers (read-only); routes `/agency/tour-operators`
(STAFF_ROLES, before `/agency/*`) and `/settings/tour-operators`
(PLATFORM_ROLES, before `/settings/:tableSlug`; Data Management section split
so org admins no longer see it); `features/tour-operator/` (singular) types
rewritten, mutations hook deleted, `lib/operator-options.ts` keeps the
selected inactive/unlisted operator in quote/booking/upsell selects;
settings-lookup catalogue config without commission.
Decisions: global catalogue + link table; merge existing copies by name;
passwords visible to admins + branch managers, copy-only for agents, none for
SMM; shared catalogue editable by org admins (phone/website global, no
per-org override); balance-due weeks stored but not yet used by SMS/quote
page. Known: legacy `tour_operators` table still holds plaintext passwords
(unused); non-canonical copies' logos are dropped by the script; the
"contains" name fallback in json-mapper can link a near-match operator (a
warning is shown). Not verified in a browser or against a real DB.

## Done: feedback round 2 + app-wide tweaks — 21 Oct 2026

- Scrollbars hidden app-wide (`index.css` base layer: every element incl.
  html/body; Radix ScrollArea no longer renders its thumb). Scrolling unchanged.
- Quote/holiday page: `text-compact` tier applied like the other redesigned
  pages; the page scrolls with the window (no inner fixed-height scroller, which
  left dead space below the content); rail/right column stick under the header;
  Quote views card = plain list (stat tiles removed, per the prototype).
- Social: status label "Draft" → "Not scheduled" (pill + chip; user decision,
  the prototype pill says "Draft"); "When" filter gains "Custom range…" with
  From/To (URL `from`/`to`; sends scheduledOnly + rangeStart/rangeEnd on the
  scheduled date; not in the prototype, user request).
- Inbox: thread background back to card (user preference over the grey thread
  of the prototype); composer auto-height includes the border (no phantom
  scroller); composer controls + Luna banner on the 12px radius family.
- Quote page radius family: cards/dialogs 16px (`rounded-2xl`), every inner
  control 10px (`rounded-[10px]`), circles `rounded-full` — applied across
  `holiday/**`, the moved notes/tasks/composer/tickets tabs, photo viewer and
  the social quote page. Rail tabs: content-sized items, plain counts
  (`Segmented countVariant="plain"`).
- Inbox composer = the quote page's Inbox tab box: light grey reply box
  (`border-black/10 bg-black/[0.02]`, 12px), amber note box, black Send,
  black active mode toggle (inbox `Segmented` wrapper now passes `variant`);
  attach / Generate enquiry / Luna menu / drafted strip all 10px. Bubbles in
  BOTH variants: agent `bg-sky-100`, client white with border.
- Ticket page: right column 310px at the inbox breakpoint (1500px) incl. the
  tabbed fallback; operator logo next to the holiday title now shows: the
  `GET /transactions/:id/details` response lacked `main_tour_operator_name` /
  `_logo_url` on quotes and booking (added via `transaction/tour-operator-fields.ts`).

## Done: feedback round 3 (pasted list, 28 Oct) — 28 Oct 2026

Parked by the user: client-page Add Task assignee (item 1; the dev tree already
has an "Assign to" picker — the report matched the prod branch) and the
dashboard New task client search / deal link (item 2). Everything else below.

- Pipeline: Enquiry → In play (and Quoted) opens the pre-filled quote form; when
  dropped on In play the quote is created with `quote_status: in_play` in one
  request (`QuoteDialogState.targetStage`); cancel = no mutation. The generic
  `PATCH /transactions/:id {status}` fallback is gone (it set on_quote with no
  quote and the card vanished from every column). Blocked in `isValidDrop` +
  `moveDealTo`: Quoted/In play/Booked → Enquiry, Booked → open stages,
  Enquiry → Booked. Server: `transaction-status-transition.ts` rejects status
  downgrades and on_quote/on_booking without a backing (non-copy, non-free)
  quote / non-LOST booking (400). "New deal" is a dropdown Enquiry / Quote /
  Booking (desktop + mobile; `components/shared/create-menu/`):
  client picker, then EnquiryWizard / QuoteCreateDialog drawer /
  BookingCreateDialog drawer. Not in the prototype (user request).
- Social: every draft "Schedule" entry (card button, card menu, calendar tray,
  drag-to-day with the date pre-filled via `openEditor(quote, { scheduleDate })`)
  opens the Social Post Editor; "Change time…" on a scheduled post keeps the
  quick dialog. Images: ONE ordered list (`editor/image-order.ts`,
  `post-order-strip.tsx`): selecting appends, drag a tile onto another to
  insert, earlier/later arrows, numbered badges. The order is sent as
  `imageOrder` (JSON array of `existing:<mediaId>` | `url:<i>` | `file:<i>`)
  on schedule and reschedule; `server/v2/modules/social-post/media-order.ts`
  validates it before any upload and orders the OnlySocials media list
  (legacy existing → files → urls when absent). No schema change.
- Inbox: the list-header "…" menu (live-status row + "Channels" → Integrations)
  removed to match the reference. New deep link `/conversations?client=<id>`
  (`buildClientInboxHref`): most recent open conversation, else most recent of
  any status (tab switches; fetched by id if not on the loaded page — replaces
  the old 2-page `DEEP_LINK_MAX_FETCHES` limit, `state/use-inbox-deep-link.ts`);
  linked client with none → New message pre-filled; unlinked client → plain
  inbox. Used by the ticket client panel "Message", client Chats tab "Open
  inbox", client rail "Open chat", pipeline drawer "Chat". Unverified: whether
  the live SendSeven list defaults to open-only when no status is sent (the
  fixtures return all statuses; the client type has no "all").
- Tickets: New-ticket client search / date picker inside a centred Dialog were
  offset because Tailwind v4 `translate-x-[-50%]` sets the CSS `translate`
  property, which `use-fixed-dropdown-position` did not treat as a containing
  block (`hooks/fixed-containing-block.ts`). Select lists now clamp to the
  available height: the `[--radix-…]` classes in components/ui were the
  invalid v3 form under v4 and were silently ignored (8 files swept; the
  calendar/chart `[--cell-size]`/`[--color-*]` ones left alone — visual
  risk). Due-time select: avoidCollisions + 8px padding. Replies: 85% width,
  larger indent, 13px; like / reply / edit / delete (+confirm) icon-only in the
  note header, right-aligned, on hover/focus (`thread/note-header-actions.tsx`).
  "Mark resolved" (desktop, mobile, Status select) navigates to /tickets.
  Thread layout (user, 28 Oct): the description is full width; EVERY note
  after it (Add note or Reply) renders nested inside one rail beneath it, and
  replies to those notes nest one level deeper. Render-only
  (`thread/ticket-conversation.tsx`); no parent marker is stored.
  Emoji picker = the inbox portalled `EmojiPopover` (now exported from
  features/conversations).
- Client page tasks: `GET /api/v2/tasks/for-client/:clientId` returns tasks on
  the client AND on its enquiries / quotes / bookings (deal ids scoped with
  `buildTransactionRecordScopeConds`; 403 "Select an organisation first" with
  no org; 404 out of scope). Rows attached to a deal navigate to
  `?holiday=<kind>:<id>` — kind resolved from the client's holiday map, so
  booking tasks stored as entityType "quote" open the booking
  (`lib/deal-labels.ts taskLinkFor`). Client-only tasks have no link. Toggle /
  delete mutations now also invalidate `taskKeys.all`.
- Standard "+" create menu (user, 28 Oct): ONE shared dropdown
  `components/shared/create-menu/` (New client | Enquiry, Quote, Booking |
  Task, Ticket; round blue `Plus` trigger = the old holiday-rail style, or the
  header outline variant) replaces the header create menu's navigate-to-
  `?create=` round trip, the client page "Add deal" SquarePlus, the Live deals
  rail SquarePen "New deal", the holiday rail menu and the pipeline "New deal"
  button (desktop + mobile; hidden when embedded). With `onCreate` the caller
  owns its dialogs (client page / holiday rail); otherwise built-in flows:
  enquiry/quote/booking = client-pick step then the drawers, task =
  AddTaskModal (client entity when a client is known), ticket = tickets
  CreateTicketDialog, New client = ClientFormDrawer then `/clients/:id`.
  Header passes `afterCreate="navigate"` (goes to the new record via
  `?holiday=kind:id`); everywhere else stays. Flows stay mounted while a save
  is pending (closing mid-save no longer drops booking/quote images). Hidden
  for read-only roles (SMM), same rule now on the clients page "Add Client".
  Deleted: rail-create-menu, client page new-deal-menu, pipeline
  new-deal-menu/new-deal-dialog/new-deal-kind, `?create=` consumer.
- Task modal everywhere (user, 28 Oct): `EditTaskDialog` is modal-only, built
  from the same shell/fields as `AddTaskModal` (`components/shared/task-modal/`,
  helpers in `features/tasks/components/tasks/edit-task-form.ts`); the drawer
  presentation is gone from all six call sites. Edit date is now the native
  date input. Pre-existing: Add writes due times in London time, Edit in local
  time — not changed.
- Known leftovers: Select lists app-wide now clamp to the viewport (smoke-test a
  low-on-page select); `use-schedule-dialog-state` still carries the "schedule"
  mode (reachable only via calendar reschedule); a Future deal whose natural
  stage is Booked can still be marked Lost (pre-existing).

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
20 Oct addition: `booking_departure_checks` (Departures & Balances).
21 Oct addition: `quote.accepted_at`, `quote.accepted_by` (quote page) —
quote detail / pipeline reads 500 until migrated.
21 Oct addition (tour operators — THREE steps, in this order, app stopped):
(1) `npm run db:migrate-tour-operators -- --dry-run` (read-only report; psql is
not needed — `scripts/run-tour-operator-migration.ts` runs the SQL file through
the app's pg pool), review it, then `npm run db:migrate-tour-operators`
against the OLD schema (one transaction, rolls back on any error); (2) `npm run
db:migrate` — `migrations/0061_confused_puma.sql` is already generated and was
made idempotent for `org_tour_operator` (IF NOT EXISTS / duplicate_object), so
it runs after the script without edits; (3) start the new code. Running
db:migrate before the script fails on `uq_tour_operator_name_lower` (duplicate
names such as "hays itour") and rolls back harmlessly.


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
