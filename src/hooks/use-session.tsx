import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureGuest,
  readGuest,
  setGuestBalance,
  subscribeGuest,
  type GuestState,
} from "@/lib/guest";

export type SessionUser = {
  id: string;
  email: string | null;
  username: string;
  balance: number;
  isAdmin: boolean;
  isGuest: boolean;
};

async function loadAuthedUser(): Promise<SessionUser | null> {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (profile) {
    return {
      id: authUser.id,
      email: authUser.email ?? null,
      username: profile.username,
      balance: Number(profile.balance),
      isAdmin: profile.is_admin,
      isGuest: false,
    };
  }

  // Fallback if the signup trigger hasn't created the profile yet.
  const metaUsername = authUser.user_metadata?.["username"] as string | undefined;
  const fallbackUsername =
    metaUsername ?? authUser.email?.split("@")[0] ?? `player_${authUser.id.slice(0, 8)}`;
  const { data: created } = await supabase
    .from("profiles")
    .insert({
      user_id: authUser.id,
      username: fallbackUsername,
      email: authUser.email ?? null,
    })
    .select()
    .maybeSingle();

  return {
    id: authUser.id,
    email: authUser.email ?? null,
    username: created?.username ?? fallbackUsername,
    balance: created ? Number(created.balance) : 0,
    isAdmin: created?.is_admin ?? false,
    isGuest: false,
  };
}

/**
 * Single source of truth for "who is playing": a signed-in account, or a
 * local guest wallet seeded with free tokens.
 */
export function useSession() {
  const [authedUser, setAuthedUser] = React.useState<SessionUser | null>(null);
  const [guest, setGuest] = React.useState<GuestState | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const next = await loadAuthedUser();
    setAuthedUser(next);
    setLoading(false);
    if (!next) setGuest(ensureGuest());
    else setGuest(null);
  }, []);

  React.useEffect(() => {
    setGuest(readGuest());
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  React.useEffect(() => subscribeGuest(() => setGuest(readGuest())), []);

  const user: SessionUser | null = authedUser
    ? authedUser
    : guest
      ? {
          id: "guest",
          email: null,
          username: guest.username,
          balance: guest.balance,
          isAdmin: false,
          isGuest: true,
        }
      : null;

  const updateGuestBalance = React.useCallback((balance: number) => {
    const next = setGuestBalance(balance);
    setGuest(next);
  }, []);

  return {
    user,
    isGuest: !authedUser,
    isAuthenticated: !!authedUser,
    loading,
    refresh,
    updateGuestBalance,
  };
}
