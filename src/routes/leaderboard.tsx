import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Crown, Trophy, Medal } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({
    meta: [
      { title: "Leaderboard | Pool Casino High Rollers" },
      {
        name: "description",
        content:
          "See the biggest winners at Pool Casino — ranked by total profit, biggest win and games played.",
      },
      { property: "og:title", content: "Leaderboard | Pool Casino High Rollers" },
      {
        property: "og:description",
        content: "Track the top Pool Casino players by profit, biggest win and total wins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = {
  username: string;
  avatar_url: string | null;
  total_profit: number;
  biggest_win: number;
  games_played: number;
  total_wins: number;
  level: number;
};

function rankBadge(index: number) {
  if (index === 0) return <Crown className="w-5 h-5 text-primary" />;
  if (index === 1) return <Trophy className="w-5 h-5 text-accent" />;
  if (index === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
  return <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>;
}

function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_leaderboard", { _limit: 50 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Leader<span className="text-primary neon-text-primary">board</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            The sharpest players at the table, ranked by lifetime profit.
          </p>
        </div>

        <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading rankings…</div>
            ) : !data?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                No ranked players yet. Be the first to run it up.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {data.map((row, i) => (
                  <motion.li
                    key={row.username}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  >
                    <Link
                      to="/players/$username"
                      params={{ username: row.username }}
                      className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="w-8 flex items-center justify-center">{rankBadge(i)}</div>
                      <PlayerAvatar
                        username={row.username}
                        avatarUrl={row.avatar_url}
                        className="w-11 h-11"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{row.username}</div>
                        <div className="text-xs text-muted-foreground">
                          Level {row.level} · {formatNumber(row.games_played)} games ·{" "}
                          {formatNumber(row.total_wins)} wins
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold ${
                            Number(row.total_profit) >= 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(row.total_profit)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Best {formatCurrency(row.biggest_win)}
                        </div>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
