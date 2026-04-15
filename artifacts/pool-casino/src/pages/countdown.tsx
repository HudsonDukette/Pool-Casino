import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@/lib/api-client-react/src";
import { GameShell, BetInput } from "@/components/game-shell";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

type Phase = "idle" | "rising" | "crashing" | "done";

const RISE_RATE = 0.12;
const FALL_RATE = 0.7;
const START_MULT = 0.1;
const MAX_MULT = 3.5;

export default function Countdown() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(START_MULT);
  const [result, setResult] = useState<any>(null);

  const startedAtRef = useRef<number | null>(null);
  const crashAtMsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const cashedOutRef = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  function stopRaf() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function startAnimation(crashAtMs: number) {
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    crashAtMsRef.current = crashAtMs;
    cashedOutRef.current = false;

    function tick() {
      if (cashedOutRef.current) return;
      const elapsed = Date.now() - startedAt;
      let cur: number;
      let newPhase: Phase;

      if (elapsed < crashAtMs) {
        cur = START_MULT + (elapsed / 1000) * RISE_RATE;
        newPhase = "rising";
      } else {
        const peakMult = START_MULT + (crashAtMs / 1000) * RISE_RATE;
        const fallElapsed = (elapsed - crashAtMs) / 1000;
        cur = Math.max(0, peakMult - fallElapsed * FALL_RATE);
        newPhase = "crashing";
        if (phaseRef.current !== "crashing") setPhase("crashing");
      }

      setMult(parseFloat(cur.toFixed(2)));

      if (cur <= 0 && !cashedOutRef.current) {
        cashedOutRef.current = true;
        stopRaf();
        handleCashoutInternal();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => stopRaf(), []);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setMult(START_MULT);
    try {
      const res = await fetch(`${BASE}api/countdown/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("rising");
      startAnimation(data.crashAtSec * 1000);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashoutInternal() {
    try {
      const res = await fetch(`${BASE}api/countdown/cashout`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      setMult(parseFloat(data.multiplier.toFixed(2)));
      setPhase("done");
      if (data.won) toast({ title: `💰 Cashed out at ${data.multiplier.toFixed(2)}× · +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `💥 Too late — multiplier crashed! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleCashout() {
    if (loading || (phase !== "rising" && phase !== "crashing")) return;
    if (cashedOutRef.current) return;
    cashedOutRef.current = true;
    stopRaf();
    setLoading(true);
    await handleCashoutInternal();
    setLoading(false);
  }

  function handleReset() {
    stopRaf();
    cashedOutRef.current = false;
    setPhase("idle"); setMult(START_MULT); setResult(null);
    startedAtRef.current = null; crashAtMsRef.current = null;
  }

  const gaugePercent = Math.min(100, Math.max(0, ((mult - START_MULT) / (MAX_MULT - START_MULT)) * 100));
  const isCrashing = phase === "crashing";
  const multColor = isCrashing
    ? "text-red-400"
    : mult < 0.5 ? "text-slate-400"
    : mult < 1.0 ? "text-blue-400"
    : mult < 1.8 ? "text-yellow-400"
    : mult < 2.5 ? "text-orange-400"
    : "text-emerald-400";
  const barColor = isCrashing ? "#dc2626" : mult < 1.0 ? "#3b82f6" : mult < 1.8 ? "#f59e0b" : mult < 2.5 ? "#f97316" : "#10b981";

  const active = phase === "rising" || phase === "crashing";

  return (
    <GameShell casinoId={casinoId} gameType="countdown" payTableEntries={GAME_PAY_TABLES.countdown}
      title="Countdown Gamble" accentColor="text-blue-400"
      description="The multiplier rises slowly then crashes without warning. Cash out while it's falling — but if it hits zero, you lose everything!">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

        {/* Left panel */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-white/5">
                  <p>• Multiplier rises from 0.1× at +0.12×/sec</p>
                  <p>• Crashes at a random moment (5–22s)</p>
                  <p>• After crash it FALLS — cash out before zero!</p>
                  <p>• Higher risk = more time in the fall zone</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}>
                  {loading ? "Starting…" : "🚀 Start"}
                </Button>
              </>
            ) : active ? (
              <div className="space-y-4">
                {isCrashing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-2 rounded-lg bg-red-900/30 border border-red-500/40"
                  >
                    <p className="text-red-300 font-bold text-sm animate-pulse">💥 CRASHED — falling fast!</p>
                    <p className="text-xs text-red-400/70">Cash out NOW before it hits zero!</p>
                  </motion.div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{START_MULT}×</span>
                    <span>{isCrashing ? "⬇ Falling!" : "⬆ Rising…"}</span>
                    <span>{MAX_MULT}×+</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ width: `${gaugePercent}%`, background: barColor, transition: "background 0.2s" }}
                    />
                  </div>
                </div>
                <Button
                  className="w-full h-16 text-2xl font-black"
                  style={{
                    background: isCrashing
                      ? "linear-gradient(135deg,#dc2626,#7f1d1d)"
                      : "linear-gradient(135deg,#dc2626,#b91c1c)",
                    boxShadow: isCrashing
                      ? "0 0 32px rgba(220,38,38,0.8)"
                      : "0 0 24px rgba(220,38,38,0.5)",
                    animation: isCrashing ? "pulse 0.4s infinite" : "pulse 1s infinite",
                  }}
                  disabled={loading}
                  onClick={handleCashout}
                >
                  💰 CASH OUT NOW
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {result && (
                  <div className={`text-center p-4 rounded-xl border ${result.won ? "bg-emerald-950/40 border-emerald-500/30" : "bg-red-950/40 border-red-500/30"}`}>
                    <p className={`text-2xl font-black ${result.won ? "text-emerald-300" : "text-red-300"}`}>
                      {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.won ? `Cashed out at ${result.multiplier.toFixed(2)}×` : "Multiplier hit zero — too late!"}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Crash was at {result.crashedAtSec?.toFixed(1)}s · Peak {result.peakMult?.toFixed(2)}×
                    </p>
                  </div>
                )}
                <Button className="w-full font-bold" size="lg" onClick={handleReset}>🔄 Play Again</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right panel – big visual */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[280px]">
            <AnimatePresence mode="wait">
              {phase === "idle" ? (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">📈</div>
                  <p className="text-muted-foreground text-sm">Multiplier will rise then crash</p>
                  <p className="text-xs text-muted-foreground/60">Cash out before it hits zero</p>
                </motion.div>
              ) : phase === "done" ? (
                <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-3">
                  <div className="text-6xl">{result?.won ? "💰" : "💥"}</div>
                  <div className={`text-5xl font-black ${result?.won ? "text-emerald-400" : "text-red-400"}`}>
                    {mult.toFixed(2)}×
                  </div>
                  {result && (
                    <div className="text-sm text-muted-foreground">
                      Crash at {result.crashedAtSec?.toFixed(1)}s → Peak {result.peakMult?.toFixed(2)}×
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="active" className="text-center space-y-2 w-full">
                  <motion.div
                    animate={isCrashing ? { scale: [1, 1.08, 0.95, 1], color: ["#f87171","#dc2626"] } : { scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: isCrashing ? 0.5 : 1.5 }}
                    className={`text-7xl font-black ${multColor}`}
                  >
                    {mult.toFixed(2)}×
                  </motion.div>
                  <p className={`text-sm ${isCrashing ? "text-red-400 animate-pulse font-bold" : "text-muted-foreground"}`}>
                    {isCrashing ? "⬇ FALLING — REACT FAST!" : "Rising… crash could happen any moment!"}
                  </p>
                  <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden mt-2">
                    <motion.div className="h-full rounded-full" style={{ width: `${gaugePercent}%`, background: barColor }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
