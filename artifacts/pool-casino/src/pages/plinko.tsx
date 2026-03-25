import React, { useState, useRef, useCallback } from "react";
import { usePlayPlinko, useGetPool, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Coins, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const RISK_LEVELS = {
  low:    { name: "Low",    color: "bg-blue-500",       textColor: "text-blue-400",    mults: [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5] },
  medium: { name: "Medium", color: "bg-yellow-500",     textColor: "text-yellow-400",  mults: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3] },
  high:   { name: "High",   color: "bg-destructive",    textColor: "text-red-400",     mults: [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1] }
};

interface BallState {
  id: number;
  coords: { x: number; y: number }[];
  multiplier: number;
  slot: number;
  won: boolean;
  animDuration: number;
}

const ROWS = 8;
const ROW_HEIGHT = 44;
const PEG_SPACING = 42;
const BOARD_WIDTH = (ROWS + 2) * PEG_SPACING; // dynamic based on slots

export default function Plinko() {
  const { data: pool } = useGetPool();
  const { data: user } = useGetMe({ query: { retry: false } });
  const playMut = usePlayPlinko();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [betAmount, setBetAmount] = useState<string>("10");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [balls, setBalls] = useState<BallState[]>([]);
  const [highlightedSlot, setHighlightedSlot] = useState<number | null>(null);
  const nextBallId = useRef(0);
  const MAX_BALLS = 100;

  const numericBet = parseFloat(betAmount) || 0;

  const handlePlay = useCallback(() => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to play.", variant: "destructive" });
      return;
    }
    if (numericBet <= 0) {
      toast({ title: "Invalid Bet", description: "Enter a valid bet amount.", variant: "destructive" });
      return;
    }
    if (numericBet > user.balance) {
      toast({ title: "Insufficient Funds", description: "You don't have enough coins.", variant: "destructive" });
      return;
    }
    if (balls.length >= MAX_BALLS) {
      toast({ title: "Max balls reached", description: "Wait for some balls to finish before dropping more.", variant: "destructive" });
      return;
    }

    playMut.mutate(
      { data: { betAmount: numericBet, risk } },
      {
        onSuccess: (data) => {

          // Build pixel coords for the ball path (using x/y transforms)
          let cx = 0;
          let cy = 0;
          const coords: { x: number; y: number }[] = [{ x: cx, y: cy }];
          data.path.forEach((dir) => {
            cy += ROW_HEIGHT;
            cx += dir === "R" ? PEG_SPACING / 2 : -PEG_SPACING / 2;
            coords.push({ x: cx, y: cy });
          });
          // Final position in the slot
          cy += ROW_HEIGHT * 0.6;
          coords.push({ x: cx, y: cy });

          const ballId = nextBallId.current++;
          const animDuration = coords.length * 0.22;

          const newBall: BallState = {
            id: ballId,
            coords,
            multiplier: data.multiplier,
            slot: data.slot,
            won: data.won,
            animDuration,
          };

          setBalls((prev) => [...prev, newBall]);

          // Highlight slot when ball arrives
          const highlightDelay = animDuration * 1000 + 100;
          setTimeout(() => {
            setHighlightedSlot(data.slot);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pool"] });

            if (data.won) {
              toast({
                title: `${data.multiplier}x Win!`,
                description: `You won ${formatCurrency(data.payout)}`,
                className: "bg-success text-success-foreground border-none",
              });
            }

            setTimeout(() => setHighlightedSlot(null), 1200);
          }, highlightDelay);

          // Remove ball after animation + a pause
          setTimeout(() => {
            setBalls((prev) => prev.filter((b) => b.id !== ballId));
          }, highlightDelay + 800);
        },
        onError: (err) => {
          toast({ title: "Error", description: err.error?.error || "Failed to place bet", variant: "destructive" });
        },
      }
    );
  }, [user, numericBet, risk, playMut, queryClient, toast]);

  // Render pegs
  const pegs: React.ReactNode[] = [];
  for (let r = 1; r <= ROWS; r++) {
    const pegsInRow = r + 1;
    const startX = -((pegsInRow - 1) * PEG_SPACING) / 2;
    for (let p = 0; p < pegsInRow; p++) {
      pegs.push(
        <div
          key={`peg-${r}-${p}`}
          className="absolute w-2.5 h-2.5 rounded-full bg-white/30 shadow-[0_0_6px_rgba(255,255,255,0.25)]"
          style={{
            top: `${r * ROW_HEIGHT}px`,
            left: `calc(50% + ${startX + p * PEG_SPACING}px)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      );
    }
  }

  const mults = RISK_LEVELS[risk].mults;
  const boardHeight = ROWS * ROW_HEIGHT + ROW_HEIGHT * 1.8;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Game Board */}
        <div className="flex-1 flex flex-col">
          <Card className="bg-black border-white/10 overflow-hidden relative flex-1 flex flex-col shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,255,0.06),transparent_70%)]" />

            <div
              className="relative w-full max-w-md mx-auto"
              style={{ height: `${boardHeight}px` }}
            >
              {/* Pegs */}
              {pegs}

              {/* Active balls */}
              <AnimatePresence>
                {balls.map((ball) => (
                  <motion.div
                    key={ball.id}
                    className="absolute w-4 h-4 rounded-full z-20 pointer-events-none"
                    style={{
                      left: "50%",
                      top: 0,
                      marginLeft: -8,
                      marginTop: -8,
                      background: ball.won
                        ? "radial-gradient(circle, #fbbf24, #f59e0b)"
                        : "radial-gradient(circle, #e879f9, #a21caf)",
                      boxShadow: ball.won
                        ? "0 0 14px 3px rgba(251,191,36,0.8)"
                        : "0 0 14px 3px rgba(232,121,249,0.8)",
                    }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                      x: ball.coords.map((c) => c.x),
                      y: ball.coords.map((c) => c.y),
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      duration: ball.animDuration,
                      ease: "linear",
                      times: ball.coords.map((_, i) =>
                        i / Math.max(1, ball.coords.length - 1)
                      ),
                    }}
                  />
                ))}
              </AnimatePresence>

              {/* Multiplier slots */}
              <div
                className="absolute w-full flex justify-center gap-1 px-3"
                style={{ top: `${ROWS * ROW_HEIGHT + ROW_HEIGHT * 0.4}px` }}
              >
                {mults.map((m, i) => {
                  const isHighlighted = highlightedSlot === i;
                  return (
                    <motion.div
                      key={i}
                      animate={isHighlighted ? { scale: 1.15 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      className={`flex-1 flex items-center justify-center rounded-md py-2 text-xs font-mono font-bold transition-colors duration-200 ${
                        isHighlighted
                          ? `${RISK_LEVELS[risk].color} text-white shadow-[0_0_18px_currentColor]`
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {m}x
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="w-full md:w-80 space-y-6">
          <Card className="border-white/10 bg-card/80">
            <CardContent className="p-6 space-y-6">

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Bet Amount</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0.01"
                    step="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="pl-10 font-mono text-lg h-14 bg-black/50 focus-visible:ring-secondary focus-visible:border-secondary"
                    icon={<Coins className="w-5 h-5" />}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(Math.max(0.01, numericBet / 2)))}>½</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(numericBet * 2))}>2×</Button>
                  {user && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(user.balance))}>Max</Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex justify-between">
                  Risk Level
                  <span className="text-xs text-secondary/70 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Alters payouts
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as const).map((r) => (
                    <Button
                      key={r}
                      variant={risk === r ? "default" : "outline"}
                      onClick={() => setRisk(r)}
                      className={`capitalize ${risk === r ? "bg-secondary hover:bg-secondary/90 shadow-secondary/20" : "hover:text-secondary hover:border-secondary/50"}`}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Win odds display */}
              {pool && (
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Win chance at ${numericBet || 0}</span>
                    <span className="text-white font-mono font-medium">
                      {pool.totalAmount
                        ? (() => {
                            const ratio = numericBet / (pool.totalAmount * 0.002);
                            const chance = Math.max(0.01, 0.38 / (1 + ratio));
                            return `${(chance * 100).toFixed(1)}%`;
                          })()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Balls in flight</span>
                    <span className={`font-mono font-medium ${balls.length > 0 ? "text-secondary" : "text-white"}`}>
                      {balls.length}
                    </span>
                  </div>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-16 text-xl bg-secondary hover:bg-secondary/90 shadow-secondary/20"
                onClick={handlePlay}
                disabled={numericBet <= 0 || !user}
              >
                Drop Ball
              </Button>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
