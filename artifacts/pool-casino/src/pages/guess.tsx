import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency } from "@/lib/utils";

interface GuessResult {
  won: boolean;
  guessed: number;
  actual: number;
  distance: number;
  multiplier: number;
  payout: number;
  newBalance: number;
}

const PAYOUT_TABLE = [
  { cond: "Exact match", mult: "50×",  color: "text-yellow-400" },
  { cond: "Within 1",    mult: "10×",  color: "text-primary" },
  { cond: "Within 5",    mult: "3×",   color: "text-cyan-400" },
  { cond: "Within 10",   mult: "2×",   color: "text-green-400" },
  { cond: "Within 20",   mult: "1.5×", color: "text-blue-400" },
  { cond: "Off by > 20", mult: "0×",   color: "text-destructive" },
];

export default function Guess() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<GuessResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [guess, setGuess] = useState(50);
  const [result, setResult] = useState<GuessResult | null>(null);

  const bet = parseFloat(betAmount) || 0;

  async function handleGuess() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setResult(null);
    const data = await api.call("guess", { betAmount: bet, guess });
    if (data) {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["getMe"] });
      qc.invalidateQueries({ queryKey: ["getPool"] });
      toast({
        title: data.distance === 0 ? "🎯 EXACT!" : data.multiplier > 0 ? `Within ${data.distance}!` : `Off by ${data.distance}`,
        description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
        variant: data.won ? "default" : "destructive",
      });
    }
  }

  return (
    <GameShell title="Number Guess" description="Pick 1–100. Closer to the secret number = bigger payout!" accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Your Guess</p>
                <span className="text-4xl font-display font-bold text-cyan-400">{guess}</span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[guess]}
                onValueChange={([v]) => setGuess(v)}
                disabled={api.loading}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>50</span>
                <span>100</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 25, 42, 50, 69, 77, 99, 100].map(n => (
                  <button
                    key={n}
                    onClick={() => setGuess(n)}
                    className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                      guess === n
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-400"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold"
              size="lg"
              disabled={api.loading}
              onClick={handleGuess}
            >
              {api.loading ? "Guessing…" : "🎯 Lock In Guess"}
            </Button>
          </CardContent>
        </Card>

        {/* Result & Paytable */}
        <div className="space-y-4">
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`border-2 ${result.won ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-2xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                          {result.distance === 0 ? "🎯 EXACT!" : result.won ? "Close Enough!" : "Too Far Off"}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Secret was <span className="font-mono font-bold text-white">{result.actual}</span> · Off by {result.distance}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-mono font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                          {result.multiplier > 0 ? `${result.multiplier}×` : "0×"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t border-white/10 pt-3">
                      <span className="text-muted-foreground">Payout</span>
                      <span className={`font-mono font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                        {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground font-medium">Payout Table</p>
              <div className="space-y-2">
                {PAYOUT_TABLE.map(p => (
                  <div key={p.cond} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.cond}</span>
                    <span className={`font-mono font-bold ${p.color}`}>{p.mult}</span>
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
