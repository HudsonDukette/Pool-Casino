import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    return data;
  });

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: existing, error: checkError } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existing) {
      return { created: false, message: "Profile already exists" };
    }
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .insert({
        user_id: context.userId,
        username: data.username,
        email: context.claims?.email ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { created: true, profile };
  });
