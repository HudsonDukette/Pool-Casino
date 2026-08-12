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
  isOwner: boolean;
  isGuest: boolean;
  avatarUrl: string | null;
};

export type SessionValue = {
  user: SessionUser | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  updateGuestBalance: (balance: number) => void;
  setBalance: (balance: number) => void;
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
      isAdmin: profile.is_admin || profile.is_owner,
      isOwner: profile.is_owner,
      isGuest: false,
      avatarUrl: profile.avatar_url ?? null,
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
    isAdmin: (created?.is_admin ?? false) || (created?.is_owner ?? false),
    isOwner: created?.is_owner ?? false,
    isGuest: false,
    avatarUrl: created?.avatar_url ?? null,
  };
}

const SessionContext = React.createContext<SessionValue | null>(null);

/**
 * Holds "who is playing" once for the whole app so the signed-in state survives
 * client-side navigation between pages instead of re-resolving on every mount.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
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
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
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
          isOwner: false,
          isGuest: true,
          avatarUrl: null,
        }
      : null;

  const updateGuestBalance = React.useCallback((balance: number) => {
    setGuest(setGuestBalance(balance));
  }, []);

  const setBalance = React.useCallback((balance: number) => {
    setAuthedUser((prev) => (prev ? { ...prev, balance } : prev));
  }, []);

  const value: SessionValue = {
    user,
    isGuest: !authedUser,
    isAuthenticated: !!authedUser,
    loading,
    refresh,
    updateGuestBalance,
    setBalance,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return ctx;
}
