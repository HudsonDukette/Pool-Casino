import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput, ResultCard } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency } from "@/lib/utils";

const DICE_FACES: Record<number, string[]> = {
  1: ["", "", "", "●", "", "", ""],
  2: ["●", "", "", "", "", "", "●"],
  3: ["●", "", "", "●", "", "", "●"],
  4: ["●", "●", "", "", "", "●", "●"],
  5: ["●", "●", "", "●", "", "●", "●"],
  6: ["●", "●", "●", "", "●", "●", "●"],
};

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 90, 180, 270, 360] } : { rotate: 0 }}
      transition={rolling ? { duration: 0.6, repeat: Infinity } : { duration: 0.3 }}
      className="w-24 h-24 bg-white/10 rounded-2xl border-2 border-white/20 grid grid-cols-3 grid-rows-3 gap-1 p-3 shadow-[0_0_30px_rgba(0,255,170,0.2)]"
    >
      {(DICE_FACES[value] || DICE_FACES[1]).map((dot, i) => (
        <div key={i} className="flex items-center justify-center">
          <span className="text-lg leading-none">{dot}</span>
        </div>
      ))}
    </motion.div>
  );
}

interface DiceResult {
  won: boolean;
  rolled: number;
  payout: number;
  multiplier: number;
  newBalance: number;
  betType: string;
  prediction: number;
}

export default function Dice() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<DiceResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [betType, setBetType] = useState<"exact" | "high" | "low">("high");
  const [prediction, setPrediction] = useState(6);
  const [dieValue, setDieValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);

  const bet = parseFloat(betAmount) || 0;
  const payout = betType === "exact" ? "5x" : "1.9x";

  async function handleRoll() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setRolling(true);
    setResult(null);

    // Animate rolling
    const interval = setInterval(() => setDieValue(Math.ceil(Math.random() * 6)), 80);
    setTimeout(async () => {
      clearInterval(interval);
      const data = await api.call("dice", { betAmount: bet, betType, prediction });
      setRolling(false);
      if (data) {
        setDieValue(data.rolled);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["getMe"] });
        qc.invalidateQueries({ queryKey: ["getPool"] });
        toast({
          title: data.won ? `You rolled ${data.rolled}! 🎲` : `Rolled ${data.rolled}`,
          description: data.won ? `Won ${formatCurrency(data.payout)}!` : "Better luck next time",
          variant: data.won ? "default" : "destructive",
        });
      }
    }, 800);
  }

  return (
    <GameShell title="Dice Roll" description="Pick exact or high/low — exact pays 5x, high/low pays 1.9x." accentColor="text-yellow-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Type</p>
              <div className="grid grid-cols-3 gap-2">
                {(["high", "low", "exact"] as const).map(t => (
                  <Button
                    key={t}
                    variant={betType === t ? "default" : "outline"}
                    size="sm"
                    className="capitalize border-white/10"
                    onClick={() => setBetType(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {betType === "exact" ? "Guess the exact number — 5× payout" :
                 betType === "high" ? "Roll 4, 5, or 6 — 1.9× payout" :
                 "Roll 1, 2, or 3 — 1.9× payout"}
              </p>
            </div>

            {betType === "exact" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Your Number</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      onClick={() => setPrediction(n)}
                      className={`w-10 h-10 rounded-lg border font-mono font-bold transition-all ${
                        prediction === n
                          ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                          : "border-white/10 bg-white/5 text-white hover:border-white/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={rolling || api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              className="w-full bg-yellow-500/90 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)]"
              size="lg"
              disabled={rolling || api.loading}
              onClick={handleRoll}
            >
              {rolling ? "Rolling…" : `Roll (${payout} payout)`}
            </Button>
          </CardContent>
        </Card>

        {/* Die Display */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[320px]">
            <DieFace value={dieValue} rolling={rolling} />
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-1"
                >
                  <p className={`text-2xl font-display font-bold ${result.won ? "text-yellow-400" : "text-destructive"}`}>
                    {result.won ? "Winner!" : "No Luck"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Rolled {result.rolled} · {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    New balance: {formatCurrency(result.newBalance)}
                  </p>
                </motion.div>
              )}
              {!result && !rolling && (
                <p className="text-muted-foreground text-sm">Press Roll to play</p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
