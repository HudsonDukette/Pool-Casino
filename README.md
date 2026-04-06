# PoolCasino

A full-stack browser casino where every bet affects a shared global pool. Built with React + Vite (frontend), Express + Socket.IO (API + real-time multiplayer), and PostgreSQL (Drizzle ORM).

---

## Table of Contents

1. [Games — 34 Total](#games--34-total)
2. [Player-Owned Casinos](#player-owned-casinos)
3. [Project Structure](#project-structure)
4. [Connection Flow](#connection-flow)
5. [GitHub Codespaces Setup](#github-codespaces-setup)
6. [Supabase — Database Setup](#1-supabase--database-setup)
7. [Supabase Client Integration](#2-supabase-client-integration)
8. [Environment Variables](#3-environment-variables)
9. [Local Development](#4-local-development)
10. [Deploy the API Server to Railway](#5-deploy-the-api-server-to-railway)
11. [Deploy the Frontend to Vercel](#6-deploy-the-frontend-to-vercel)
12. [Connecting Frontend to API](#7-connecting-frontend-to-api)
13. [Multiplayer Socket Events](#8-multiplayer-socket-events)
14. [API Endpoints Reference](#9-api-endpoints-reference)
15. [VAPID Keys — Push Notifications](#10-vapid-keys--push-notifications)
16. [Admin Access](#11-admin-access)
17. [Schema Changes](#12-schema-changes)
18. [Troubleshooting](#13-troubleshooting)
19. [Deployment Checklist](#14-deployment-checklist)

---

## Games — 34 Total

### Solo Games (20)
Classic house-vs-player games that use the global shared pool:

| Game | Description |
|------|-------------|
| Neon Roulette | Classic red/black with dynamic odds based on the global pool |
| Drop Plinko | Physics ball through pegs — pick your risk level |
| Blackjack | Hit or stand vs. the dealer. Blackjack pays 2.5× |
| Crash | Watch the multiplier climb and cash out before it crashes |
| Neon Slots | Match 3 reels — sevens pay 20×, diamonds 10× |
| Dice Roll | Guess exact (5×) or high/low (1.9×) |
| Coin Flip | Pick heads or tails — 1.95× |
| Fortune Wheel | Spin for multipliers from 0.2× to 10× |
| Number Guess | Guess a number 1–10 — correct pays 8× |
| Mines | Pick tiles on a grid while dodging hidden mines |
| High-Low | Guess the second card — consecutive streaks add up |
| Double Dice | Bet on sum ranges of two dice |
| Risk Ladder | Climb rungs for bigger payouts — one mistake loses it all |
| War | Draw a card — beat the dealer to win |
| Ice Break | Click the cracking ice before it breaks |
| Advanced Wheel | More segments, more strategy |
| Target Multiplier | Land on the exact target segment for max payout |
| Range Bet | Bet on a number range across a rolling die |
| Pyramid | Choose your row — top row pays the most |
| Lightning Round | Speed-round multiplier surprises |

### New Solo Games (14)
Extra fast-paced solo games with AI-generated banner art:

| Game | Description |
|------|-------------|
| Blind Draw | Draw a mystery face-down card — pure fate |
| Hidden Path | Navigate 3 hidden forks — all safe = 8× |
| Jackpot Hunt | Open 1 of 5 boxes — one holds a 10× jackpot |
| Target Hit | Click the moving target for up to 5× payout |
| Chain Reaction | Win streaks chain multipliers — cash out before you bust |
| Timed Safe | Safe opens over 10 seconds — cash out early or wait |
| Reverse Crash | Multiplier falls from 10× — cash out before it collapses |
| Countdown Gamble | Multiplier grows as timer ticks — cash out before zero |
| Card Stack | Draw cards without going over 21 — push your luck |
| Power Grid | Pick tiles on a 4×4 grid — hit a trap and lose all |
| Elimination Wheel | Each spin removes the worst segment — last one wins big |
| Combo Builder | Win streaks stack your combo — one loss resets to zero |
| Safe Steps | Step forward for higher rewards — each step raises fail risk |
| Prediction Chain | Predict 3 coin flips in a row — all correct = 6.5× |

### PvP Multiplayer Games (21)
Real-time head-to-head via WebSocket. Winner takes the pot — no house edge:

**Original 15:** War, High-Low, Coin Flip, RPS, Dice Battle, Blackjack PvP, Poker, Memory, Speed Click, Number Guess, Reaction, Tug of War, Quick Math, Card Race, Last Man

**New 6:** Split or Steal, Risk Dice, Duel Flip, Risk Auction, Quick Draw, Balance Battle

---

## Player-Owned Casinos

Users can create their own casinos and invite other players to gamble in them. Casino owners get:
- Full control over games offered (purchase from a library of 32 solo games)
- Custom payout multipliers per game (0.5× to 2.0×)
- Enable/disable games per casino
- Custom name, description, emoji, and drag-and-drop banner image
- Bar menu — sell virtual drinks for chips
- Bankroll management — deposit and withdraw from your casino pool
- Pause/resume your casino at any time
- Real-time stats: profit, house edge, bankroll trend chart, transaction history
- Monthly tax to keep the economy balanced

---

## Project Structure

```
/
├── artifacts/
│   ├── pool-casino/            # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/          # Game pages, hub, admin
│   │   │   ├── components/     # Shared UI components
│   │   │   └── utils/          # API helpers, socket client
│   │   └── vite.config.ts
│   └── api-server/             # Express + Socket.IO API server
│       ├── src/
│       │   ├── routes/         # REST API route handlers
│       │   ├── multiplayer/    # Socket.IO PvP game engines
│       │   └── lib/            # Gambling logic, push, scheduler
│       └── build.mjs
├── lib/
│   ├── db/                     # Drizzle ORM schema + client (@workspace/db)
│   ├── api-zod/                # Shared Zod types + validators (@workspace/api-zod)
│   ├── api-client-react/       # Generated API client for the frontend
│   └── api-spec/               # OpenAPI spec + Orval codegen config
└── pnpm-workspace.yaml
```

---

## Connection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│                                                             │
│   React + Vite Frontend  ─── deployed on ──▶  Vercel       │
│         │                                                   │
│         │  REST API calls (HTTPS)                           │
│         │  WebSocket (Socket.IO)                            │
│         ▼                                                   │
│   Express + Socket.IO API ─ deployed on ──▶  Railway       │
│         │                                                   │
│         │  SQL (pg / Drizzle ORM)                           │
│         ▼                                                   │
│   PostgreSQL Database ──── hosted on ──────▶  Supabase     │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Tech | Hosting |
|-------|------|---------|
| Frontend | React 19 + Vite + Tailwind | Vercel |
| Backend | Express 5 + Socket.IO | Railway |
| Database | PostgreSQL + Drizzle ORM | Supabase |
| Auth | express-session + bcryptjs | Stored in Supabase `session` table |
| Realtime | Socket.IO over Railway's persistent connections | Railway |

---

## GitHub Codespaces Setup

GitHub Codespaces gives you a full cloud development environment with zero local setup.

### Step 1 — Open in Codespaces

1. Go to your repository on GitHub.
2. Click the green **Code** button → **Codespaces** tab → **Create codespace on main**.
3. Wait for the container to build (roughly 2–3 minutes on first launch).

### Step 2 — Install dependencies

Once the terminal opens inside Codespaces:

```bash
# Install all workspace packages from the repo root
pnpm install
```

### Step 3 — Configure environment variables

```bash
# API server env
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Edit and fill in DATABASE_URL, SESSION_SECRET, VAPID keys
nano artifacts/api-server/.env

# Frontend env
cp artifacts/pool-casino/.env.example artifacts/pool-casino/.env
# Set VITE_API_URL to the forwarded Codespaces URL for the API port
nano artifacts/pool-casino/.env
```

### Step 4 — Start the services

Open two terminals in Codespaces:

**Terminal 1 — API server:**
```bash
cd artifacts/api-server
pnpm dev
# Listens on port 8080
```

**Terminal 2 — Frontend:**
```bash
cd artifacts/pool-casino
pnpm dev
# Listens on port 23507 (or whatever PORT is assigned)
```

### Step 5 — Forward ports

Codespaces automatically detects open ports. In the **Ports** panel (bottom of VS Code):

1. Find the API port (8080) — right-click → **Port Visibility** → **Public**.
2. Find the frontend port — right-click → **Port Visibility** → **Public**.
3. Copy the forwarded HTTPS URL for port 8080.
4. Update `VITE_API_URL` in `artifacts/pool-casino/.env` to that URL.
5. Restart the frontend dev server.

> **Tip**: Codespaces URLs look like `https://your-codespace-name-8080.preview.app.github.dev`.

---

## 1. Supabase — Database Setup

### 1a. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. Choose a region close to where you will host the API server (Railway's default is US East).
3. Once the project is ready, go to **Settings → Database** and copy the **Connection string (URI)**:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Append `?sslmode=require` to the end:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```
   This is your `DATABASE_URL`. Keep it safe.

### 1b. Run the database schema

Go to **Supabase Dashboard → SQL Editor** and run the following SQL blocks in order.

**Block 1 — Core tables:**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  balance NUMERIC(25, 2) NOT NULL DEFAULT 10000.00,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  avatar_url TEXT,
  total_profit NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  biggest_win NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  biggest_bet NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  games_played TEXT NOT NULL DEFAULT '0',
  win_streak TEXT NOT NULL DEFAULT '0',
  current_streak TEXT NOT NULL DEFAULT '0',
  total_wins TEXT NOT NULL DEFAULT '0',
  total_losses TEXT NOT NULL DEFAULT '0',
  last_daily_claim TIMESTAMPTZ,
  last_bet_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crazy_games_user_id TEXT UNIQUE,
  is_crazy_games_linked BOOLEAN NOT NULL DEFAULT false,
  device_id TEXT UNIQUE,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  suspended_until TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  permanently_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT
);

CREATE TABLE IF NOT EXISTS pool (
  id SERIAL PRIMARY KEY,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
  biggest_win NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  biggest_bet NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS bets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_type TEXT NOT NULL,
  bet_amount NUMERIC(15, 2) NOT NULL,
  result TEXT NOT NULL,
  payout NUMERIC(15, 2) NOT NULL,
  multiplier NUMERIC(10, 4),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_admin_broadcast BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS money_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ban_appeals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER
);
```

**Block 2 — Session table (required for login):**

```sql
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
```

**Block 3 — Money ledger (money supply audit):**

```sql
CREATE TABLE IF NOT EXISTS money_ledger (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount NUMERIC(25, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Block 4 — Multiplayer tables:**

```sql
CREATE TABLE IF NOT EXISTS multiplayer_queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  bet_amount NUMERIC(15, 2) NOT NULL,
  socket_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  game_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bet_amount NUMERIC(15, 2) NOT NULL,
  winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_players (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS match_rounds (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  game_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Block 5 — Badges and challenges:**

```sql
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value NUMERIC(25, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS monthly_challenges (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_value NUMERIC(25, 2) NOT NULL,
  reward_amount NUMERIC(25, 2) NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_monthly_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES monthly_challenges(id) ON DELETE CASCADE,
  current_value NUMERIC(25, 2) NOT NULL DEFAULT 0,
  claimed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);
```

**Block 6 — Player-owned casino tables:**

```sql
CREATE TABLE IF NOT EXISTS casinos (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🏦',
  image_url TEXT,
  bankroll NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  min_bet NUMERIC(15, 2) NOT NULL DEFAULT 100.00,
  max_bet NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  purchase_price NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  insolvency_winner_id INTEGER REFERENCES users(id),
  insolvency_debt_amount NUMERIC(25, 2),
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_wagered NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  total_paid_out NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  cheap_storage_level INTEGER NOT NULL DEFAULT 0,
  standard_storage_level INTEGER NOT NULL DEFAULT 0,
  expensive_storage_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_games_owned (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  game_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_bets (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_type TEXT NOT NULL,
  bet_amount NUMERIC(15, 2) NOT NULL,
  result TEXT NOT NULL,
  payout NUMERIC(15, 2) NOT NULL,
  multiplier NUMERIC(10, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_transactions (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  type TEXT NOT NULL,
  amount NUMERIC(25, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_drinks (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🍹',
  price NUMERIC(15, 2) NOT NULL DEFAULT 500.00,
  tier TEXT NOT NULL DEFAULT 'standard',
  is_available BOOLEAN NOT NULL DEFAULT false,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_drinks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  drink_id INTEGER NOT NULL REFERENCES casino_drinks(id),
  drink_name TEXT NOT NULL,
  drink_emoji TEXT NOT NULL,
  drink_price NUMERIC(15, 2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_tax_logs (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  tax_amount NUMERIC(25, 2) NOT NULL,
  bankroll_before NUMERIC(25, 2) NOT NULL,
  bankroll_after NUMERIC(25, 2) NOT NULL,
  taxed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_game_odds (
  id SERIAL PRIMARY KEY,
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  game_type TEXT NOT NULL,
  payout_multiplier NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
  pay_table_config TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Block 7 — Seed data:**

```sql
-- Seed the house pool with $1,000,000
INSERT INTO pool (total_amount, biggest_win, biggest_bet)
VALUES (1000000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Log the initial pool creation in the money ledger
INSERT INTO money_ledger (event_type, direction, amount, description)
VALUES ('system_init', 'in', 1000000.00, 'Initial pool seeded with $1,000,000 at database creation')
ON CONFLICT DO NOTHING;

-- Seed default chat rooms
INSERT INTO chat_rooms (name, type) VALUES ('General', 'public') ON CONFLICT DO NOTHING;
```

---

## 2. Supabase Client Integration

This section shows how to wire up the Supabase JS client if you want to use Supabase Auth or Realtime subscriptions in addition to the existing session-based auth.

> **Note:** The existing PoolCasino app uses Express session auth and connects to Postgres directly via Drizzle ORM. The code below is for teams who want to layer Supabase Auth or Supabase Realtime on top.

### Install the package

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Environment variables (frontend)

Add to `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://lkcbikijkcdtvaxyypuv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_fh7b3Ykj0z9BYSdDiFMMIw_0r2VTRZL
```

### File: `utils/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch { /* ignore server component call */ }
      },
    },
  });
};
```

### File: `utils/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = () => createBrowserClient(supabaseUrl!, supabaseKey!);
```

### File: `utils/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  return supabaseResponse;
};
```

### Example usage in a server component (`page.tsx`)

```typescript
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: users } = await supabase.from('users').select('id, username, balance')

  return (
    <ul>
      {users?.map((user) => (
        <li key={user.id}>{user.username} — ${user.balance}</li>
      ))}
    </ul>
  )
}
```

### Install Agent Skills (optional)

```bash
npx skills add supabase/agent-skills
```

---

## 3. Environment Variables

### API Server (`artifacts/api-server/.env`)

```env
# PostgreSQL — from Supabase Settings → Database → Connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require

# Random string — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=replace_with_a_long_random_string

# Push notifications (optional)
# Generate with: npx web-push generate-vapid-keys
VAPID_EMAIL=mailto:you@example.com
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Server port (Railway sets this automatically; override only for local dev)
PORT=8080
```

### Frontend (`artifacts/pool-casino/.env`)

```env
# URL of the deployed API server (no trailing slash)
# Local: http://localhost:8080
# Production: https://your-api.up.railway.app
VITE_API_URL=http://localhost:8080

# Set by Replit / Vite automatically; only override if needed
PORT=23507
BASE_PATH=/
```

### Frontend — Supabase extras (if using Supabase client directly)

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
```

---

## 4. Local Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| PostgreSQL | via Supabase | See section 1 |

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-org/poolcasino.git
cd poolcasino

# 2. Install all workspace packages
pnpm install

# 3. Set up environment files
cp artifacts/api-server/.env.example artifacts/api-server/.env
cp artifacts/pool-casino/.env.example artifacts/pool-casino/.env
# Edit both files with your Supabase DATABASE_URL and secrets

# 4. Start the API server (Terminal 1)
cd artifacts/api-server
pnpm dev
# Server ready at http://localhost:8080

# 5. Start the frontend (Terminal 2)
cd artifacts/pool-casino
pnpm dev
# Frontend at http://localhost:23507
```

Open http://localhost:23507 in your browser. The pool balance should show $1,000,000.00.

### Verify the connection

```bash
# Check the pool endpoint
curl http://localhost:8080/api/pool
# Expected: {"totalAmount":1000000,"biggestWin":0,"biggestBet":0,...}

# Check money supply audit (admin only)
curl http://localhost:8080/api/admin/money-supply
```

---

## 5. Deploy the API Server to Railway

Railway keeps the Express + Socket.IO server running as a persistent process, which is required for WebSocket connections.

### Step-by-step

1. Push your code to a GitHub repository.
2. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**.
3. Select your repository.
4. Set the **Root Directory** to `artifacts/api-server`.
5. Railway will detect the `pnpm build` and `pnpm start` scripts automatically.
6. Go to the **Variables** tab and add:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `SESSION_SECRET` | A long random string |
   | `VAPID_EMAIL` | `mailto:you@example.com` |
   | `VAPID_PUBLIC_KEY` | Your VAPID public key |
   | `VAPID_PRIVATE_KEY` | Your VAPID private key |
   | `PORT` | `8080` (Railway auto-sets this but it's good to be explicit) |

7. Click **Deploy**. Railway will build and start the server.
8. Copy the generated Railway public URL (e.g. `https://poolcasino-api.up.railway.app`).

### WebSocket on Railway

Railway supports persistent TCP connections out of the box — no extra configuration is needed for Socket.IO. The frontend connects using:

```javascript
import { io } from "socket.io-client";
const socket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});
```

### CORS configuration

The API server's CORS origin must include your Vercel frontend URL. Set `ALLOWED_ORIGIN` in the API server environment to the exact origin of your Vercel frontend:

```env
ALLOWED_ORIGIN=https://your-frontend.vercel.app
```

---

## 6. Deploy the Frontend to Vercel

### Via Vercel Dashboard

1. Go to https://vercel.com → **Add New Project** → Import your GitHub repo.
2. Set **Root Directory** to `artifacts/pool-casino`.
3. Framework preset: **Vite**.
4. Build command: `pnpm build`
5. Output directory: `dist/public`
6. Add these environment variables:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your Railway API URL (e.g. `https://poolcasino-api.up.railway.app`) |
   | `BASE_PATH` | `/` |

7. Click **Deploy**.

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# From repo root, build the frontend
cd artifacts/pool-casino
pnpm build

# Deploy
vercel --cwd artifacts/pool-casino \
  --env VITE_API_URL=https://your-api.up.railway.app \
  --prod
```

---

## 7. Connecting Frontend to API

The frontend reads `VITE_API_URL` at build time. All REST calls go through the shared API client in `lib/api-client-react/src/custom-fetch.ts`.

```typescript
// Set the base URL at app startup (src/main.tsx)
import { setBaseUrl } from "@workspace/api-client-react";
setBaseUrl(import.meta.env.VITE_API_URL ?? "");
```

The Socket.IO client connects in the multiplayer context:

```typescript
// artifacts/pool-casino/src/context/SocketContext.tsx
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true,          // sends the session cookie
  transports: ["websocket", "polling"],
});
```

### Deployment order

Follow this order to avoid broken references:

1. **Set up Supabase** — run all SQL blocks, confirm pool row exists.
2. **Deploy API to Railway** — add all env vars, verify `/api/pool` returns 200.
3. **Deploy frontend to Vercel** — set `VITE_API_URL` to the Railway URL, verify the app loads.
4. **Verify end-to-end** — register an account, play a game, confirm balance changes.

---

## 8. Multiplayer Socket Events

The Socket.IO server at `artifacts/api-server/src/multiplayer/` handles all PvP games.

### Client → Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `joinQueue` | `{ gameType, betAmount }` | Join the matchmaking queue for a game |
| `leaveQueue` | `{ gameType }` | Leave the queue before a match is found |
| `acceptMatch` | `{ matchId }` | Accept a found match within 10 seconds |
| `playerAction` | `{ matchId, action, data }` | Send a move/action during a game |
| `disconnect` | — | Auto-handled; opponent wins if mid-game |

### Server → Client events

| Event | Payload | Description |
|-------|---------|-------------|
| `queueJoined` | `{ gameType, betAmount }` | Confirmed entry into the queue |
| `matchFound` | `{ matchId, opponent, gameType, betAmount }` | A match was found — accept within 10s |
| `matchStart` | `{ matchId, gameState }` | Both players accepted; game begins |
| `gameUpdate` | `{ matchId, gameState, lastAction }` | State after a player action |
| `matchEnd` | `{ matchId, winnerId, payout, finalState }` | Game over; winner receives payout |
| `opponentDisconnected` | `{ matchId }` | Opponent dropped — you win |
| `error` | `{ message }` | Something went wrong |

### Example client usage

```typescript
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

// Join the queue
socket.emit("joinQueue", { gameType: "coinflip", betAmount: 1000 });

// Wait for a match
socket.on("matchFound", ({ matchId, opponent }) => {
  console.log(`Match found vs ${opponent.username}! Match ID: ${matchId}`);
  socket.emit("acceptMatch", { matchId });
});

// Game starts
socket.on("matchStart", ({ matchId, gameState }) => {
  console.log("Game started!", gameState);
});

// Send a move
socket.emit("playerAction", {
  matchId: "abc123",
  action: "pick",
  data: { choice: "heads" },
});

// Game ends
socket.on("matchEnd", ({ winnerId, payout }) => {
  const won = winnerId === myUserId;
  console.log(won ? `You won $${payout}!` : "You lost.");
});
```

---

## 9. API Endpoints Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create account (10,000 starting balance) |
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/guest/init` | Create/resume guest session |
| `POST` | `/api/auth/crazygames` | Login via CrazyGames JWT |

### User

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/user/stats` | Profit, streaks, games played |
| `POST` | `/api/user/claim-daily` | Claim $500 daily reward |
| `GET` | `/api/user/public/:username` | Public profile |
| `POST` | `/api/user/change-username` | Change username (costs chips, routes fee to pool) |
| `POST` | `/api/user/change-avatar` | Change avatar (costs chips, routes fee to pool) |

### Economy

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pool` | Global pool balance + stats |
| `GET` | `/api/transactions` | Bet history |
| `POST` | `/api/transfer` | Transfer chips to another player |
| `POST` | `/api/money-request` | Request funds from admin |

### Games

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/games/roulette` | Neon Roulette |
| `POST` | `/api/games/plinko` | Drop Plinko |
| `POST` | `/api/games/blackjack/deal` | Start Blackjack |
| `POST` | `/api/games/blackjack/action` | Hit or Stand |
| `POST` | `/api/games/crash` | Crash |
| `POST` | `/api/games/slots` | Neon Slots |
| `POST` | `/api/games/coinflip` | Coin Flip |
| `POST` | `/api/games/dice` | Dice Roll |
| `POST` | `/api/games/wheel` | Fortune Wheel |
| `POST` | `/api/games/mines` | Mines |
| `POST` | `/api/games/ladder/start\|step\|cashout` | Risk Ladder |
| `... + 20 more` | `/api/games/*` | All other solo games |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/money-supply` | Full money supply audit + ledger |
| `POST` | `/api/admin/refill-pool` | Inject money into the pool |
| `POST` | `/api/admin/refill-player` | Give chips to a player |
| `POST` | `/api/admin/reset-all-balances` | Reset all non-admin balances |
| `POST` | `/api/admin/seize` | Take chips from a player |
| `GET` | `/api/admin/players` | List all players |
| `DELETE` | `/api/admin/user/:id` | Delete account (balance returned to pool) |
| `DELETE` | `/api/admin/guests` | Purge all guest accounts (balances returned) |
| `GET` | `/api/admin/money-requests` | Pending money requests |
| `POST` | `/api/admin/money-requests/:id/fulfill` | Fulfill a money request |
| `POST` | `/api/admin/owner/reset` | Full server reset (owner only) |

---

## 10. VAPID Keys — Push Notifications

Push notifications are optional. To enable them:

```bash
npx web-push generate-vapid-keys
```

Copy the output into your API server environment variables:

```env
VAPID_EMAIL=mailto:you@example.com
VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The frontend does not need the private key.

---

## 11. Admin Access

To promote a user to admin, run in Supabase SQL Editor after the account is registered:

```sql
UPDATE users SET is_admin = true WHERE username = 'your_username';
```

To make someone the owner (who can reset the entire database):

```sql
UPDATE users SET is_owner = true, is_admin = true WHERE username = 'your_username';
```

---

## 12. Schema Changes

If you modify the Drizzle schema in `lib/db/src/schema/`, sync it to Supabase:

```bash
# From repo root — uses DATABASE_URL from your environment
pnpm --filter @workspace/db run push

# If there are column conflicts, use force (drops and recreates columns safely)
pnpm --filter @workspace/db run push-force
```

---

## 13. Troubleshooting

### CORS errors in the browser console

The API server must allow the frontend's origin. Set `ALLOWED_ORIGIN` in the API server environment:

```env
ALLOWED_ORIGIN=https://your-frontend.vercel.app
```

If using Railway, check that the Railway URL is not blocked by a Vercel firewall rule.

### WebSocket connection fails on Vercel/Railway

Vercel is a serverless platform and does **not** support persistent WebSocket connections. Always host the Express + Socket.IO server on Railway, Render, or Fly.io. Make sure `transports: ["websocket", "polling"]` is set on the client so it can fall back to long-polling if WebSocket is temporarily unavailable.

### Session cookie not sent cross-origin

When the frontend (Vercel) and API (Railway) are on different domains, you must:

1. Set `credentials: "include"` on all fetch calls (the API client does this by default).
2. Set `withCredentials: true` on the Socket.IO client.
3. Configure the API server's session cookie with `sameSite: "none"` and `secure: true` when running in production.

### `relation "session" does not exist`

Run Block 2 of the SQL in Supabase SQL Editor to create the session table.

### Pool balance not showing / 500 errors on `/api/pool`

Run Block 7 of the SQL to seed the pool row. The pool table must have exactly one row.

### `DATABASE_URL must be set` on startup

The API server will refuse to start without a `DATABASE_URL`. Check that:
- The `.env` file exists in `artifacts/api-server/`
- Railway has the `DATABASE_URL` variable set in the Variables tab
- The URL ends with `?sslmode=require` for Supabase

### Money supply discrepancy shows a non-zero number

Check `GET /api/admin/money-supply`. A non-zero `discrepancy` field means some money was created or destroyed outside the tracked events. Common causes:
- Manual SQL edits to `users.balance` or `pool.total_amount` without a ledger entry
- A route that was modified but doesn't yet call `addLedgerEntry`
- Data imported from before the ledger system was introduced

Fix by adding a manual ledger entry to account for the difference:

```sql
INSERT INTO money_ledger (event_type, direction, amount, description)
VALUES ('manual_adjustment', 'in', 12345.00, 'Manual correction for pre-ledger data');
```

---

## 14. Deployment Checklist

Follow this order exactly:

- [ ] **Supabase**: Project created, `DATABASE_URL` copied
- [ ] **Supabase SQL**: All 7 SQL blocks executed in order
- [ ] **Supabase SQL**: Pool row confirmed (`SELECT * FROM pool` returns 1 row)
- [ ] **API env**: `artifacts/api-server/.env` created with `DATABASE_URL` and `SESSION_SECRET`
- [ ] **Frontend env**: `artifacts/pool-casino/.env` created with `VITE_API_URL=http://localhost:8080`
- [ ] **Local test**: `pnpm dev` in both directories; pool shows $1,000,000.00
- [ ] **Railway**: Project created, root dir set to `artifacts/api-server`, env vars added, deployed
- [ ] **Railway test**: `curl https://your-api.up.railway.app/api/pool` returns 200
- [ ] **Vercel**: Project created, root dir set to `artifacts/pool-casino`, `VITE_API_URL` set to Railway URL, deployed
- [ ] **Vercel test**: Frontend loads, pool balance shows, registration works
- [ ] **Admin**: First account promoted via SQL `UPDATE users SET is_admin = true WHERE username = '...'`
- [ ] **Push notifications** (optional): VAPID keys generated and added to Railway env vars
