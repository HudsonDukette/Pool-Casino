import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins } from "lucide-react";
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

function Coin({ side, flipping }: { side: "heads" | "tails"; flipping: boolean }) {
  return (
    <motion.div
      animate={{ 
        rotateY: flipping ? [0, 180, 360, 540, 720] : 0,
        scale: flipping ? [1, 1.2, 1] : 1
      }}
      transition={{ duration: flipping ? 2 : 0, ease: "easeOut" }}
      className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-4 border-yellow-300 shadow-2xl flex items-center justify-center"
    >
      <div className="text-center">
        <div className="text-4xl font-bold text-yellow-900">
          {side === "heads" ? "H" : "T"}
        </div>
        <div className="text-xs text-yellow-800 font-semibold">
          {side === "heads" ? "HEADS" : "TAILS"}
        </div>
      </div>
    </motion.div>
  );
}

export const Route = createFileRoute("/games/coinflip")({
  head: () => ({
    meta: [
      { title: "Coin Flip — PoolCasino" },
      { name: "description", content: "Classic 50/50 coin flip with pool-adjusted payouts." },
      { property: "og:title", content: "Coin Flip — PoolCasino" },
      { property: "og:description", content: "Classic 50/50 coin flip with pool-adjusted payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoinFlipGame,
});

function CoinFlipGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [selectedSide, setSelectedSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = !flipping && bet > 0 && bet <= balance;

  function flipCoin() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setFlipping(true);
    setResult(null);

    // Determine result
    const outcome = Math.random() < 0.5 ? "heads" : "tails";

    setTimeout(() => {
      setCoinSide(outcome);
      const won = selectedSide === outcome;
      const payout = won ? bet * 1.95 : 0;

      setResult({
        won,
        payout,
        message: won 
          ? `The coin landed on ${outcome}! You win!` 
          : `The coin landed on ${outcome}. Better luck next time!`,
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
          data: { gameId: "coinflip", option: selectedSide, betAmount: bet },
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
      setFlipping(false);
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
          <h1 className="font-display text-4xl font-bold tracking-tight">Coin Flip</h1>
          <p className="text-muted-foreground mt-2">Pure 50/50 chance. Call it heads or tails.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Coin Display */}
          <Card className="bg-gradient-to-br from-amber-900/30 to-yellow-900/30 border-amber-700/50 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex justify-center mb-8">
                <Coin side={coinSide} flipping={flipping} />
              </div>

              {!flipping && result && (
                <div className="text-center">
                  <p className={`text-2xl font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                    {result.won ? "🎉 You Won!" : "😔 You Lost"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    The coin landed on <span className="font-semibold text-white">{coinSide.toUpperCase()}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Betting Controls */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              {/* Side Selection */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Call the flip</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedSide("heads")}
                    disabled={flipping}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedSide === "heads"
                        ? "border-amber-500 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        : "border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50"
                    } ${flipping ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold text-amber-400">Heads</span>
                    <p className="text-xs text-muted-foreground mt-1">1.95× payout</p>
                  </button>

                  <button
                    onClick={() => setSelectedSide("tails")}
                    disabled={flipping}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedSide === "tails"
                        ? "border-gray-400 bg-gray-400/20 shadow-[0_0_20px_rgba(156,163,175,0.3)]"
                        : "border-gray-400/30 bg-gray-400/10 hover:border-gray-400/50"
                    } ${flipping ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold text-gray-300">Tails</span>
                    <p className="text-xs text-muted-foreground mt-1">1.95× payout</p>
                  </button>
                </div>
              </div>

              {/* Bet Amount */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Bet amount</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    disabled={flipping}
                    className="w-36 font-mono bg-black/50 border-white/20"
                  />
                  {[10, 25, 50, 100].map((v) => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(v))}
                      disabled={flipping}
                      className="border-white/20 hover:border-white/40"
                    >
                      {v}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(String(Math.floor(balance)))}
                    disabled={flipping}
                    className="border-white/20 hover:border-white/40"
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Flip Button */}
              <Button
                onClick={flipCoin}
                disabled={!canPlay}
                className="w-full h-12 text-base bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
              >
                {flipping ? (
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ rotateY: 180 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Coins className="w-5 h-5" />
                    </motion.div>
                    Flipping...
                  </span>
                ) : (
                  `Flip Coin (${formatCurrency(bet || 0)})`
                )}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {result && !flipping && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-4 rounded-xl border-2 ${
                      result.won
                        ? "bg-primary/20 border-primary/50"
                        : "bg-destructive/20 border-destructive/50"
                    }`}
                  >
                    <p className={`font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? "🎉 You Win!" : "😔 You Lose"}
                    </p>
                    <p className="text-sm text-white mt-1">{result.message}</p>
                    {result.payout > 0 && (
                      <p className="text-lg font-mono text-primary mt-2">
                        +{formatCurrency(result.payout)}
                      </p>
                    )}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}