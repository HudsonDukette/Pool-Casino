# Workspace

## Overview

PoolCasino - a full-stack fake-money casino simulator with a shared global pool economy. Users can gamble fake money, compete on leaderboards, and track their stats.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + framer-motion
- **Auth**: express-session + bcryptjs

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pool-casino/        # React casino frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Features

1. **Authentication**: Register/login/logout with username + password; CrazyGames SDK v3 platform-aware login; guest mode with per-device tracking + merge on login
2. **Global Pool Economy**: $1M starting pool shared by all players; wins drain it, losses fill it
3. **Dynamic Betting Odds**: Win probability scales with bet size relative to pool
4. **10 Games**: Roulette, Plinko (multi-ball), Blackjack, Crash, Slots, Dice Roll, Coin Flip, Fortune Wheel, Number Guess, Mines
5. **Referral Codes**: Unique 8-char codes; new users +$20K, referrers +$10K
6. **Profile Customization**: Avatar URL + username change (both cost coins, admin-configurable)
7. **Player Stats**: Profit/loss, biggest win/bet, win streak, games played, transactions
8. **Leaderboards**: Richest players, biggest winners, high rollers — each row has a flag/report button; usernames link to player profiles
9. **Player Profiles**: Public profile pages at `/player/:username` showing stats + report button
10. **Daily Rewards**: $500 daily claim, balance refill option
11. **Real-time Chat**: Rooms (general, game-specific, DMs) with admin broadcast messages as golden banners
12. **Friends System**: Send/accept/remove friends with push notifications
13. **Money Request Inbox**: Players request funds from admin; admin reviews in panel
14. **Notifications**: In-app bell + browser push notifications (VAPID)
15. **Report System**: Players can report others from leaderboard or profile page; admins review with chat history viewer
16. **Admin Panel** (collapsable sections): Game controls, Economy (refill/seize/reset), Balance adjustment, User Management (change username/avatar, suspend/ban/perma-ban/unban/delete), Reports inbox, Broadcast, Money requests, Settings

## Database Tables

- `users` - accounts with balance, stats, last_daily_claim, suspendedUntil, bannedUntil, permanentlyBanned
- `pool` - single-row global pool with biggest win/bet tracking
- `bets` - full bet transaction history
- `chat_rooms` - general + game rooms + DM rooms
- `chat_messages` - all messages with room association
- `friends` - friend relationships
- `money_requests` - player money requests for admin
- `settings` - admin-configurable settings (username/avatar costs, disabled games)
- `push_subscriptions` - web push subscriptions per user
- `reports` - player reports (reporter, reported, reason, details, status)

## API Routes

- `POST /api/auth/register` - create account
- `POST /api/auth/login` - login
- `POST /api/auth/logout` - logout
- `GET /api/auth/me` - current user
- `POST /api/auth/crazygames` - login/register via CrazyGames JWT token (RS256, pubkey fetched from CrazyGames CDN)
- `GET /api/user/stats` - user statistics
- `POST /api/user/claim-daily` - daily reward
- `GET /api/pool` - global pool info
- `POST /api/games/roulette` - play roulette
- `POST /api/games/plinko` - play plinko
- `POST /api/games/dice` - dice roll (exact 5x, high/low 1.9x)
- `POST /api/games/coinflip` - coin flip (1.95x)
- `POST /api/games/crash` - crash (auto-cashout target)
- `POST /api/games/slots` - 3-reel slots (up to 20x)
- `POST /api/games/wheel` - fortune wheel (0.2x–10x)
- `POST /api/games/guess` - number guess 1–100 (up to 50x)
- `POST /api/games/mines` - minesweeper grid (multiplier by reveals)
- `POST /api/games/blackjack/deal` - start blackjack hand
- `POST /api/games/blackjack/action` - hit or stand
- `GET /api/transactions` - bet history
- `GET /api/leaderboard/richest` - richest players
- `GET /api/leaderboard/biggest-winners` - biggest single wins
- `GET /api/leaderboard/biggest-bettors` - total bet leaderboard
- `GET /api/leaderboard/recent-big-wins` - recent large wins
- `GET /api/user/public/:username` - public player profile
- `POST /api/reports` - submit a player report (by userId or username)
- `GET /api/admin/reports` - list all reports (admin)
- `POST /api/admin/reports/:id/status` - mark report reviewed/dismissed (admin)
- `GET /api/admin/user/:id/chats` - view user's chat history (admin)
- `POST /api/admin/user/:id/change-username` - force username change (admin)
- `POST /api/admin/user/:id/change-avatar` - force avatar change/remove (admin)
- `POST /api/admin/user/:id/suspend` - suspend user for N hours (admin)
- `POST /api/admin/user/:id/ban` - ban user for N hours (admin)
- `POST /api/admin/user/:id/perma-ban` - permanently ban (admin)
- `POST /api/admin/user/:id/unban` - lift all bans (admin)
- `DELETE /api/admin/user/:id` - delete account (admin)
- `GET /api/admin/money-requests` - list money requests (admin)
- `POST /api/vapid-key` - get VAPID public key
- `POST /api/push/subscribe` - subscribe to push notifications
- `POST /api/push/unsubscribe` - unsubscribe from push notifications

## Gambling Logic

Win probability: `winChance = max(0.0001, min(0.9999, 1 - (betAmount/poolTotal * 10)^0.4))`
- ~99.99% at $0.01
- ~80% at $10
- ~50% at $100
- ~10% at $1,000
- ~0.01% at $10,000

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Run `pnpm run typecheck` from root.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
