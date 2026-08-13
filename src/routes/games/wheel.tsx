import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Circle } from "lucide-react";
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

const SEGMENTS = [
  { multiplier: 1.5, color: "from-green-500 to-emerald-600", label: "1.5×" },
  { multiplier: 2, color: "from-blue-500 to-cyan-600", label: "2×" },
  { multiplier: 3, color: "from-purple-500 to-violet-600", label: "3×" },
  { multiplier: 5, color: "from-pink-500 to-rose-600", label: "5×" },
  { multiplier: 7, color: "from-orange-500 to-amber-600", label: "7×" },
  { multiplier: 10, color: "from-red-500 to-rose-600", label: "10×" },
  { multiplier: 3, color: "from-purple-500 to-violet-600", label: "3×" },
  { multiplier: 2, color: "from-blue-500 to-cyan-600", label: "2×" },
];

function FortuneWheel({ spinning, result }: { spinning: boolean; result: number | null }) {
  const [rotation, setRotation] = useState(0);

  if (spinning && result !== null) {
    const targetIndex = SEGMENTS.findIndex(s => s.multiplier === result);
    const targetRotation = -(targetIndex * (360 / SEGMENTS.length));
    setRotation(targetRotation + 360 * 3);
  }

  return (
    <div className="relative w-64 h-64 mx-auto">
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 3 : 0, ease: "easeOut" }}
        className="w-full h-full rounded-full border-8 border-yellow-600 bg-gradient-to-br from-purple-900 to-indigo-900 shadow-2xl relative"
      >
        {SEGMENTS.map((segment, i) => {
          const angle = (i * 360) / SEGMENTS.length;
          return (
            <div
              key={i}
              className={`absolute w-16 h-16 flex items-center justify-center text-white text-xs font-bold rounded-full bg-gradient-to-br ${segment.color}`}
              style={{
                transform: `rotate(${angle}deg) translate(80px) rotate(-${angle}deg)`,
                left: "50%",
                top: "50%",
                marginLeft: "-32px",
                marginTop: "-32px",
              }}
            >
              {segment.label}
            </div>
          );
        })}
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full border-4 border-yellow-400 flex items-center justify-center shadow-lg">
            {result !== null ? (
              <span className="text-lg font-bold text-white">{result}×</span>
            ) : (
              <Circle className="w-6 h-6 text-yellow-300" />
            )}
          </div>
        </div>
      </motion.div>
      
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/games/wheel")({
  head: () => ({
    meta: [
      { title: "Fortune Wheel — PoolCasino" },
      { name: "description", content: "Spin the wheel for multipliers up to 10×." },
      { property: "og:title", content: "Fortune Wheel — PoolCasino" },
      { property: "og:description", content: "Spin the wheel for multipliers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WheelGame,
});

function WheelGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = !spinning && bet > 0 && bet <= balance;

  function spin() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setResult(null);
    setGameResult(null);

    // Generate random result
    const randomSegment = SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)];
    
    setTimeout(() => {
      setResult(randomSegment.multiplier);
      
      const won = randomSegment.multiplier >= 1.5;
      const payout = won ? bet * randomSegment.multiplier : 0;

      setGameResult({
        won,
        payout,
        message: won 
          ? `The wheel landed on ${randomSegment.multiplier}×! You win!` 
          : `The wheel landed on ${randomSegment.multiplier}×. Better luck next time!`,
      });

      processGameResult(won, payout, bet);
    }, 3000);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "wheel", option: "spin", betAmount: bet },
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
    setGameResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Fortune Wheel</h1>
          <p className="text-muted-foreground mt-2">Spin the wheel for a chance to win up to 10× your bet.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Wheel */}
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50 shadow-2xl">
            <CardContent className="p-8">
              <FortuneWheel spinning={spinning} result={result} />
              
              {result !== null && !spinning && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <p className="text-2xl font-bold text-white">
                    Result: <span className="text-primary">{result}×</span>
                  </p>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              {/* Bet Amount */}
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

              {/* Spin Button */}
              <Button
                onClick={spin}
                disabled={!canPlay}
                className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]"
              >
                {spinning ? "Spinning..." : `Spin (${formatCurrency(bet || 0)})`}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {gameResult && !spinning && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-4 rounded-xl border-2 ${
                      gameResult.won
                        ? "bg-primary/20 border-primary/50"
                        : "bg-destructive/20 border-destructive/50"
                    }`}
                  >
                    <p className={`font-bold ${gameResult.won ? "text-primary" : "text-destructive"}`}>
                      {gameResult.won ? "🎉 You Win!" : "😔 You Lose"}
                    </p>
                    <p className="text-sm text-white mt-1">{gameResult.message}</p>
                    {gameResult.payout > 0 && (
                      <p className="text-lg font-mono text-primary mt-2">
                        +{formatCurrency(gameResult.payout)}
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