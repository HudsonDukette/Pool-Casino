import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CircleDot } from "lucide-react";
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

const ROWS = 12;
const SLOT_COUNT = 13;

// Risk level configurations
const RISK_CONFIGS = {
  low: {
    multipliers: [0.5, 1, 1.5, 2, 3, 5, 3, 2, 1.5, 1, 0.5, 1, 0.5],
    gravity: 0.3,
    bounce: 0.4,
    pegSpacing: 6,
  },
  medium: {
    multipliers: [0.3, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.3, 0.5, 0.3],
    gravity: 0.4,
    bounce: 0.5,
    pegSpacing: 5,
  },
  high: {
    multipliers: [0.1, 0.2, 0.5, 1, 3, 25, 3, 1, 0.5, 0.2, 0.1, 0.2, 0.1],
    gravity: 0.5,
    bounce: 0.6,
    pegSpacing: 4,
  },
};

function Peg({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute w-2 h-2 bg-gray-500 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.3)]"
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

function Ball({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg z-10"
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

function Slot({ multiplier, highlight }: { multiplier: number; highlight: boolean }) {
  const getColor = () => {
    if (multiplier >= 25) return "from-red-500 to-orange-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
    if (multiplier >= 10) return "from-yellow-500 to-orange-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]";
    if (multiplier >= 5) return "from-green-500 to-emerald-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]";
    if (multiplier >= 2) return "from-blue-500 to-cyan-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]";
    if (multiplier >= 1) return "from-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]";
    return "from-gray-500 to-gray-600";
  };

  return (
    <div
      className={`h-16 border-2 border-white/20 flex items-center justify-center text-sm font-bold rounded-b-lg transition-all ${
        highlight ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-105" : ""
      }`}
    >
      <div className={`bg-gradient-to-r ${getColor()} text-white px-3 py-1 rounded-full font-mono`}>
        {multiplier}×
      </div>
    </div>
  );
}

export const Route = createFileRoute("/games/plinko")({
  head: () => ({
    meta: [
      { title: "Plinko — PoolCasino" },
      { name: "description", content: "Drop balls through physics-based pegs for multipliers up to 25×." },
      { property: "og:title", content: "Plinko — PoolCasino" },
      { property: "og:description", content: "Physics-based ball drop game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlinkoGame,
});

function PlinkoGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 0 });
  const [ballVelocity, setBallVelocity] = useState({ vx: 0, vy: 0 });
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string; slot: number } | null>(null);
  const animationRef = useRef<number>();

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;
  const config = RISK_CONFIGS[riskLevel];
  const multipliers = config.multipliers;

  const canPlay = !dropping && bet > 0 && bet <= balance;

  // Generate triangle-shaped peg positions
  const pegs: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    const pegsInRow = row + 2;
    const rowWidth = 80;
    const spacing = rowWidth / (pegsInRow - 1);
    const rowX = 10; // Center offset
    for (let i = 0; i < pegsInRow; i++) {
      pegs.push({
        x: rowX + (i * spacing),
        y: 8 + (row * 5),
      });
    }
  }

  function dropBall() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setDropping(true);
    setResult(null);
    setBallPosition({ x: 50, y: 0 });
    setBallVelocity({ vx: (Math.random() - 0.5) * 2, vy: 0 });

    let currentX = 50;
    let currentY = 0;
    let vx = (Math.random() - 0.5) * 2;
    let vy = 0;

    const animate = () => {
      // Apply gravity
      vy += config.gravity;
      
      // Update position
      currentX += vx;
      currentY += vy;

      // Peg collision detection
      for (const peg of pegs) {
        const dx = currentX - peg.x;
        const dy = currentY - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) {
          // Collision with peg - bounce off
          const angle = Math.atan2(dy, dx);
          const speed = Math.sqrt(vx * vx + vy * vy);
          
          // Reflect velocity
          vx = Math.cos(angle) * speed * config.bounce + (Math.random() - 0.5) * 2;
          vy = -Math.abs(Math.sin(angle) * speed * config.bounce);
          
          // Push ball away from peg
          currentX += Math.cos(angle) * 2;
          currentY += Math.sin(angle) * 2;
        }
      }

      // Boundary collision
      if (currentX < 5) {
        currentX = 5;
        vx = -vx * config.bounce;
      }
      if (currentX > 95) {
        currentX = 95;
        vx = -vx * config.bounce;
      }

      // Update state
      setBallPosition({ x: currentX, y: currentY });
      setBallVelocity({ vx, vy });

      // Check if ball reached bottom
      if (currentY >= 85) {
        const slotIndex = Math.floor((currentX / 100) * SLOT_COUNT);
        const safeSlot = Math.max(0, Math.min(SLOT_COUNT - 1, slotIndex));
        const multiplier = multipliers[safeSlot];
        
        const won = multiplier >= 1;
        const payout = won ? bet * multiplier : 0;

        setResult({
          won,
          payout,
          message: won ? `Landed in ${multiplier}× slot!` : "Landed in losing slot",
          slot: safeSlot,
        });

        processGameResult(won, payout, bet);
        setDropping(false);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "plinko", option: riskLevel, betAmount: bet },
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
    setResult(null);
    setBallPosition({ x: 50, y: 0 });
    setBallVelocity({ vx: 0, vy: 0 });
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Plinko</h1>
          <p className="text-muted-foreground mt-2">Physics-based ball drop with triangle peg board. High payouts in center, lower on edges.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Plinko Board */}
          <Card className="bg-gradient-to-br from-sky-900/30 to-blue-900/30 border-sky-700/50 shadow-2xl">
            <CardContent className="p-6">
              <div className="relative h-96 bg-black/50 rounded-xl border-2 border-white/10 overflow-hidden">
                {/* Pegs - Triangle Shape */}
                {pegs.map((peg, i) => (
                  <Peg key={i} x={peg.x} y={peg.y} />
                ))}

                {/* Ball */}
                {dropping && <Ball x={ballPosition.x} y={ballPosition.y} />}

                {/* Slots */}
                <div className="absolute bottom-0 left-0 right-0 flex h-16">
                  {multipliers.map((mult, i) => (
                    <Slot
                      key={i}
                      multiplier={mult}
                      highlight={result?.slot === i}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              {/* Risk Level */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Risk level</p>
                <div className="grid grid-cols-3 gap-3">
                  {(["low", "medium", "high"] as const).map((level) => {
                    const levelConfig = RISK_CONFIGS[level];
                    const maxMult = Math.max(...levelConfig.multipliers);
                    return (
                      <button
                        key={level}
                        onClick={() => setRiskLevel(level)}
                        disabled={dropping}
                        className={`p-3 rounded-xl border-2 transition-all capitalize ${
                          riskLevel === level
                            ? "border-primary bg-primary/20 shadow-[0_0_20px_rgba(0,255,170,0.3)]"
                            : "border-white/10 bg-black/30 hover:border-white/20"
                        } ${dropping ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span className="font-semibold">{level}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          Max {maxMult}×
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Multipliers Display */}
              <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                <p className="text-xs text-muted-foreground mb-2">Current multipliers</p>
                <div className="flex flex-wrap gap-1">
                  {multipliers.map((mult, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded ${
                      mult >= 10 ? "bg-red-500/20 text-red-400" :
                      mult >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                      mult >= 2 ? "bg-green-500/20 text-green-400" :
                      mult >= 1 ? "bg-blue-500/20 text-blue-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {mult}×
                    </span>
                  ))}
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
                    disabled={dropping}
                    className="w-36 font-mono bg-black/50 border-white/20"
                  />
                  {[10, 25, 50, 100].map((v) => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(v))}
                      disabled={dropping}
                      className="border-white/20 hover:border-white/40"
                    >
                      {v}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(String(Math.floor(balance)))}
                    disabled={dropping}
                    className="border-white/20 hover:border-white/40"
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Drop Button */}
              <Button
                onClick={dropBall}
                disabled={!canPlay}
                className="w-full h-12 text-base bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-[0_0_30px_rgba(14,165,233,0.4)]"
              >
                {dropping ? (
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <CircleDot className="w-5 h-5" />
                    </motion.div>
                    Dropping...
                  </span>
                ) : (
                  `Drop Ball (${formatCurrency(bet || 0)})`
                )}
              </Button>

              {/* Result */}
              <AnimatePresence>
                {result && !dropping && (
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
                      {result.won ? "🎉 You Win!" : "😔 No Luck"}
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