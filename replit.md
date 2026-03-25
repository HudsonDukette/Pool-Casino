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

1. **Authentication**: Register/login/logout with username + password, sessions via cookies
2. **Global Pool Economy**: $1M starting pool shared by all players; wins drain it, losses fill it
3. **Dynamic Betting Odds**: Win probability scales with bet size relative to pool
4. **Roulette Game**: Red/Black with animated wheel, dynamic odds
5. **Plinko Game**: Ball drop with risk levels (low/medium/high), multiplier slots
6. **Coming Soon Placeholders**: Blackjack, Slots, Coin Flip, Crash Game
7. **Player Stats**: Profit/loss, biggest win/bet, win streak, games played
8. **Transaction History**: Full bet history with game filters
9. **Leaderboards**: Richest players, biggest winners, biggest bettors
10. **Daily Rewards**: $500 daily claim, balance refill option

## Database Tables

- `users` - accounts with balance, stats, last_daily_claim
- `pool` - single-row global pool with biggest win/bet tracking
- `bets` - full bet transaction history

## API Routes

- `POST /api/auth/register` - create account
- `POST /api/auth/login` - login
- `POST /api/auth/logout` - logout
- `GET /api/auth/me` - current user
- `GET /api/user/stats` - user statistics
- `POST /api/user/claim-daily` - daily reward
- `GET /api/pool` - global pool info
- `POST /api/games/roulette` - play roulette
- `POST /api/games/plinko` - play plinko
- `GET /api/transactions` - bet history
- `GET /api/leaderboard/richest` - richest players
- `GET /api/leaderboard/biggest-winners` - biggest single wins
- `GET /api/leaderboard/biggest-bettors` - total bet leaderboard
- `GET /api/leaderboard/recent-big-wins` - recent large wins

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
