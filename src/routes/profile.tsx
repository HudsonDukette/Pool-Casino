import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, safeLocaleDate } from "@/lib/utils";
import { ProfileStats, RecentBets, type PublicBet, type PublicProfile } from "./players.$username";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: MyProfilePage,
  head: () => ({
    meta: [
      { title: "My Account | Pool Casino Player Profile" },
      {
        name: "description",
        content:
          "Manage your Pool Casino account: upload a profile picture, change your username and review your betting stats.",
      },
      { property: "og:title", content: "My Account | Pool Casino Player Profile" },
      {
        property: "og:description",
        content: "Your Pool Casino profile, avatar, username and lifetime betting stats.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

function MyProfilePage() {
  const { user, isAuthenticated, loading, refresh } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: isAuthenticated && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bets } = useQuery({
    queryKey: ["my-profile-bets", user?.id],
    enabled: isAuthenticated && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("game_type, bet_amount, payout, multiplier, result, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as PublicBet[];
    },
  });

  const { data: price } = useQuery({
    queryKey: ["username-price"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "username_change_price")
        .maybeSingle();
      return Number(data?.value ?? 5000);
    },
  });

  const renamePrice = price ?? 5000;

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ title: "Image must be under 3MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      await refetchProfile();
      await refresh();
      toast({ title: "Profile picture updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try a different image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRename() {
    const value = newUsername.trim();
    if (!value) return;
    setRenaming(true);
    try {
      const { data, error } = await supabase.rpc("change_username", { _new_username: value });
      if (error) throw error;
      const result = data as { username: string; price: number } | null;
      setNewUsername("");
      await refetchProfile();
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast({
        title: `You're now ${result?.username ?? value}`,
        description: `${formatCurrency(renamePrice)} went into the global pool.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Username not changed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setRenaming(false);
    }
  }

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  if (loading || !user) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-muted-foreground">Loading account…</div>
      </Layout>
    );
  }

  const publicShape: PublicProfile | null = profile
    ? {
        username: profile.username,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        level: profile.level,
        xp: profile.xp,
        total_profit: Number(profile.total_profit),
        biggest_win: Number(profile.biggest_win),
        biggest_bet: Number(profile.biggest_bet),
        games_played: profile.games_played,
        total_wins: profile.total_wins,
        total_losses: profile.total_losses,
        win_streak: profile.win_streak,
        current_streak: profile.current_streak,
        created_at: profile.created_at,
      }
    : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative">
              <PlayerAvatar
                username={profile?.username ?? user.username}
                avatarUrl={profile?.avatar_url}
                className="w-24 h-24"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-primary text-black shadow-lg hover:opacity-90 disabled:opacity-60"
                aria-label="Upload profile picture"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatar}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-3xl font-bold truncate">
                {profile?.username ?? user.username}
              </h1>
              <p className="text-sm text-muted-foreground">
                Balance {formatCurrency(profile?.balance ?? user.balance)} · Joined{" "}
                {safeLocaleDate(profile?.created_at, { month: "long", year: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploading ? "Uploading picture…" : "PNG or JPG, up to 3MB."}
              </p>
            </div>
            {profile ? (
              <Link to="/players/$username" params={{ username: profile.username }}>
                <Button variant="outline">View public profile</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
          <CardContent className="p-6 space-y-3">
            <div>
              <h2 className="font-display font-semibold text-lg">Change username</h2>
              <p className="text-sm text-muted-foreground">
                Costs {formatCurrency(renamePrice)} — the fee goes straight back into the global
                pool.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="New username"
                maxLength={20}
                className="sm:max-w-xs"
              />
              <Button
                variant="neon"
                onClick={handleRename}
                disabled={renaming || newUsername.trim().length < 3}
              >
                {renaming ? "Processing…" : `Pay ${formatCurrency(renamePrice)}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {publicShape ? <ProfileStats profile={publicShape} /> : null}

        <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-white/5 font-display font-semibold">
              Recent bets
            </div>
            <RecentBets bets={bets ?? []} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
