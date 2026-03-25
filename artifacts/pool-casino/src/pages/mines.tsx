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

interface MinesResult {
  won: boolean;
  minesCount: number;
  revealCount: number;
  revealedTiles: number[];
  mines: number[];
  hitMine: boolean;
  potentialMultiplier: number;
  payout: number;
  multiplier: number;
  newBalance: number;
}

function calcMultiplier(mines: number, reveals: number): number {
  let m = 1;
  for (let i = 0; i < reveals; i++) {
    const safe = 25 - mines - i;
    const tiles = 25 - i;
    m *= (tiles / safe) * 0.97;
  }
  return parseFloat(m.toFixed(2));
}

export default function Mines() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<MinesResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [minesCount, setMinesCount] = useState(5);
  const [revealCount, setRevealCount] = useState(3);
  const [result, setResult] = useState<MinesResult | null>(null);

  const bet = parseFloat(betAmount) || 0;
  const maxReveal = 25 - minesCount;
  const previewMult = calcMultiplier(minesCount, Math.min(revealCount, maxReveal));

  async function handlePlay() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setResult(null);
    const data = await api.call("mines", { betAmount: bet, minesCount, revealCount: Math.min(revealCount, maxReveal) });
    if (data) {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["getMe"] });
      qc.invalidateQueries({ queryKey: ["getPool"] });
      toast({
        title: data.hitMine ? "💥 BOOM! You hit a mine!" : `✅ Safe! ${data.multiplier}×`,
        description: data.hitMine ? `Lost ${formatCurrency(bet)}` : `Won ${formatCurrency(data.payout)}!`,
        variant: data.hitMine ? "destructive" : "default",
      });
    }
  }

  return (
    <GameShell title="Mines" description="Choose how many mines to hide and how many tiles to reveal. More reveals = bigger multiplier!" accentColor="text-orange-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grid */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 25 }, (_, i) => {
                const isRevealed = result?.revealedTiles.includes(i);
                const isMine = result?.mines.includes(i);
                const isSafe = isRevealed && !isMine;
                const isHitMine = isRevealed && isMine;

                return (
                  <motion.div
                    key={i}
                    animate={result ? { scale: isRevealed ? [1, 1.1, 1] : 1 } : {}}
                    transition={{ delay: (result?.revealedTiles.indexOf(i) ?? 0) * 0.05 }}
                    className={`h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      !result
                        ? "border-white/10 bg-white/5"
                        : isSafe
                        ? "border-primary/40 bg-primary/10"
                        : isHitMine
                        ? "border-destructive bg-destructive/30 animate-pulse"
                        : isMine
                        ? "border-orange-500/30 bg-orange-500/10"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    {!result ? "?" :
                     isHitMine ? "💥" :
                     isSafe ? "✅" :
                     isMine ? "💣" : ""}
                  </motion.div>
                );
              })}
            </div>
            {!result && (
              <p className="text-center text-muted-foreground text-sm mt-4">Configure and play to see the board</p>
            )}
            {result && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-3 rounded-xl text-center ${result.hitMine ? "bg-destructive/10 border border-destructive/30" : "bg-primary/10 border border-primary/30"}`}
                >
                  <p className={`font-display font-bold text-xl ${result.hitMine ? "text-destructive" : "text-primary"}`}>
                    {result.hitMine ? "💥 Mine hit!" : `${result.multiplier}× — Safe!`}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {result.hitMine ? `Lost ${formatCurrency(bet)}` : `Won ${formatCurrency(result.payout)}`}
                    {" · "}Balance: {formatCurrency(result.newBalance)}
                  </p>
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground font-medium">Mines</p>
                <span className="font-mono font-bold text-orange-400 text-lg">{minesCount}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[minesCount]} onValueChange={([v]) => setMinesCount(v)} disabled={api.loading} />
              <div className="flex gap-2">
                {[3, 5, 10, 15].map(n => (
                  <button key={n} onClick={() => setMinesCount(n)} className={`flex-1 py-1 rounded text-xs font-mono border transition-colors ${minesCount === n ? "border-orange-400 bg-orange-400/20 text-orange-400" : "border-white/10 bg-white/5"}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground font-medium">Tiles to Reveal</p>
                <span className="font-mono font-bold text-cyan-400 text-lg">{Math.min(revealCount, maxReveal)}</span>
              </div>
              <Slider min={1} max={maxReveal} step={1} value={[Math.min(revealCount, maxReveal)]} onValueChange={([v]) => setRevealCount(v)} disabled={api.loading} />
            </div>

            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential multiplier</span>
                <span className="font-mono font-bold text-primary">{previewMult}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential payout</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(bet * previewMult)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Safe tiles remaining</span>
                <span className="font-mono text-muted-foreground">{maxReveal}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              className="w-full bg-orange-600/90 hover:bg-orange-500 text-white font-bold"
              size="lg"
              disabled={api.loading}
              onClick={handlePlay}
            >
              {api.loading ? "Revealing…" : `💣 Play — ${previewMult}× potential`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
