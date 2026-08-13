import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Star } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { getPool } from "@/lib/pool.functions";
import { playGame } from "@/lib/games/play.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣", "⭐", "🔔"];
const MULTIPLIERS = { "🍒": 2, "🍋": 3, "🍊": 4, "🍇": 5, "💎": 8, "7️⃣": 15, "⭐": 25, "🔔": 50 };

function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function SlotReel({ symbol, spinning }: { symbol: string; spinning: boolean }) {
  return (
    <div className="w-24 h-32 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl border-4 border-yellow-500 flex items-center justify-center shadow-2xl overflow-hidden">
      <motion.div
        animate={{ 
          y: spinning ? [0, -100, 0] : 0,
          rotate: spinning ? [0, 360] : 0
        }}
        transition={{ 
          duration: spinning ? 2 : 0, 
          ease: "easeOut",
          repeat: spinning ? Infinity : 0
        }}
        className="text-5xl"
      >
        {spinning ? getRandomSymbol() : symbol}
      </motion.div>
    </div>
  );
}

export const Route = createFileRoute("/games/slots")({
  head: () => ({
    meta: [
      { title: "Neon Slots — PoolCasino" },
      { name: "description", content: "Interactive slot machine with spinning reels and multipliers." },
      { property: "og:title", content: "Neon Slots — PoolCasino" },
      { property: "og:description", content: "Interactive slot machine with spinning reels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotsGame,
});

function SlotsGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(["🍒", "🍒", "🍒"]);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = !spinning && bet > 0 && bet <= balance;

  async function spin() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setResult(null);

    // Generate results after spin animation
    setTimeout(() => {
      const newReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
      setReels(newReels);

      // Calculate winnings
      let won = false;
      let payout = 0;
      let multiplier = 0;

      if (newReels[0] === newReels[1] && newReels[1] === newReels[2]) {
        // Jackpot - all three match
        won = true;
        multiplier = MULTIPLIERS[newReels[0] as keyof typeof MULTIPLIERS] || 50;
        payout = bet * multiplier;
      } else if (newReels[0] === newReels[1] || newReels[1] === newReels[2] || newReels[0] === newReels[2]) {
        // Two match - small win
        won = true;
        multiplier = 1.5;
        payout = bet * multiplier;
      }

      setResult({
        won,
        payout,
        message: won 
          ? `🎉 ${multiplier >= 10 ? "JACKPOT!" : "Nice spin!"} ${newReels.join(" ")}`
          : `No luck this time: ${newReels.join(" ")}`,
      });

      processGameResult(won, payout, bet);
    }, 2000);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "slots", option: won ? "win" : "loss", betAmount: bet },
        });
        setBalance(res.newBalance);
        queryClient.invalidateQueries({ queryKey: ["pool"] });
        refresh();
      }
    } catch (err) {
      toast({
        title: "Game failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSpinning(false);
    }
  }

  function resetGame() {
    setResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Neon Slots</h1>
          <p className="text-muted-foreground mt-2">Match symbols across three reels for multipliers up to 50×!</p>
        </div>

        <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50 shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            {/* Slot Machine */}
            <div className="mb-8">
              <div className="flex justify-center gap-4 mb-6">
                <SlotReel symbol={reels[0]} spinning={spinning} />
                <SlotReel symbol={reels[1]} spinning={spinning} />
                <SlotReel symbol={reels[2]} spinning={spinning} />
              </div>

              {/* Pay Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center mb-6">
                {Object.entries(MULTIPLIERS).map(([symbol, mult]) => (
                  <div key={symbol} className="bg-black/30 rounded-lg p-2">
                    <span className="text-2xl">{symbol}</span>
                    <p className="text-muted-foreground mt-1">{mult}×</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Betting Controls */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Bet amount</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    disabled={spinning}
                    className="w-36 font-mono bg-black/50 border-white/20"
                  />
                  {[10, 25, 50, 100].map((v) => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(v))}
                      disabled={spinning}
                      className="border-white/20 hover:border-white/40"
                    >
                      {v}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(String(Math.floor(balance)))}
                    disabled={spinning}
                    className="border-white/20 hover:border-white/40"
                  >
                    Max
                  </Button>
                </div>
              </div>

              <Button
                onClick={spinning ? undefined : spin}
                disabled={!canPlay}
                className="w-full h-14 text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-[0_0_30px_rgba(234,179,8,0.4)]"
              >
                {spinning ? (
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Star className="w-5 h-5" />
                    </motion.div>
                    Spinning...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Spin ({formatCurrency(bet || 0)})
                  </span>
                )}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {result && !spinning && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-6 rounded-2xl border-2 ${
                      result.won
                        ? "bg-primary/20 border-primary/50"
                        : "bg-destructive/20 border-destructive/50"
                    }`}
                  >
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                        {result.won ? "🎉 You Win!" : "😔 No Luck"}
                      </p>
                      <p className="text-lg text-white mt-2">{result.message}</p>
                      {result.payout > 0 && (
                        <p className="text-xl font-mono text-primary mt-2">
                          +{formatCurrency(result.payout)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="font-mono font-semibold">{formatCurrency(balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pool</span>
                  <span className="font-mono font-semibold">{formatCurrency(poolTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}