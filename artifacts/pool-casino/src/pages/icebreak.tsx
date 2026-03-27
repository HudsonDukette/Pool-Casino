import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-icebreak.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;
const TOTAL = 16, DANGER = 4;

function prob(picks: number): number {
  let p = 1;
  for (let i = 0; i < picks; i++) p *= (12 - i) / (16 - i);
  return p;
}

function payout(picks: number): number {
  const p = prob(picks);
  return p > 0 ? parseFloat((0.95 / p).toFixed(2)) : 0;
}

export default function IceBreak() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [picks, setPicks] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/icebreak`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, picks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (!data.hitDanger) toast({ title: `❄️ All safe! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `💥 Cracked ice! Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const getTileState = (i: number) => {
    if (!result) return "hidden";
    if (result.dangerTiles.includes(i) && result.pickedTiles.includes(i)) return "cracked";
    if (result.dangerTiles.includes(i)) return "danger";
    if (result.pickedTiles.includes(i)) return "safe";
    return "hidden";
  };

  const PICK_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

  return (
    <GameShell heroImage={heroImg} title="Ice Break" description="A 4×4 grid hides 4 danger tiles. Choose how many to flip — all safe and you win big." accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Tiles to Flip</p>
              <div className="flex flex-wrap gap-2">
                {PICK_OPTIONS.map(n => (
                  <button key={n} disabled={loading} onClick={() => setPicks(n)}
                    className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all ${
                      picks === n ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}>
                    {n}
                    <div className="text-[10px] opacity-60">{(prob(n) * 100).toFixed(0)}%</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Win chance: <span className="text-white font-mono">{(prob(picks) * 100).toFixed(1)}%</span></span>
                <span>Payout: <span className="text-cyan-300 font-mono">{payout(picks)}×</span></span>
              </div>
            </div>
            <Button className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              size="lg" disabled={loading} onClick={handlePlay}>
              {loading ? "Breaking ice…" : `❄️ Flip ${picks} Tile${picks > 1 ? "s" : ""}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-4 min-h-[260px]">
            <div className="grid grid-cols-4 gap-2 w-full max-w-[240px]">
              {Array.from({ length: TOTAL }, (_, i) => {
                const state = getTileState(i);
                return (
                  <motion.div key={i}
                    animate={state !== "hidden" ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className={`aspect-square rounded-xl flex items-center justify-center text-lg transition-colors duration-200 ${
                      state === "cracked" ? "bg-red-500/30 border-2 border-red-500/60"
                      : state === "danger" ? "bg-orange-900/40 border-2 border-orange-500/30"
                      : state === "safe" ? "bg-cyan-500/20 border-2 border-cyan-500/50"
                      : "bg-white/5 border-2 border-white/10"
                    }`}>
                    {state === "cracked" ? "💥" : state === "danger" ? "🔥" : state === "safe" ? "❄️" : ""}
                  </motion.div>
                );
              })}
            </div>
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`text-center text-sm font-bold px-4 py-2 rounded-xl border ${
                    !result.hitDanger ? "text-cyan-300 bg-cyan-950/40 border-cyan-500/30" : "text-red-300 bg-red-950/40 border-red-500/30"
                  }`}>
                  {!result.hitDanger ? `❄️ All safe — +${formatCurrency(result.payout)}` : `💥 Hit a danger tile — lost`}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
