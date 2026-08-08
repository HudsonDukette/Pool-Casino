import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId, createSupabasePublicClient } from "./profiles.server";

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
});

export const createProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    const supabase = createSupabasePublicClient();
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
