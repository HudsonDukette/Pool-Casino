import React, { useState, useEffect } from "react";
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

const NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getNumberColor(num: number): "red" | "black" | "green" {
  if (num === 0) return "green";
  if (RED_NUMBERS.includes(num)) return "red";
  return "black";
}

function RouletteWheel({ spinning, result }: { spinning: boolean; result: number | null }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (spinning && result !== null) {
      const targetIndex = NUMBERS.indexOf(result);
      const targetRotation = -(targetIndex * (360 / NUMBERS.length));
      setRotation(targetRotation + 360 * 5); // Add 5 full rotations
    }
  }, [spinning, result]);

  return (
    <div className="relative w-64 h-64 mx-auto">
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 4 : 0, ease: "easeOut" }}
        className="w-full h-full rounded-full border-8 border-yellow-600 bg-gradient-to-br from-green-800 to-green-900 shadow-2xl relative"
      >
        {/* Roulette numbers */}
        {NUMBERS.map((num, i) => {
          const angle = (i * 360) / NUMBERS.length;
          const color = getNumberColor(num);
          const bgColor = color === "red" ? "bg-red-600" : color === "black" ? "bg-gray-900" : "bg-green-600";
          
          return (
            <div
              key={num}
              className="absolute w-8 h-8 flex items-center justify-center text-white text-xs font-bold rounded-full"
              style={{
                transform: `rotate(${angle}deg) translate(80px) rotate(-${angle}deg)`,
                left: "50%",
                top: "50%",
                marginLeft: "-16px",
                marginTop: "-16px",
              }}
            >
              <div className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center`}>
                {num}
              </div>
            </div>
          );
        })}
        
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full border-4 border-yellow-400 flex items-center justify-center shadow-lg">
            {result !== null ? (
              <span className="text-2xl font-bold text-white">{result}</span>
            ) : (
              <Circle className="w-8 h-8 text-yellow-300" />
            )}
          </div>
        </div>
      </motion.div>
      
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/games/roulette")({
  head: () => ({
    meta: [
      { title: "Neon Roulette — PoolCasino" },
      { name: "description", content: "Interactive roulette with spinning wheel. Bet on red, black, or specific numbers." },
      { property: "og:title", content: "Neon Roulette — PoolCasino" },
      { property: "og:description", content: "Interactive roulette with spinning wheel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouletteGame,
});

function RouletteGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [selectedBet, setSelectedBet] = useState<"red" | "black" | "green">("red");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

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
    setGameResult(null);

    // Generate random result
    const randomIndex = Math.floor(Math.random() * NUMBERS.length);
    const winningNumber = NUMBERS[randomIndex];
    
    setTimeout(() => {
      setResult(winningNumber);
      
      const winningColor = getNumberColor(winningNumber);
      const won = selectedBet === winningColor;
      
      let payout = 0;
      let multiplier = 0;
      
      if (won) {
        if (selectedBet === "green") {
          multiplier = 14; // 0 pays 14:1
        } else {
          multiplier = 2; // Red/black pays 1:1
        }
        payout = bet * multiplier;
      }

      setGameResult({
        won,
        payout,
        message: won 
          ? `The ball landed on ${winningNumber} (${winningColor})! You win!` 
          : `The ball landed on ${winningNumber} (${winningColor}). Better luck next time!`,
      });

      // Process the actual game result
      processGameResult(won, payout, bet);
    }, 4000);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "roulette", option: selectedBet, betAmount: bet },
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
          <h1 className="font-display text-4xl font-bold tracking-tight">Neon Roulette</h1>
          <p className="text-muted-foreground mt-2">Watch the wheel spin and place your bets on red, black, or green.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Roulette Wheel */}
          <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-700/50 shadow-2xl">
            <CardContent className="p-8">
              <RouletteWheel spinning={spinning} result={result} />
              
              {result !== null && !spinning && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <p className="text-2xl font-bold text-white">
                    Result: <span className={`${
                      getNumberColor(result) === "red" ? "text-red-500" : 
                      getNumberColor(result) === "black" ? "text-gray-300" : "text-green-500"
                    }`}>{result}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getNumberColor(result).toUpperCase()}
                  </p>
                </motion.div>
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
                    onClick={() => setSelectedBet("red")}
                    disabled={spinning}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "red"
                        ? "border-red-500 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                        : "border-red-500/30 bg-red-500/10 hover:border-red-500/50"
                    } ${spinning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="w-8 h-8 bg-red-600 rounded-full mx-auto mb-2" />
                    <span className="font-semibold text-red-400">Red</span>
                    <p className="text-xs text-muted-foreground mt-1">2× payout</p>
                  </button>
                  
                  <button
                    onClick={() => setSelectedBet("black")}
                    disabled={spinning}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "black"
                        ? "border-gray-500 bg-gray-500/20 shadow-[0_0_20px_rgba(107,114,128,0.3)]"
                        : "border-gray-500/30 bg-gray-500/10 hover:border-gray-500/50"
                    } ${spinning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="w-8 h-8 bg-gray-900 rounded-full mx-auto mb-2" />
                    <span className="font-semibold text-gray-300">Black</span>
                    <p className="text-xs text-muted-foreground mt-1">2× payout</p>
                  </button>
                  
                  <button
                    onClick={() => setSelectedBet("green")}
                    disabled={spinning}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedBet === "green"
                        ? "border-green-500 bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                        : "border-green-500/30 bg-green-500/10 hover:border-green-500/50"
                    } ${spinning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="w-8 h-8 bg-green-600 rounded-full mx-auto mb-2" />
                    <span className="font-semibold text-green-400">Green (0)</span>
                    <p className="text-xs text-muted-foreground mt-1">14× payout</p>
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