import React, { useState } from "react";
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

function Reel({ symbol, spinning, delay }: { symbol: string; spinning: boolean; delay: number }) {
  const [displayIdx, setDisplayIdx] = useState(0);
  const s = SYMBOLS[symbol] ?? SYMBOLS.cherry;

  return (
    <motion.div
      animate={spinning ? {} : { scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3, delay }}
      className="w-24 h-28 bg-black/50 rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden"
    >
      {spinning ? (
        <motion.div
          animate={{ y: [0, -50, 0, -80, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
          className="text-5xl"
        >
          {SYMBOLS[SYMBOL_KEYS[displayIdx % SYMBOL_KEYS.length]]?.emoji}
        </motion.div>
      ) : (
        <motion.span
          key={symbol}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-5xl ${s.color}`}
        >
          {s.emoji}
        </motion.span>
      )}
    </motion.div>
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
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setSpinning(true);
    setResult(null);

    setTimeout(async () => {
      const data = await api.call("slots", { betAmount: bet });
      setSpinning(false);
      if (data) {
        setReels(data.reels);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["getMe"] });
        qc.invalidateQueries({ queryKey: ["getPool"] });
        toast({
          title: data.won ? `${data.reels.map(r => SYMBOLS[r]?.emoji).join("")} Jackpot!` : "No match this time",
          description: data.won ? `${data.multiplier}× — Won ${formatCurrency(data.payout)}!` : "Keep spinning!",
          variant: data.won ? "default" : "destructive",
        });
      }
    }, 900);
  }

  const payouts = [
    { sym: "seven",   label: "7️⃣ 7️⃣ 7️⃣", mult: "20×" },
    { sym: "diamond", label: "💎 💎 💎", mult: "10×" },
    { sym: "bell",    label: "🔔 🔔 🔔", mult: "5×"  },
    { sym: "orange",  label: "🍊 🍊 🍊", mult: "3×"  },
    { sym: "cherry",  label: "🍒 🍒 🍒", mult: "2×"  },
    { sym: "lemon",   label: "🍋 🍋 🍋", mult: "2×"  },
  ];

  return (
    <GameShell title="Neon Slots" description="Match all 3 reels to win. Higher symbols = bigger payouts!" accentColor="text-pink-400">
      <div className="space-y-6">
        {/* Reels */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-8">
              <div className="flex gap-4">
                {reels.map((sym, i) => (
                  <Reel key={i} symbol={sym} spinning={spinning} delay={i * 0.15} />
                ))}
              </div>

              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <p className={`text-2xl font-display font-bold ${result.won ? "text-pink-400" : "text-destructive"}`}>
                      {result.won ? `${result.multiplier}× Match!` : "No Match"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {result.won ? `Won ${formatCurrency(result.payout)}` : `Lost ${formatCurrency(bet)}`} · Balance: {formatCurrency(result.newBalance)}
                    </p>
                  </motion.div>
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
                className="w-full bg-pink-600/90 hover:bg-pink-500 text-white font-bold shadow-[0_0_20px_rgba(219,39,119,0.3)]"
                size="lg"
                disabled={spinning || api.loading}
                onClick={handleSpin}
              >
                {spinning ? "Spinning…" : "🎰 Spin"}
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
                    <span className="font-mono">{p.label}</span>
                    <span className={`font-bold font-mono ${SYMBOLS[p.sym]?.color}`}>{p.mult}</span>
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
