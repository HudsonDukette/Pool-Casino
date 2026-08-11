import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, safeLocaleDate } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/players/$username")({
  component: PlayerPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Player Profile | Pool Casino` },
      {
        name: "description",
        content: `View ${params.username}'s Pool Casino stats: profit, biggest win, win rate and recent bets.`,
      },
      { property: "og:title", content: `${params.username} — Player Profile | Pool Casino` },
      {
        property: "og:description",
        content: `Pool Casino stats and recent bets for ${params.username}.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export type PublicProfile = {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  xp: number;
  total_profit: number;
  biggest_win: number;
  biggest_bet: number;
  games_played: number;
  total_wins: number;
  total_losses: number;
  win_streak: number;
  current_streak: number;
  created_at: string;
};

export type PublicBet = {
  game_type: string;
  bet_amount: number;
  payout: number;
  multiplier: number | null;
  result: string;
  created_at: string;
};

export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: ["public-profile", username.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_profile", { _username: username });
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as PublicProfile | null;
    },
  });
}

export function usePublicBets(username: string) {
  return useQuery({
    queryKey: ["public-profile-bets", username.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_profile_bets", {
        _username: username,
        _limit: 15,
      });
      if (error) throw error;
      return (data ?? []) as PublicBet[];
    },
  });
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono font-bold text-lg text-white">{value}</div>
    </div>
  );
}

export function ProfileStats({ profile }: { profile: PublicProfile }) {
  const winRate =
    profile.games_played > 0
      ? `${Math.round((profile.total_wins / profile.games_played) * 100)}%`
      : "—";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="Total profit" value={formatCurrency(profile.total_profit)} />
      <StatTile label="Biggest win" value={formatCurrency(profile.biggest_win)} />
      <StatTile label="Biggest bet" value={formatCurrency(profile.biggest_bet)} />
      <StatTile label="Games played" value={formatNumber(profile.games_played)} />
      <StatTile label="Wins" value={formatNumber(profile.total_wins)} />
      <StatTile label="Losses" value={formatNumber(profile.total_losses)} />
      <StatTile label="Win rate" value={winRate} />
      <StatTile label="Best streak" value={formatNumber(profile.win_streak)} />
    </div>
  );
}

export function RecentBets({ bets }: { bets: PublicBet[] }) {
  if (!bets.length) {
    return <div className="p-6 text-center text-muted-foreground">No bets placed yet.</div>;
  }
  return (
    <ul className="divide-y divide-white/5">
      {bets.map((b, i) => (
        <li key={i} className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div>
            <div className="font-medium capitalize">{b.game_type.replace(/[-_]/g, " ")}</div>
            <div className="text-xs text-muted-foreground">
              {safeLocaleDate(b.created_at, { month: "short", day: "numeric" })} ·{" "}
              {formatCurrency(b.bet_amount)} wager
            </div>
          </div>
          <div
            className={`font-mono font-bold ${b.result === "win" ? "text-primary" : "text-destructive"}`}
          >
            {b.result === "win" ? "+" : "-"}
            {formatCurrency(Math.abs(Number(b.payout) - Number(b.bet_amount)))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PlayerPage() {
  const { username } = Route.useParams();
  const { user } = useSession();
  const { data: profile, isLoading } = usePublicProfile(username);
  const { data: bets } = usePublicBets(username);

  const isMe = user?.username?.toLowerCase() === username.toLowerCase();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {isLoading ? (
          <div className="text-muted-foreground">Loading player…</div>
        ) : !profile ? (
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
            <CardContent className="p-10 text-center space-y-4">
              <h1 className="font-display text-2xl font-bold">Player not found</h1>
              <p className="text-muted-foreground">
                No one at this casino goes by “{username}”.
              </p>
              <Link to="/leaderboard">
                <Button variant="neon">Back to leaderboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                <PlayerAvatar
                  username={profile.username}
                  avatarUrl={profile.avatar_url}
                  className="w-20 h-20"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-2xl md:text-3xl font-bold truncate">
                    {profile.username}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Level {profile.level} · Joined{" "}
                    {safeLocaleDate(profile.created_at, { month: "long", year: "numeric" })}
                  </p>
                  {profile.bio ? (
                    <p className="mt-2 text-sm text-white/80">{profile.bio}</p>
                  ) : null}
                </div>
                {isMe ? (
                  <Link to="/profile">
                    <Button variant="neon">Edit my profile</Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>

            <ProfileStats profile={profile} />

            <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-white/5 font-display font-semibold">
                  Recent bets
                </div>
                <RecentBets bets={bets ?? []} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
