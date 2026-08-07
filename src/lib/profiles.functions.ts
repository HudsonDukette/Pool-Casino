import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function getAuthenticatedUserId(): Promise<string | null> {
  const authHeader = getRequestHeader("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
});

export const createProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: existing, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existing) {
      return { created: false, message: "Profile already exists" };
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        username: data.username,
      })
      .select()
      .single();
    if (error) throw error;
    return { created: true, profile };
  });
