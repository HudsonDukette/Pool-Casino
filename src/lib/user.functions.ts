import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId, createSupabasePublicClient } from "./profiles.server";

export const claimDailyBonus = createServerFn({ method: "POST" }).handler(async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();
  const DAILY_BONUS_AMOUNT = 500;

  // Get current profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profile not found");

  // Check if already claimed today
  const now = new Date();
  const lastClaim = profile.last_daily_claim ? new Date(profile.last_daily_claim) : null;
  const canClaim = !lastClaim || 
    (now.getDate() !== lastClaim.getDate() ||
     now.getMonth() !== lastClaim.getMonth() ||
     now.getFullYear() !== lastClaim.getFullYear());

  if (!canClaim) {
    return { success: false, message: "Already claimed today", balance: profile.balance };
  }

  // Update balance and last claim time
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      balance: profile.balance + DAILY_BONUS_AMOUNT,
      last_daily_claim: now.toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) throw updateError;

  return { success: true, message: "Daily bonus claimed!", balance: updated.balance, amount: DAILY_BONUS_AMOUNT };
});