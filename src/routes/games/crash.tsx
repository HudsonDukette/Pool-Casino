import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, Bomb } from "lucide-react";
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

export const Route = createFileRoute("/games/crash")({
  head: () => ({
    meta: [
      { title: "Crash — PoolCasino" },
      { name: "description", content: "Watch the multiplier climb and cash out before it crashes." },
      { property: "og:title", content: "Crash — PoolCasino" },
      { property: "og:description", content: "Watch the multiplier climb and cash out before it crashes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrashGame,
});

function CrashGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [autoCashout, setAutoCashout] = useState("2");
  const [gameState, setGameState] = useState<"betting" | "running" | "crashed" | "cashed_out">("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const crashPointRef = useRef(0);

  const bet = Number(betAmount);
  const autoCash = Number(autoCashout);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = gameState === "betting" && bet > 0 && bet <= balance;
  const canCashOut = gameState === "running";

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startGame() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    // Generate random crash point (house edge built in)
    const crash = Math.max(1, (0.99 / (1 - Math.random()))).toFixed(2);
    crashPointRef.current = Number(crash);
    setCrashPoint(Number(crash));
    setMultiplier(1.0);
    setGameState("running");
    setResult(null);

    let currentMultiplier = 1.0;
    intervalRef.current = setInterval(() => {
      currentMultiplier += 0.01 + (currentMultiplier * 0.001);
      setMultiplier(currentMultiplier);

      // Auto cashout check
      if (autoCash > 0 && currentMultiplier >= autoCash) {
        cashOut();
      }

      // Check for crash
      if (currentMultiplier >= crashPointRef.current) {
        crash();
      }
    }, 50);
  }

  function cashOut() {
    if (!canCashOut || intervalRef.current === null) return;

    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setGameState("cashed_out");

    const payout = bet * multiplier;
    setResult({
      won: true,
      payout,
      message: `Cashed out at ${multiplier.toFixed(2)}×!`,
    });

    processGameResult(true, payout, bet);
  }

  function crash() {
    if (intervalRef.current === null) return;

    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setGameState("crashed");
    setMultiplier(crashPointRef.current);

    setResult({
      won: false,
      payout: 0,
      message: `Crashed at ${crashPointRef.current.toFixed(2)}×`,
    });

    processGameResult(false, 0, bet);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "crash", option: won ? "win" : "loss", betAmount: bet },
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
    }
  }

  function resetGame() {
    setGameState("betting");
    setMultiplier(1.0);
    setCrashPoint(0);
    setResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Crash</h1>
          <p className="text-muted-foreground mt-2">Cash out before the multiplier crashes. Higher risk, higher reward.</p>
        </div>

        <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-700/50 shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            {/* Multiplier Display */}
            <div className="mb-8">
              <div className="relative h-40 bg-black/50 rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-red-500/20 to-transparent"
                  animate={{
                    opacity: gameState === "crashed" ? 1 : 0.3,
                  }}
                />
                
                <div className="text-center z-10">
                  <motion.div
                    animate={{
                      scale: gameState === "running" ? [1, 1.05, 1] : 1,
                      color: gameState === "crashed" ? "#ef4444" : gameState === "cashed_out" ? "#22c55e" : "#ffffff",
                    }}
                    transition={{ duration: 0.5, repeat: gameState === "running" ? Infinity : 0 }}
                  >
                    <p className="text-6xl font-bold font-mono">
                      {gameState === "crashed" ? "💥" : `${multiplier.toFixed(2)}×`}
                    </p>
                  </motion.div>
                  {gameState === "running" && (
                    <p className="text-sm text-muted-foreground mt-2">Climbing...</p>
                  )}
                  {gameState === "crashed" && (
                    <p className="text-sm text-red-400 mt-2 flex items-center justify-center gap-2">
                      <Bomb className="w-4 h-4" /> Crashed!
                    </p>
                  )}
                  {gameState === "cashed_out" && (
                    <p className="text-sm text-green-400 mt-2 flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Cashed out!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Betting Controls */}
            {gameState === "betting" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Bet amount</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="w-36 font-mono bg-black/50 border-white/20"
                    />
                    {[10, 25, 50, 100].map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        size="sm"
                        onClick={() => setBetAmount(String(v))}
                        className="border-white/20 hover:border-white/40"
                      >
                        {v}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(Math.floor(balance)))}
                      className="border-white/20 hover:border-white/40"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Auto cashout (optional)</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={autoCashout}
                      onChange={(e) => setAutoCashout(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="2.0"
                      className="w-36 font-mono bg-black/50 border-white/20"
                    />
                    <span className="text-sm text-muted-foreground">×</span>
                  </div>
                </div>

                <Button
                  onClick={startGame}
                  disabled={!canPlay}
                  className="w-full h-12 text-base bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                >
                  Bet ({formatCurrency(bet || 0)})
                </Button>
              </div>
            )}

            {gameState === "running" && (
              <Button
                onClick={cashOut}
                className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
              >
                Cash Out ({formatCurrency(bet * multiplier)})
              </Button>
            )}

            {(gameState === "crashed" || gameState === "cashed_out") && result && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-2xl border-2 ${
                    result.won
                      ? "bg-primary/20 border-primary/50"
                      : "bg-destructive/20 border-destructive/50"
                  }`}
                >
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? "🎉 You Won!" : "😔 You Crashed"}
                    </p>
                    <p className="text-lg text-white mt-2">{result.message}</p>
                    {result.payout > 0 && (
                      <p className="text-xl font-mono text-primary mt-2">
                        +{formatCurrency(result.payout)}
                      </p>
                    )}
                  </div>
                </motion.div>
                <Button
                  onClick={resetGame}
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  Play Again
                </Button>
              </div>
            )}

            {/* Stats */}
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
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
    </Layout>
  );
}