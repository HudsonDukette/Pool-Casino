import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId, createSupabasePublicClient } from "./profiles.server";

export const claimDailyBonus = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, message: "Not authenticated", balance: 0 };
    }

    const supabase = createSupabasePublicClient();
    const DAILY_BONUS_AMOUNT = 500;

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return { success: false, message: "Failed to fetch profile", balance: 0 };
    }
    if (!profile) {
      return { success: false, message: "Profile not found", balance: 0 };
    }

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

    if (updateError) {
      console.error("Profile update error:", updateError);
      return { success: false, message: "Failed to update profile", balance: profile.balance };
    }

    return { success: true, message: "Daily bonus claimed!", balance: updated.balance, amount: DAILY_BONUS_AMOUNT };
  } catch (error) {
    console.error("claimDailyBonus error:", error);
    return { success: false, message: "An error occurred", balance: 0 };
  }
});