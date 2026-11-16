# AI Work Log

Last updated: 2026-11-15 (Asia/Makassar)

Read this file before continuing work in this repository. Add a dated entry here when you make or verify meaningful changes so Claude, Codex, and other contributors can hand work off safely.

## Project

- Helpdesk MVP monorepo: `apps/api` (Express, Prisma, PostgreSQL), `apps/web` (React/Vite), and `packages/shared`.
- The application is configured for PostgreSQL. The project does not use Laragon's MySQL database as a substitute.
- The repository initially showed `apps/` and `package-lock.json` as untracked. Treat the existing app files as user work; do not reset or delete them to clean up Git status.

## Completed

### Backend

- `apps/api/src/app.ts`: use central frontend URL configuration and accept URL-encoded request bodies.
- `apps/api/src/server.ts`: use central port/environment config, validate the port, and close cleanly on termination signals.
- `apps/api/src/config/index.ts`: fail early in production when the JWT secret is a development/example value or the database URL is missing.
- `apps/api/src/modules/tickets/tickets.routes.ts`: restrict ticket edits to admins and agents.
- `apps/api/src/modules/tickets/tickets.controller.ts`: validate ticket categories and require assignees to be active agents/admins.
- `apps/api/src/modules/categories/categories.controller.ts`: prevent category parent cycles and prevent deleting categories with child categories.
- `apps/api/src/modules/dashboard/dashboard.controller.ts`: scope customer dashboard counts, categories, recent tickets, and trends to that customer's own tickets.
- `apps/api/src/modules/dashboard/dashboard.controller.ts`: dashboard Recent Tickets include only `OPEN`, `IN_PROGRESS`, and `PENDING`; API returns five per page ordered by status, then priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), then newest first.
- `apps/web/src/pages/dashboard/DashboardPage.tsx`: horizontal previous/next controls paginate Recent Tickets when there are more than five; ticket create/update invalidates dashboard data.
- `apps/api/src/utils/pagination.ts`: fall back to safe defaults for invalid page/limit query values.
- `apps/api/prisma/seed.ts`: refuse to run the destructive seed in production; load the repository `.env` when run from the API workspace.
- `apps/api/src/modules/auth/auth.service.ts`: use the correct JWT `expiresIn` type.

### Frontend

- Fixed API response unwrapping in auth, category, ticket, and user services; kept paginated endpoints in their actual `{ data, meta }` shape.
- `apps/web/src/services/dashboard.service.ts`: call `/dashboard/stats` and unwrap its payload.
- Ticket assignment now calls the dedicated `/tickets/:id/assign` endpoint.
- Restore auth state before React routes render to avoid redirecting a stored session to login.
- Corrected TypeScript build configuration in `apps/api/tsconfig.json`, `apps/web/tsconfig.json`, and the web build script.
- Added `package-lock.json` by installing workspace dependencies.

### Verification and runtime

- `npm run build` passed for shared, API, and web after changes.
- `git diff --check` passed.
- Backend health endpoint returned HTTP 200 at `http://localhost:3000/api/health` when last checked.
- Helpdesk frontend returned HTTP 200 at `http://127.0.0.1:5174/` when last checked. It is currently bound to loopback only. Port 5173 belongs to another project (the user's portfolio); do not use it for this Helpdesk frontend.
- PostgreSQL 18 is installed as the Windows service `postgresql-x64-18`, running automatically and accepting connections on `localhost:5432`.
- The user supplied the local PostgreSQL administrator password. Do not record it in this file, source control, or logs.
- The existing `.env` `DATABASE_URL` targeted the `helpdesk` role and `helpdesk_db` database. Those were absent, so a dedicated `helpdesk` role and fresh `helpdesk_db` were created using the password already stored in `.env`; the administrator password was not added to app config.
- `prisma db push` created the schema in the new database, then `npm run db:seed --workspace apps/api` populated the demo data.
- Verified `POST /api/v1/auth/login` with the seeded admin account returned success. The access token was not printed. Health check returned HTTP 200.
- Full `npm run build` passed after the Recent Tickets priority ordering change.
- The seed deletes rows before recreating demo data. Do not run it again unless the user confirms the current database contents can be replaced.

## Open work

1. Optional: create and commit an initial Prisma migration. Current local schema was applied with `prisma db push`, so a migration history has not been generated yet.
2. If the user reports further login issues, check that the frontend is using `http://localhost:5174` and the API at port `3000`; the demo login has been API-verified.
3. SMTP provider credentials are not configured yet. Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `PASSWORD_RESET_URL` in the local environment before email reset links can be delivered.

## User-requested backlog (recorded 2026-11-15)

1. **DONE 2026-11-15 — Recent Tickets ordering and pagination:** Show only `OPEN`, `IN_PROGRESS`, and `PENDING`; order by status, then priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), then newest first. Display five per page with horizontal previous/next controls when more than five exist. Exclude `RESOLVED` and `CLOSED`.
2. **Attention/update badge:** Show a red badge with a count for ticket updates or issues that need attention/notification.
3. **DONE 2026-11-15 — Category/team routing and claim queue:** Admin groups agents into teams, routes categories to teams, and agents claim Open tickets from their team's queue.
4. **DONE 2026-11-15 — Internal User role:** Added `USER`, separate from `CUSTOMER`. Internal users can create tickets and only view their own tickets/dashboard; they cannot see internal notes or create them.

## Handoff notes

- The Laragon window could not be targeted by automation; PostgreSQL was ultimately installed standalone (per user) and configured directly. Docker was not used.
- Continue in Indonesian unless the user switches language.
- Keep this log current: add a short dated note under a new section rather than rewriting prior history.

## Work completed 2026-11-15 — Notification badge

- Added per-user notifications for new tickets, ticket field updates and assignments, and public/internal ticket comments. Notifications are scoped to the requester, assigned agent, and admins as appropriate.
- Added authenticated endpoints to list the latest 20 notifications, count unread items, mark one read, and mark all read.
- Added a red unread count on the header bell, a notification popover, navigation to the related ticket, and 15-second unread-count polling.
- Added the Prisma `Notification` model and applied its additive table to local `helpdesk_db` with `prisma db push --skip-generate`; existing data was retained.
- Prisma Client generation writes to the ignored package path `node_modules/@prisma/helpdesk-password-client`; the API uses this generated client. Added `db:generate` scripts and root `postinstall` so the client is prepared after dependency installation.
- Verification: Prisma Client generation succeeded; `npm run build` passed for shared, API, and web. API started on port `3000`; `/api/health` returned HTTP 200. Demo login succeeded, authenticated unread-count endpoint returned `0`, and notifications list returned `0` items. No token was printed.
- Follow-up: show the same unread notification count as a red numbered badge on the right side of the Tickets sidebar item.
- Follow-up: align comments written by the active user to the far right edge of the comment section, label them “You”, and use a distinct avatar/bubble color.

## Work completed 2026-11-15 — Internal role, agent teams, and claim queue

- Added a `Team` model and team membership for active AGENT accounts (one team per agent). Admin-only Agent Teams page creates/edits teams and manages membership.
- Categories now route to a team. New tickets enter that team's Open queue without an individual assignee; ticket notifications go to active agents in the team and admins.
- Agents only see tickets in their team's queue plus tickets already assigned to them. `Take Ticket` atomically claims an Open/unassigned team ticket, assigns the agent, and changes status to In Progress. Ticket updates and replies require the agent to have claimed the ticket. Admins can still view and manage all tickets.
- Kept legacy category-to-agent database columns so any old assignments are preserved; the UI/API workflow now uses teams instead.
- Added the `USER` enum role to Prisma and shared types, and exposed “Internal User” in the admin user-management form and filter.
- `USER` follows requester access rules: own tickets only, own dashboard data, no internal comments, and notifications as a ticket requester. Public self-registration continues creating `CUSTOMER` accounts.
- Applied the additive team schema changes with Prisma `db push`; generated Prisma Client and ran the full workspace build successfully. API health returned HTTP 200; admin login succeeded; the Teams and Categories endpoints responded (0 teams and 5 categories currently exist). Create teams and map categories in the admin UI before agents can claim team tickets.

## Work completed 2026-11-15 — Password replacement and reset

- Admin can replace a user's password from User Management. Passwords must be at least 8 characters; changing it also invalidates pending reset links.
- Password replacement is part of the Edit User form; an empty password field leaves the existing password unchanged. The same form can activate/deactivate the account.
- Added public Forgot Password and Reset Password pages and API endpoints. Reset links use cryptographically random one-time tokens; only SHA-256 token hashes are stored, links expire after one hour, and the request response does not reveal whether an account exists.
- Added an IP-based limit of five reset requests per 15 minutes.
- Added SMTP provider configuration variables and `.env.example`; reset link base URL is configurable separately and defaults to the local Helpdesk origin on port 5174. SMTP is intentionally not activated because credentials were not provided. Delivery errors are logged server-side and reset tokens are removed on send failure.
- Added the `PasswordResetToken` table to PostgreSQL. Full build passed for shared, API, and web. End-to-end email delivery remains pending SMTP configuration.
- Corrected the local `.env` `FRONTEND_URL` to `http://localhost:5174` so the Helpdesk frontend, rather than the portfolio on port 5173, is allowed by API CORS. Restarted the API and confirmed health returns HTTP 200.

## Work completed 2026-11-15 — Toggleable dark mode

- Added a persistent light/dark toggle to the dashboard header. The preference is stored in local storage and is applied before the app renders, including the public auth pages.
- Added a soft charcoal palette with muted text, adapted surfaces, borders, badges, inputs, and hover colors for better night-time comfort.
- The toggle icon reflects the current theme (moon in dark mode, sun in light mode); added a short icon animation and color transition, respecting reduced-motion preferences.
- Web production build passed.

## Handoff note 2026-11-17 — Recreate demo data on home PC

- To recreate the deterministic demo dataset on another PC: install Node.js and PostgreSQL; create a local `.env` from `.env.example` with that PC's `DATABASE_URL`; from repository root run `npm ci`, `npm run db:generate`, `npm exec --workspace apps/api -- prisma db push --schema prisma/schema.prisma`, then `npm run db:seed`.
- Start the API and web in separate terminals with `npm run dev:api` and `npm run dev:web`.
- `db:seed` is destructive: it clears current users, tickets, comments, categories, and histories before recreating demo records. Use a blank/local database or data that can be replaced.
- Current `seed.ts` creates demo users, categories, tickets, comments, and histories but does not create agent teams or route categories to teams. Admin must create teams, add agents, and map categories in the UI after seeding.
- Local commit `c73d670` contains the current project, but no Git remote is configured yet. Push/clone via GitHub is pending the repository URL from the user. `.env` and `node_modules` were excluded from the commit.
