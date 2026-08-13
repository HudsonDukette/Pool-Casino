import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Dice1 } from "lucide-react";
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

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const getDots = (num: number) => {
    const positions: Record<number, string[]> = {
      1: ["center"],
      2: ["top-left", "bottom-right"],
      3: ["top-left", "center", "bottom-right"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
    };
    return positions[num] || [];
  };

  const dotPositions: Record<string, string> = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2",
    "middle-left": "top-1/2 left-2 -translate-y-1/2",
    "middle-right": "top-1/2 right-2 -translate-y-1/2",
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <motion.div
      animate={{ 
        rotate: rolling ? [0, 360, 0] : 0,
        scale: rolling ? [1, 1.1, 1] : 1
      }}
      transition={{ duration: rolling ? 0.5 : 0 }}
      className="w-20 h-20 bg-white rounded-xl border-2 border-gray-300 shadow-lg flex items-center justify-center relative"
    >
      <div className="w-full h-full p-3 relative">
        {getDots(value).map((pos, i) => (
          <div
            key={i}
            className={`absolute w-3 h-3 bg-gray-800 rounded-full ${dotPositions[pos]}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

export const Route = createFileRoute("/games/dice")({
  head: () => ({
    meta: [
      { title: "Dice Roll — PoolCasino" },
      { name: "description", content: "Roll two dice and bet on the outcome." },
      { property: "og:title", content: "Dice Roll — PoolCasino" },
      { property: "og:description", content: "Roll two dice and bet on the outcome." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiceGame,
});

function DiceGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [selectedBet, setSelectedBet] = useState<"under" | "seven" | "over">("under");
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState([1, 1]);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;
  const total = dice[0] + dice[1];

  const canPlay = !rolling && bet > 0 && bet <= balance;

  function rollDice() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setRolling(true);
    setResult(null);

    // Animate rolling
    const rollInterval = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    setTimeout(() => {
      clearInterval(rollInterval);
      const finalDice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      setDice(finalDice);

      const finalTotal = finalDice[0] + finalDice[1];
      let won = false;
      let payout = 0;
      let multiplier = 0;

      if (selectedBet === "under" && finalTotal < 7) {
        won = true;
        multiplier = 2.1;
        payout = bet * multiplier;
      } else if (selectedBet === "seven" && finalTotal === 7) {
        won = true;
        multiplier = 5.5;
        payout = bet * multiplier;
      } else if (selectedBet === "over" && finalTotal > 7) {
        won = true;
        multiplier = 2.1;
        payout = bet * multiplier;
      }

      setResult({
        won,
        payout,
        message: won 
          ? `Rolled ${finalTotal}! You win!` 
          : `Rolled ${finalTotal}. Better luck next time!`,
      });

      processGameResult(won, payout, bet);
    }, 1000);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "dice", option: selectedBet, betAmount: bet },
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
      setRolling(false);
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
          <h1 className="font-display text-4xl font-bold tracking-tight">Dice Roll</h1>
          <p className="text-muted-foreground mt-2">Roll two dice and bet on under 7, exactly 7, or over 7.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Dice Display */}
          <Card className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 border-emerald-700/50 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex justify-center gap-8 mb-8">
                <Die value={dice[0]} rolling={rolling} />
                <Die value={dice[1]} rolling={rolling} />
              </div>

              {!rolling && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">Total: {total}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {total < 7 ? "Under 7" : total === 7 ? "Exactly 7" : "Over 7"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Betting Controls */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              {/* Bet Selection */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Choose your bet</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedBet("under")}
                    disabled={rolling}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "under"
                        ? "border-emerald-500 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        : "border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50"
                    } ${rolling ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold text-emerald-400">Under 7</span>
                    <p className="text-xs text-muted-foreground mt-1">2.1× payout</p>
                  </button>

                  <button
                    onClick={() => setSelectedBet("seven")}
                    disabled={rolling}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "seven"
                        ? "border-yellow-500 bg-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                        : "border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-500/50"
                    } ${rolling ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold text-yellow-400">Exactly 7</span>
                    <p className="text-xs text-muted-foreground mt-1">5.5× payout</p>
                  </button>

                  <button
                    onClick={() => setSelectedBet("over")}
                    disabled={rolling}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "over"
                        ? "border-blue-500 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                        : "border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50"
                    } ${rolling ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold text-blue-400">Over 7</span>
                    <p className="text-xs text-muted-foreground mt-1">2.1× payout</p>
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
                    disabled={rolling}
                    className="w-36 font-mono bg-black/50 border-white/20"
                  />
                  {[10, 25, 50, 100].map((v) => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(v))}
                      disabled={rolling}
                      className="border-white/20 hover:border-white/40"
                    >
                      {v}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(String(Math.floor(balance)))}
                    disabled={rolling}
                    className="border-white/20 hover:border-white/40"
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Roll Button */}
              <Button
                onClick={rollDice}
                disabled={!canPlay}
                className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              >
                {rolling ? (
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Dice1 className="w-5 h-5" />
                    </motion.div>
                    Rolling...
                  </span>
                ) : (
                  `Roll Dice (${formatCurrency(bet || 0)})`
                )}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {result && !rolling && (
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