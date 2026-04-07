import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-highlow.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

function CardFace({ label, suit = "♠" }: { label: string; suit?: string }) {
  const isRoyal = ["J", "Q", "K", "A"].includes(label);
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-28 h-40 rounded-2xl border-2 border-white/20 bg-gradient-to-br from-white/15 to-white/5 shadow-2xl flex flex-col items-center justify-center select-none"
    >
      <span className={`text-5xl font-display font-black ${isRoyal ? "text-yellow-300" : "text-white"}`}>{label}</span>
      <span className={`text-2xl ${isRoyal ? "text-yellow-300" : "text-white"}`}>{suit}</span>
    </motion.div>
  );
}

function ChainSteps({ chain }: { chain: number }) {
  const steps = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {steps.map(n => {
        const done = chain >= n;
        const breakEven = n === 4;
        return (
          <div key={n} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
            done ? (breakEven ? "bg-yellow-500/80 border-yellow-400 text-black" : "bg-emerald-500/80 border-emerald-400 text-white")
                 : "bg-white/5 border-white/20 text-white/30"
          }`}>
            {n === 4 ? "⚖" : n}
          </div>
        );
      })}
      {chain > 7 && <span className="text-emerald-400 font-bold text-sm">+{chain - 7}</span>}
    </div>
  );
}

type Phase = "idle" | "playing" | "done";

export default function HighLow() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentCard, setCurrentCard] = useState<{ card: number; label: string } | null>(null);
  const [prevCard, setPrevCard] = useState<{ card: number; label: string } | null>(null);
  const [chain, setChain] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [lastGuessResult, setLastGuessResult] = useState<{ correct: boolean; tie: boolean } | null>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setLastGuessResult(null); setPrevCard(null);
    try {
      const res = await fetch(`${BASE}api/games/highlow/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCurrentCard({ card: data.card, label: data.label });
      setChain(0); setMultiplier(0); setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleGuess(guess: "higher" | "lower") {
    if (loading || !currentCard || phase !== "playing") return;
    setLoading(true); setLastGuessResult(null);
    try {
      const res = await fetch(`${BASE}api/games/highlow/guess`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPrevCard(currentCard);
      setLastGuessResult({ correct: data.correct, tie: data.tie });
      if (!data.correct) {
        setResult(data); setPhase("done");
        toast({ title: `❌ Wrong! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else if (data.tie) {
        setCurrentCard({ card: currentCard.card, label: currentCard.label });
        toast({ title: "🤝 Tie — no change, keep going!", className: "bg-yellow-950 text-yellow-200 border-none" });
      } else {
        setCurrentCard({ card: data.card2Val ?? currentCard.card, label: data.card2 });
        setChain(data.chain); setMultiplier(data.multiplier);
        if (data.chain === 4) toast({ title: "⚖️ Break even! 4 in a row — now every win is pure profit!", className: "bg-yellow-950 text-yellow-200 border-none" });
        else toast({ title: `✅ Correct! Chain ${data.chain} · ${data.multiplier}×`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    if (loading || phase !== "playing" || chain === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/games/highlow/cashout`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data); setPhase("done");
      toast({ title: `💰 Cashed out! Chain ${data.chain} · +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  function handleReset() {
    setPhase("idle"); setCurrentCard(null); setPrevCard(null);
    setChain(0); setMultiplier(0); setResult(null); setLastGuessResult(null);
  }

  const mult = chainMultiplier(chain);
  function chainMultiplier(n: number) { return n <= 0 ? 0 : n <= 4 ? n * 0.25 : n - 3; }

  return (
    <GameShell casinoId={casinoId} gameType="highlow" payTableEntries={GAME_PAY_TABLES.highlow}
      heroImage={heroImg} title="High-Low Chain" accentColor="text-yellow-400"
      description="Build a chain of correct guesses. Break-even at 4 in a row, then every extra guess is pure profit. Cash out anytime!"
      backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t border-white/5 pt-3">
                  <p>• 4 correct in a row = break-even (1×)</p>
                  <p>• 5 correct = 2×, 6 correct = 3×, and so on</p>
                  <p>• Wrong guess = lose your bet</p>
                  <p>• Ties don't advance or break the chain</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#d97706,#b45309)", boxShadow: "0 0 20px rgba(217,119,6,0.3)" }}>
                  {loading ? "Starting…" : "🃏 Start Chain"}
                </Button>
              </>
            ) : phase === "playing" ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Current Chain</p>
                  <ChainSteps chain={chain} />
                </div>
                <div className="text-center">
                  <span className={`text-3xl font-black ${mult >= 1 ? "text-emerald-400" : mult > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                    {mult.toFixed(2)}×
                  </span>
                  <p className="text-xs text-muted-foreground">current multiplier</p>
                </div>
                <p className="text-xs text-center text-muted-foreground">Will the next card be…</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-lg"
                    disabled={loading} onClick={() => handleGuess("higher")}>
                    ⬆️ Higher
                  </Button>
                  <Button className="h-14 bg-red-600/80 hover:bg-red-500 text-white font-bold text-lg"
                    disabled={loading} onClick={() => handleGuess("lower")}>
                    ⬇️ Lower
                  </Button>
                </div>
                <Button variant="outline" className="w-full font-bold border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                  disabled={loading || chain === 0} onClick={handleCashout}>
                  💰 Cash Out ({mult.toFixed(2)}×)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`text-center p-4 rounded-xl border ${result?.won ? "bg-emerald-950/40 border-emerald-500/30" : "bg-red-950/40 border-red-500/30"}`}>
                  <p className={`text-2xl font-black ${result?.won ? "text-emerald-300" : "text-red-300"}`}>
                    {result?.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Chain of {result?.chain ?? chain} · {(result?.multiplier ?? mult).toFixed(2)}×</p>
                </div>
                <Button className="w-full font-bold" size="lg" onClick={handleReset}>🔄 New Game</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card display */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[280px]">
            <AnimatePresence mode="wait">
              {phase === "idle" ? (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🃏</div>
                  <p className="text-muted-foreground text-sm">Start a chain to see your card</p>
                  <div className="text-xs text-muted-foreground/60 space-y-1">
                    <p>Chain 4 = break even</p>
                    <p>Chain 5+ = big profits</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="playing" className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-6">
                    {prevCard && (
                      <div className="text-center space-y-1 opacity-50">
                        <p className="text-xs text-muted-foreground">Previous</p>
                        <CardFace label={prevCard.label} />
                      </div>
                    )}
                    {currentCard && (
                      <div className="text-center space-y-1">
                        <p className="text-xs text-muted-foreground">Current</p>
                        <CardFace label={currentCard.label} />
                      </div>
                    )}
                  </div>
                  {lastGuessResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`text-sm font-bold px-4 py-2 rounded-full ${
                        !lastGuessResult.correct ? "bg-red-500/20 text-red-300"
                        : lastGuessResult.tie ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-emerald-500/20 text-emerald-300"
                      }`}>
                      {!lastGuessResult.correct ? "❌ Wrong!" : lastGuessResult.tie ? "🤝 Tie!" : "✅ Correct!"}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
