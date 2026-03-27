import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-pyramid.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const PAYOUTS = [0, 1.9, 3.5, 6.5, 12, 23];
const WIN_CHANCES = ["–", "50%", "25%", "12.5%", "6.25%", "3.1%"];

export default function Pyramid() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [depth, setDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/pyramid`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (data.won) toast({ title: `🔺 Cleared all ${depth} levels! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `💀 Failed at level ${data.failedAt}. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell heroImage={heroImg} title="Pyramid Pick" description="Climb through up to 5 levels, each with 50/50 odds. Survive them all to collect your multiplier." accentColor="text-amber-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Levels to Attempt</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(d => (
                  <button key={d} disabled={loading} onClick={() => setDepth(d)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                      depth === d ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}>
                    {d}
                    <div className="text-[10px] opacity-70 mt-0.5">{PAYOUTS[d]}×</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Win chance: <span className="text-amber-300 font-mono">{WIN_CHANCES[depth]}</span></span>
                <span>Payout: <span className="text-amber-300 font-mono">{PAYOUTS[depth]}×</span></span>
              </div>
            </div>
            <Button className="w-full bg-amber-600/90 hover:bg-amber-500 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              size="lg" disabled={loading} onClick={handlePlay}>
              {loading ? "Climbing…" : `🔺 Climb ${depth} Level${depth > 1 ? "s" : ""}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2 min-h-[280px]">
            <div className="flex flex-col-reverse items-center gap-2 w-full max-w-[240px]">
              {Array.from({ length: 5 }, (_, i) => {
                const lvl = i + 1;
                const levelResult = result?.levelResults?.[lvl - 1];
                const isFailed = result?.failedAt === lvl;
                const isAttempted = lvl <= (result?.depth ?? depth);
                const width = 44 + lvl * 12;
                return (
                  <motion.div key={lvl}
                    animate={result && isAttempted ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ delay: lvl * 0.1 }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      !result || !isAttempted ? "bg-white/5 border-white/10 text-muted-foreground"
                      : isFailed ? "bg-red-950/60 border-red-500/50 text-red-300"
                      : levelResult ? "bg-amber-950/60 border-amber-500/50 text-amber-300"
                      : "bg-white/5 border-white/10 text-muted-foreground"
                    }`}
                    style={{ width: `${width}px` }}>
                    <span>Lvl {lvl}</span>
                    <span>{isFailed ? "💀" : levelResult ? "✅" : !result ? "–" : ""}</span>
                    <span className="font-mono">{PAYOUTS[lvl]}×</span>
                  </motion.div>
                );
              })}
            </div>
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 text-center text-sm font-bold px-4 py-2 rounded-xl border ${
                    result.won ? "text-amber-300 bg-amber-950/40 border-amber-500/30" : "text-red-300 bg-red-950/40 border-red-500/30"
                  }`}>
                  {result.won ? `🔺 +${formatCurrency(result.payout)}` : `💀 Failed at level ${result.failedAt}`}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
