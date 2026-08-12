import React from "react";
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
          "See the biggest winners at Pool Casino — daily, weekly and lifetime rankings for profit, donations, biggest bets and more.",
      },
      { property: "og:title", content: "Leaderboard | Pool Casino High Rollers" },
      {
        property: "og:description",
        content: "Daily, weekly and lifetime Pool Casino rankings across profit, donations and wins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = {
  username: string;
  avatar_url: string | null;
  level: number;
  balance: number;
  donated: number;
  max_bet: number;
  most_won: number;
  most_lost: number;
  net_made: number;
  net_lost: number;
  games: number;
  wins: number;
};

const PERIODS = [
  { key: "lifetime", label: "Lifetime" },
  { key: "weekly", label: "Weekly" },
  { key: "daily", label: "Daily" },
] as const;

type MetricKey =
  | "net_made"
  | "net_lost"
  | "balance"
  | "donated"
  | "max_bet"
  | "most_won"
  | "most_lost"
  | "games"
  | "wins";

const METRICS: { key: MetricKey; label: string; money: boolean }[] = [
  { key: "net_made", label: "Amount made", money: true },
  { key: "net_lost", label: "Amount lost", money: true },
  { key: "balance", label: "Balance", money: true },
  { key: "donated", label: "Donated", money: true },
  { key: "max_bet", label: "Max bet size", money: true },
  { key: "most_won", label: "Most won", money: true },
  { key: "most_lost", label: "Most lost", money: true },
  { key: "games", label: "Games", money: false },
  { key: "wins", label: "Wins", money: false },
];

function rankBadge(index: number) {
  if (index === 0) return <Crown className="w-5 h-5 text-primary" />;
  if (index === 1) return <Trophy className="w-5 h-5 text-accent" />;
  if (index === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
  return <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>;
}

function LeaderboardPage() {
  const [period, setPeriod] = React.useState<(typeof PERIODS)[number]["key"]>("lifetime");
  const [metric, setMetric] = React.useState<MetricKey>("net_made");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard_stats", {
        _period: period,
        _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
  });

  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const rows = React.useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => Number(b[metric]) - Number(a[metric]));
    return list.filter((r) => Number(r[metric]) > 0 || metric === "balance").slice(0, 50);
  }, [data, metric]);

  const fmt = (value: number) =>
    activeMetric.money ? formatCurrency(value) : formatNumber(value);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Leader<span className="text-primary neon-text-primary">board</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            The sharpest — and most generous — players at the table.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-muted-foreground border border-white/5 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                metric === m.key
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-muted-foreground hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading rankings…</div>
            ) : !rows.length ? (
              <div className="p-8 text-center text-muted-foreground">
                No ranked players for this period yet.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {rows.map((row, i) => (
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
                          Level {row.level} · {formatNumber(row.games)} games ·{" "}
                          {formatNumber(row.wins)} wins · donated {formatCurrency(row.donated)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-primary">
                          {fmt(Number(row[metric]))}
                        </div>
                        <div className="text-xs text-muted-foreground">{activeMetric.label}</div>
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
