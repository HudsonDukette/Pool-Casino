import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency } from "@/lib/utils";

const SYMBOLS: Record<string, { emoji: string; color: string; payout: number }> = {
  seven:   { emoji: "7️⃣",  color: "text-red-400",    payout: 20 },
  diamond: { emoji: "💎",  color: "text-cyan-400",   payout: 10 },
  bell:    { emoji: "🔔",  color: "text-yellow-400", payout: 5  },
  orange:  { emoji: "🍊",  color: "text-orange-400", payout: 3  },
  cherry:  { emoji: "🍒",  color: "text-pink-400",   payout: 2  },
  lemon:   { emoji: "🍋",  color: "text-yellow-300", payout: 2  },
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

interface SlotsResult {
  won: boolean;
  reels: string[];
  payout: number;
  multiplier: number;
  newBalance: number;
}

function Reel({ symbol, spinning, delay, stopDelay }: { symbol: string; spinning: boolean; delay: number; stopDelay: number }) {
  const [displayIdx, setDisplayIdx] = useState(SYMBOL_KEYS.indexOf(symbol) >= 0 ? SYMBOL_KEYS.indexOf(symbol) : 0);
  const [stopped, setStopped] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (spinning) {
      setStopped(false);
      intervalRef.current = setInterval(() => {
        setDisplayIdx(i => (i + 1) % SYMBOL_KEYS.length);
      }, 60);
    } else {
      // Stop after delay, land on final symbol
      const timeout = setTimeout(() => {
        clearInterval(intervalRef.current);
        setDisplayIdx(SYMBOL_KEYS.indexOf(symbol) >= 0 ? SYMBOL_KEYS.indexOf(symbol) : 0);
        setStopped(true);
      }, stopDelay);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(intervalRef.current);
  }, [spinning, symbol, stopDelay]);

  const sym = SYMBOLS[SYMBOL_KEYS[displayIdx]] ?? SYMBOLS.cherry;
  const finalSym = SYMBOLS[symbol] ?? SYMBOLS.cherry;

  return (
    <div className="relative w-24 h-28 bg-black/50 rounded-2xl border-2 border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
      {/* Reel strip */}
      {spinning && !stopped ? (
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={{ y: [0, -56, 0] }}
          transition={{ duration: 0.15, repeat: Infinity, ease: "linear" }}
        >
          {[0, 1, 2].map(offset => {
            const s = SYMBOLS[SYMBOL_KEYS[(displayIdx + offset) % SYMBOL_KEYS.length]] ?? SYMBOLS.cherry;
            return (
              <span key={offset} className="text-4xl leading-none">{s.emoji}</span>
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          key={symbol + stopped}
          initial={stopped ? { y: -20, opacity: 0.5 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.span
            animate={stopped ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`text-5xl ${finalSym.color} drop-shadow-[0_0_12px_currentColor]`}
          >
            {finalSym.emoji}
          </motion.span>
        </motion.div>
      )}

      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30 rounded-2xl" />
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/10" />
    </div>
  );
}

export default function Slots() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<SlotsResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[]>(["cherry", "lemon", "orange"]);
  const [result, setResult] = useState<SlotsResult | null>(null);

  const bet = parseFloat(betAmount) || 0;

  async function handleSpin() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setSpinning(true);
    setResult(null);

    const data = await api.call("slots", { betAmount: bet });
    if (!data) {
      setSpinning(false);
      toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
      return;
    }
    if (data) {
      // Keep spinning visible, then stop reels one by one
      setTimeout(() => {
        setReels(data.reels);
        setSpinning(false);
        setTimeout(() => {
          setResult(data);
          qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
          qc.invalidateQueries({ queryKey: ["/api/pool"] });
          toast({
            title: data.won ? `${data.reels.map(r => SYMBOLS[r]?.emoji).join("")} Jackpot!` : "No match this time",
            description: data.won ? `${data.multiplier}× — Won ${formatCurrency(data.payout)}!` : "Keep spinning!",
            variant: data.won ? "default" : "destructive",
          });
        }, 600);
      }, 1200);
    } else {
      setSpinning(false);
    }
  }

  const payouts = [
    { sym: "seven",   label: "7️⃣ 7️⃣ 7️⃣", mult: "20×", color: "text-red-400" },
    { sym: "diamond", label: "💎 💎 💎", mult: "10×", color: "text-cyan-400" },
    { sym: "bell",    label: "🔔 🔔 🔔", mult: "5×",  color: "text-yellow-400" },
    { sym: "orange",  label: "🍊 🍊 🍊", mult: "3×",  color: "text-orange-400" },
    { sym: "cherry",  label: "🍒 🍒 🍒", mult: "2×",  color: "text-pink-400" },
    { sym: "lemon",   label: "🍋 🍋 🍋", mult: "2×",  color: "text-yellow-300" },
  ];

  return (
    <GameShell title="Neon Slots" description="Match all 3 reels to win. Higher symbols = bigger payouts!" accentColor="text-pink-400">
      <div className="space-y-6">
        {/* Slot Machine */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-8">
              {/* Machine frame */}
              <div className="relative">
                <div className="flex gap-3 p-4 bg-black/60 rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(219,39,119,0.15)]">
                  {reels.map((sym, i) => (
                    <Reel
                      key={i}
                      symbol={sym}
                      spinning={spinning}
                      delay={i * 0.15}
                      stopDelay={i * 200}
                    />
                  ))}
                </div>
                {/* Win flash overlay */}
                <AnimatePresence>
                  {result?.won && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.3, 0, 0.3, 0] }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 rounded-2xl bg-pink-400 pointer-events-none"
                    />
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <p className={`text-2xl font-display font-bold ${result.won ? "text-pink-400" : "text-destructive"}`}>
                      {result.won ? `🎰 ${result.multiplier}× Match!` : "No Match"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {result.won ? `Won ${formatCurrency(result.payout)}` : `Lost ${formatCurrency(bet)}`} · Balance: {formatCurrency(result.newBalance)}
                    </p>
                  </motion.div>
                ) : spinning ? (
                  <motion.p
                    key="spinning"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    className="text-pink-400 text-sm font-medium"
                  >
                    Spinning the reels…
                  </motion.p>
                ) : (
                  <motion.p key="idle" className="text-muted-foreground text-sm">
                    Spin to play!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={spinning || api.loading} />
              {api.error && <p className="text-sm text-destructive">{api.error}</p>}
              <Button
                className="w-full bg-pink-600/90 hover:bg-pink-500 text-white font-bold shadow-[0_0_20px_rgba(219,39,119,0.3)] hover:shadow-[0_0_30px_rgba(219,39,119,0.5)]"
                size="lg"
                disabled={spinning || api.loading}
                onClick={handleSpin}
              >
                {spinning ? "🎰 Spinning…" : "🎰 Spin"}
              </Button>
            </CardContent>
          </Card>

          {/* Paytable */}
          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground font-medium">Paytable</p>
              <div className="space-y-2">
                {payouts.map(p => (
                  <div key={p.sym} className="flex items-center justify-between text-sm">
                    <span className="font-mono tracking-widest">{p.label}</span>
                    <span className={`font-bold font-mono ${p.color}`}>{p.mult}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GameShell>
  );
}
