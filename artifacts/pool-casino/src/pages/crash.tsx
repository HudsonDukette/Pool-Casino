import React, { useState, useEffect, useRef } from "react";
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

interface CrashResult {
  won: boolean;
  crashAt: number;
  cashOutAt: number;
  payout: number;
  multiplier: number;
  newBalance: number;
}

export default function Crash() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<CrashResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [cashOutAt, setCashOutAt] = useState(2);
  const [running, setRunning] = useState(false);
  const [displayMult, setDisplayMult] = useState(1.0);
  const [result, setResult] = useState<CrashResult | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval>>();
  const crashRef = useRef<number | null>(null);

  const bet = parseFloat(betAmount) || 0;

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  async function handlePlay() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setRunning(true);
    setResult(null);
    setDisplayMult(1.0);
    crashRef.current = null;

    // Pre-fetch result from server
    const data = await api.call("crash", { betAmount: bet, cashOutAt });
    if (!data) { setRunning(false); return; }
    crashRef.current = data.crashAt;

    // Animate multiplier climbing
    let current = 1.0;
    const target = Math.min(data.cashOutAt, data.crashAt);
    const step = (target - 1.0) / 40;

    animRef.current = setInterval(() => {
      current = Math.min(target, current + step + current * 0.015);
      setDisplayMult(parseFloat(current.toFixed(2)));

      if (current >= target) {
        clearInterval(animRef.current);
        // Small pause before showing crash
        setTimeout(() => {
          setDisplayMult(parseFloat(data.cashOutAt.toFixed(2)));
          setResult(data);
          setRunning(false);
          qc.invalidateQueries({ queryKey: ["getMe"] });
          qc.invalidateQueries({ queryKey: ["getPool"] });
          toast({
            title: data.won ? `Cashed out at ${data.cashOutAt}×! 🚀` : `Crashed at ${data.crashAt}×`,
            description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
            variant: data.won ? "default" : "destructive",
          });
        }, 400);
      }
    }, 60);
  }

  const crashed = result && !result.won;
  const color = crashed ? "text-destructive" : running ? "text-green-400" : "text-primary";

  return (
    <GameShell title="Crash" description="Set your auto-cashout, then watch the rocket. Cash out before it crashes!" accentColor="text-red-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Display */}
        <Card className={`bg-black/60 border-2 transition-colors ${crashed ? "border-destructive/40" : "border-primary/20"}`}>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4 min-h-[320px]">
            <motion.div
              animate={running ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={`text-7xl font-display font-black tracking-tight ${color} drop-shadow-[0_0_30px_currentColor]`}
            >
              {displayMult.toFixed(2)}×
            </motion.div>

            <div className="text-center">
              {running && !crashed && (
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-green-400 text-sm font-medium"
                >
                  🚀 Climbing…
                </motion.p>
              )}
              {result && (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1 text-center">
                    <p className={`text-2xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? `Cashed out at ${result.cashOutAt}×!` : `💥 Crashed at ${result.crashAt}×`}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {result.won ? `Won ${formatCurrency(result.payout)}` : `Lost ${formatCurrency(bet)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">New balance: {formatCurrency(result.newBalance)}</p>
                  </motion.div>
                </AnimatePresence>
              )}
              {!running && !result && (
                <p className="text-muted-foreground text-sm">Set your target and launch!</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Auto Cash-Out</p>
                <span className="text-xl font-mono font-bold text-primary">{cashOutAt.toFixed(1)}×</span>
              </div>
              <Slider
                min={1.1}
                max={20}
                step={0.1}
                value={[cashOutAt]}
                onValueChange={([v]) => setCashOutAt(v)}
                disabled={running || api.loading}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1.1×</span>
                <span>Safer ←→ Riskier</span>
                <span>20×</span>
              </div>
              <div className="flex gap-2">
                {[1.5, 2, 3, 5, 10].map(v => (
                  <button
                    key={v}
                    onClick={() => setCashOutAt(v)}
                    disabled={running}
                    className={`flex-1 py-1.5 rounded text-xs font-mono border transition-colors ${cashOutAt === v ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                  >
                    {v}×
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={running || api.loading} />
            </div>

            <div className="text-xs text-muted-foreground space-y-1 bg-white/5 p-3 rounded-lg">
              <p>Potential win: <span className="text-primary font-mono">{formatCurrency(bet * cashOutAt)}</span></p>
              <p>If crash ≥ {cashOutAt}× → you win at exactly {cashOutAt}×</p>
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              className="w-full bg-red-500/90 hover:bg-red-400 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              size="lg"
              disabled={running || api.loading}
              onClick={handlePlay}
            >
              {running ? "Rocket Flying…" : "🚀 Launch"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
