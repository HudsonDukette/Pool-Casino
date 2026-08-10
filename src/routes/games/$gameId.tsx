import React from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins, Sparkles } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { getPool } from "@/lib/pool.functions";
import { GAME_SPECS } from "@/lib/games/specs";
import { optionWinChance, resolveGame, resolveOption } from "@/lib/games/engine";
import { playGame } from "@/lib/games/play.functions";

export const Route = createFileRoute("/games/$gameId")({
  beforeLoad: ({ params }) => {
    if (!GAME_SPECS[params.gameId]) throw notFound();
  },
  head: ({ params }) => {
    const spec = GAME_SPECS[params.gameId];
    const title = spec ? `${spec.name} — PoolCasino` : "Game — PoolCasino";
    const description = spec
      ? `${spec.tagline} Play ${spec.name} against the shared PoolCasino bankroll.`
      : "Play against the shared PoolCasino bankroll.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: GamePage,
});

type PlayResult = {
  won: boolean;
  payout: number;
  profit: number;
  betAmount: number;
  multiplier: number;
  optionLabel: string;
  chance: number;
};

function GamePage() {
  const { gameId } = Route.useParams();
  const spec = GAME_SPECS[gameId]!;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();

  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });

  const [betAmount, setBetAmount] = React.useState("10");
  const [selected, setSelected] = React.useState(spec.options[0]!.value);
  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState<PlayResult | null>(null);

  React.useEffect(() => {
    setSelected(spec.options[0]!.value);
    setResult(null);
  }, [spec.id]);

  const bet = Number(betAmount);
  const poolTotal = pool?.totalAmount ?? 0;
  const balance = user?.balance ?? 0;
  const option = resolveOption(spec, selected);
  const chance = bet > 0 ? optionWinChance(option, bet, poolTotal) : 0;
  const disabled = pool?.disabledGames?.includes(spec.id) ?? false;
  const paused = pool?.poolPaused ?? false;

  const canPlay = !spinning && bet > 0 && bet <= balance && !disabled && !paused;

  async function handlePlay() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setSpinning(true);
    setResult(null);
    try {
      if (isGuest) {
        // Guest wallet is local-only and never touches the shared pool.
        await new Promise((r) => setTimeout(r, 700));
        const outcome = resolveGame(spec.id, selected, bet, poolTotal || 1_000_000);
        const next = balance - bet + outcome.payout;
        updateGuestBalance(next);
        setResult({
          won: outcome.won,
          payout: outcome.payout,
          profit: outcome.payout - bet,
          betAmount: bet,
          multiplier: outcome.multiplier,
          optionLabel: outcome.optionLabel,
          chance: outcome.chance,
        });
      } else {
        const res = await playGame({ data: { gameId: spec.id, option: selected, betAmount: bet } });
        await new Promise((r) => setTimeout(r, 500));
        setBalance(res.newBalance);
        setResult({
          won: res.won,
          payout: res.payout,
          profit: res.profit,
          betAmount: res.betAmount,
          multiplier: res.multiplier,
          optionLabel: res.optionLabel,
          chance: res.chance,
        });
        queryClient.invalidateQueries({ queryKey: ["pool"] });
        refresh();
      }
    } catch (err) {
      toast({
        title: "Bet failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSpinning(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">{spec.name}</h1>
          <p className="text-muted-foreground mt-2">{spec.tagline}</p>
        </div>

        {isGuest && (
          <div className="mb-6 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
            You're playing with guest tokens. <Link to="/register" className="text-accent font-semibold underline">Create an account</Link> to play against the real global pool.
          </div>
        )}
        {(disabled || paused) && (
          <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            {paused ? "The global pool is paused by staff." : "This game is currently disabled by staff."}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="glass-panel border-white/10">
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{spec.prompt}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {spec.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setSelected(o.value)}
                      className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                        selected === o.value
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_25px_rgba(0,255,170,0.15)]"
                          : "border-white/10 bg-black/30 hover:border-white/20"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className="block text-xs text-muted-foreground mt-1 font-mono">{o.multiplier}× payout</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Bet amount</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    className="w-36 font-mono"
                  />
                  {[10, 50, 100, 500].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setBetAmount(String(v))}>
                      {v}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setBetAmount(String(Math.floor(balance)))}>
                    Max
                  </Button>
                </div>
              </div>

              <Button onClick={handlePlay} disabled={!canPlay} className="w-full h-12 text-base" variant="neon">
                {spinning ? "Resolving…" : `Bet ${formatCurrency(bet || 0)}`}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="glass-panel border-white/10">
              <CardContent className="p-6 space-y-3 text-sm">
                <Row label="Your balance" value={formatCurrency(balance)} />
                <Row label="Global pool" value={formatCurrency(poolTotal)} />
                <Row label="Payout" value={`${option.multiplier}×`} />
                <Row label="Win chance" value={`${(chance * 100).toFixed(1)}%`} />
                <Row label="Potential win" value={formatCurrency((bet || 0) * option.multiplier)} />
              </CardContent>
            </Card>

            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key={`${result.won}-${result.payout}-${result.betAmount}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <Card className={`glass-panel ${result.won ? "border-primary/50" : "border-destructive/40"}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        {result.won ? <Sparkles className="w-4 h-4 text-primary" /> : <Coins className="w-4 h-4 text-destructive" />}
                        <span className={`font-display text-xl font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                          {result.won ? "You won!" : "No luck"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.optionLabel} · {result.won ? `paid ${formatCurrency(result.payout)}` : `lost ${formatCurrency(result.betAmount)}`}
                      </p>
                      <p className="mt-2 font-mono text-sm">
                        {result.profit >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(result.profit))}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
