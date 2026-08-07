# Migration Plan: PoolCasino → Lovable Cloud

Source repo: `github.com/HudsonDukette/Pool-Casino` (React/Vite frontend + Express/Socket.IO backend + PostgreSQL/Drizzle).

Goal: Migrate the full casino app into this Lovable TanStack Start project with Lovable Cloud backend. Scope is large, so this is delivered in phases, starting with a playable core.

## Phase 1 — Foundation & Design System

Replace the blank TanStack Start template with the casino shell.

- Migrate `src/styles.css` to the dark casino theme (DM Sans/Syne fonts, neon teal/pink/purple tokens, radial gradients, glass/neon utilities).
- Import fonts via `<link>` in `src/routes/__root.tsx` (no remote `@import` in styles.css).
- Copy the `Layout` component and global navigation from the source frontend.
- Copy the source shadcn UI primitives into `src/components/ui` and reconcile naming with the current template.
- Install frontend dependencies from the source: `framer-motion`, `recharts`, `sonner`, `lucide-react`, `date-fns`, `embla-carousel-react`, `react-hook-form`, `zod`, `@hookform/resolvers`, Radix primitives, etc.
- Create `src/routes/index.tsx` as the casino home page, copying content from `src/pages/home.tsx` and adapting to TanStack Router.
- Set up Lovable Cloud auth (email/password + Google) and wire `src/start.ts` with the bearer-token middleware for protected server functions.
- Create the public `/auth` route and the protected `_authenticated/` layout.

Deliverable: app opens to a styled casino home page, users can sign up/in.

## Phase 2 — Core Database Schema

Map the source Drizzle schema to Supabase tables with RLS and GRANTs.

Create migrations for:

- `public.profiles` (maps to source `users` table): `id uuid primary key references auth.users`, `username unique`, `balance`, `total_profit`, `biggest_win`, `biggest_bet`, `games_played`, `win_streak`, `current_streak`, `total_wins`, `total_losses`, `xp`, `level`, `bio`, `avatar_url`, `created_at`, `updated_at`, `is_admin`.
- `public.global_pool`: `id serial primary key`, `total_amount`, `biggest_win`, `biggest_bet`.
- `public.bets`: `id serial primary key`, `user_id`, `game_type`, `bet_amount`, `payout`, `multiplier`, `result`, `created_at`.
- `public.transactions`: `id serial primary key`, `user_id`, `type`, `amount`, `description`, `created_at`.
- `public.settings`: `key primary key`, `value` (for global config such as min/max bets).

Each `CREATE TABLE` is followed by GRANTs to `authenticated` and `service_role`, then RLS enabled, then policies:

- `profiles`: SELECT/UPDATE for own row; admin SELECT all.
- `global_pool`: SELECT to anon/authenticated (read-only); UPDATE via service role or admin fn.
- `bets`: INSERT/SELECT for own row; admin SELECT all.
- `transactions`: SELECT for own row.

Seed: one `global_pool` row with `1,000,000.00` and demo admin/test users (optional).

Deliverable: database is ready for user balances and game records.

## Phase 3 — User Accounts, Balance, & Global Pool

- `src/lib/users.functions.ts`: create profile on signup, get profile, update profile, get leaderboard.
- `src/lib/pool.functions.ts`: get global pool stats, update pool on bet/payout.
- `src/routes/_authenticated/profile.tsx`: profile page.
- `src/routes/_authenticated/leaderboard.tsx`: leaderboard page.
- Protect authenticated routes under `_authenticated/` and update `src/routes/__root.tsx` with auth-state change invalidation.

Deliverable: signed-in users see their balance, can edit profile, and view the leaderboard.

## Phase 4 — Solo Games MVP

Port the simplest solo games first. Implement each as a TanStack route + a server function for resolution.

Games to port first (server-only random logic, no WebSocket):

1. Coin Flip (1.95x)
2. Dice Roll (exact/high-low)
3. Wheel (multiplier segments)
4. Crash (visual only; server resolves a target multiplier)
5. Roulette (server resolves the spin)

For each game:

- Create `src/routes/games/<game>.tsx` with the copied UI from the source page.
- Create `src/lib/games/<game>.functions.ts` for the bet resolution: validate input, read user balance, deduct bet, generate fair random outcome, update pool, payout, record bet, return result.
- Use `requireSupabaseAuth` middleware and atomic Supabase RPC where possible to avoid race conditions.
- Keep the source game math and pay tables in `src/lib/game-pay-tables.ts`.

Deliverable: five playable solo games with real balance updates and bet history.

## Phase 5 — More Solo Games

Port the remaining solo games in batches of 5-6:

- Blackjack, Plinko, Slots, Mines, High-Low, War, Double Dice, Ladder, Target, Ice Break, Advanced Wheel, Range Bet, Pyramid, Lightning Round.
- New games: Blind Draw, Hidden Path, Jackpot Hunt, Target Hit, Chain Reaction, Timed Safe, Reverse Crash, Countdown Gamble, Card Stack, Power Grid, Elimination Wheel, Combo Builder, Safe Steps, Prediction Chain.

Each follows the same route + server function pattern. More complex games (e.g., Mines multi-step) may need stateful session tracking or a temporary table.

Deliverable: all 34 solo games playable.

## Phase 6 — Multiplayer Migration

Replace the Express Socket.IO multiplayer engine with a Lovable-compatible real-time layer.

Options to evaluate:

- **Supabase Realtime + presence/lobby tables**: best fit for Lovable Cloud.
- **Polling + server functions**: simpler fallback for low-frequency moves.
- Keep WebSocket only if absolutely required via a separate external server (not recommended for Lovable Cloud).

Migrate in order:

1. Lobby/matchmaking tables (`public.mp_lobbies`, `public.mp_players`, `public.mp_matches`).
2. Real-time game state via Realtime broadcasts or short-lived match rows.
3. Port each PvP game: War, Coin Flip, RPS, Dice Battle, High-Low, Number Guess, Reaction, Quick Math, Tug of War, Last Man, Blackjack PvP, Poker, Memory, Speed Click, Card Race, Split or Steal, Risk Dice, Duel Flip, Risk Auction, Quick Draw, Balance Battle.

Deliverable: PvP games playable head-to-head.

## Phase 7 — Player-Owned Casinos & Advanced Features

Port the casino management system:

- Tables: `casinos`, `casino_games_owned`, `casino_bets`, `casino_transactions`, `casino_drinks`, `user_drinks`, `monthly_tax_logs`, `casino_game_odds`.
- Server functions: create casino, buy games, set odds, deposit/withdraw, pause/resume, drinks menu, tax scheduler.
- UI: casinos list, casino hub, editor.
- Optional: chat, friends, money requests, notifications, badges, admin panel, reports.

Deliverable: users can create and run their own casinos.

## Phase 8 — Polish, Testing, & Publishing

- Add head metadata for every route (title, description, OG/Twitter).
- Replace all hardcoded styling with design tokens.
- Add error boundaries and not-found pages.
- Run typecheck and build; fix SSR/client boundaries.
- Test auth flow, game flow, balance updates, and RLS.
- Publish.

Deliverable: production-ready app on Lovable.

## Notes & Risks

- The source uses a custom Express session auth system. It will be replaced by Lovable Cloud auth, which means user IDs change from `serial` to `uuid` referencing `auth.users`. Any foreign keys must be updated accordingly.
- The source uses `socket.io` for multiplayer. On Lovable Cloud the recommended replacement is Supabase Realtime, not a separate WebSocket server.
- Server functions run on Cloudflare Workers; Node-only packages (`bcryptjs` is fine in JS, but `connect-pg-simple`, `node-cron`, `web-push`, `socket.io`) must be replaced or removed. Cron jobs use `pg_cron` + TanStack public routes.
- Numeric values are stored as `numeric` in the source; keep them as `numeric` or `decimal` in Supabase to preserve precision for money.
- This is a large migration. Each phase should be built and verified before the next.
