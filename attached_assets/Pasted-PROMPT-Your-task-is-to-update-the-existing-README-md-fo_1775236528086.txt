PROMPT:

Your task is to update the existing README.md for this project with **full step-by-step instructions** to integrate **GitHub Codespaces, Supabase, Railway, and Vercel** for the multiplayer casino platform. Follow these rules carefully:

1. **Do not modify any existing code**, only add or update README.md content.
2. Include all **Supabase integration steps** provided below.
3. Include **backend deployment on Railway** for the Socket.IO server.
4. Include **frontend deployment on Vercel** using Next.js App Router.
5. Include **GitHub Codespaces setup instructions**.
6. Include **env variables setup** for each service.
7. Include **deployment order** and troubleshooting tips (e.g., CORS, WebSocket, env variables).
8. Include **folder structure** and **connection flow**:
    - Frontend (Next.js) → Vercel
    - Realtime backend (Node.js + Express + Socket.IO) → Railway
    - Database/Auth → Supabase
9. Include **sample socket events** and **API endpoints** for multiplayer functionality.
10. Include optional **local testing instructions** to verify everything works before deploying.

---

## **Supabase Integration Steps to Include**

1. **Install package**
```bash
npm install @supabase/supabase-js
Add files
.env.local
NEXT_PUBLIC_SUPABASE_URL=https://lkcbikijkcdtvaxyypuv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_fh7b3Ykj0z9BYSdDiFMMIw_0r2VTRZL
page.tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
utils/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch { /* ignore server component call */ }
      },
    },
  });
};
utils/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = () => createBrowserClient(supabaseUrl!, supabaseKey!);
utils/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  });

  return supabaseResponse
};
Install Agent Skills (Optional)
npx skills add supabase/agent-skills
Deployment Order to Include in README
Set up Supabase → tables, auth, RLS, badges, logs
Deploy backend Socket.IO server on Railway
Deploy frontend Next.js on Vercel
Connect frontend → backend → Supabase
Verify env variables for each service (.env.local for frontend, .env for backend)
Extra README Sections
Folder structure: /frontend, /backend, /utils/supabase
Sample Socket.IO events: joinQueue, matchFound, playerAction, disconnect
Testing instructions: Run locally with npm run dev for frontend + backend

⚡ Deliverable: Updated README.md that any developer can follow to spin up full stack multiplayer casino with GitHub Codespaces + Supabase + Railway + Vercel. Be super precise and step-by-step.