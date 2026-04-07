import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

type Phase = "idle" | "rising" | "crashing" | "done";

const RISE_RATE = 0.08; // x per second (from server)
const FALL_RATE = 0.6;  // x per second after crash (from server)
const MAX_MULT = 3.5;   // display cap for the gauge

export default function Countdown() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(1.0);
  const [result, setResult] = useState<any>(null);
  const [crashed, setCrashed] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const crashAtRef = useRef<number | null>(null); // revealed only after cashout
  const rafRef = useRef<number | null>(null);
  const phasedRef = useRef<Phase>("idle");

  useEffect(() => {
    phasedRef.current = phase;
  }, [phase]);

  // Animate the multiplier going up
  function startRisingAnimation() {
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    function tick() {
      if (phasedRef.current !== "rising" && phasedRef.current !== "crashing") return;
      const elapsed = (Date.now() - startedAt) / 1000;
      const cur = 1 + elapsed * RISE_RATE;
      setMult(parseFloat(cur.toFixed(2)));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setCrashed(false); setMult(1.0);
    try {
      const res = await fetch(`${BASE}api/countdown/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("rising");
      startRisingAnimation();
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    if (loading || phase !== "rising") return;
    setLoading(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      const res = await fetch(`${BASE}api/countdown/cashout`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      setMult(data.multiplier);
      setCrashed(data.crashed);
      setPhase("done");
      if (data.won) toast({ title: `💰 Cashed out at ${data.multiplier}× · +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `💥 Too late — multiplier crashed! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  function handleReset() {
    setPhase("idle"); setMult(1.0); setResult(null); setCrashed(false);
    startedAtRef.current = null; crashAtRef.current = null;
  }

  const gaugePercent = Math.min(100, ((mult - 1) / (MAX_MULT - 1)) * 100);
  const multColor = mult < 1.5 ? "text-red-400" : mult < 2.0 ? "text-yellow-400" : mult < 2.5 ? "text-orange-400" : "text-emerald-400";
  const barColor = mult < 1.5 ? "#dc2626" : mult < 2.0 ? "#f59e0b" : mult < 2.5 ? "#f97316" : "#10b981";

  return (
    <GameShell casinoId={casinoId} gameType="countdown" payTableEntries={GAME_PAY_TABLES.countdown}
      title="Countdown Gamble" accentColor="text-blue-400"
      description="The multiplier rises slowly then crashes without warning. Cash out at the peak for massive wins — or lose everything!">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-white/5">
                  <p>• Multiplier rises +0.08× per second</p>
                  <p>• Random crash at a secret moment (6–24s)</p>
                  <p>• After crash it falls fast — cash out in time!</p>
                  <p>• Miss it and you lose your bet</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}>
                  {loading ? "Starting…" : "🚀 Start"}
                </Button>
              </>
            ) : phase === "rising" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1.0×</span>
                    <span>Multiplier gauge</span>
                    <span>{MAX_MULT}×+</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-5 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ width: `${gaugePercent}%`, background: barColor, transition: "background 0.3s" }} />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">Watching for the crash… ⚡</p>
                <Button className="w-full h-16 text-2xl font-black animate-pulse"
                  style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 0 24px rgba(220,38,38,0.5)" }}
                  disabled={loading} onClick={handleCashout}>
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
                      {result.won ? `Cashed out at ${result.multiplier}×` : "Multiplier hit zero — too late!"}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Crash was at {result.crashedAtSec}s · Peak {result.peakMult}×
                    </p>
                  </div>
                )}
                <Button className="w-full font-bold" size="lg" onClick={handleReset}>🔄 Play Again</Button>
              </div>
            )}
          </CardContent>
        </Card>

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
                  <div className="text-6xl">{crashed ? "💥" : "💰"}</div>
                  <div className={`text-5xl font-black ${multColor}`}>{(result?.multiplier ?? mult).toFixed(2)}×</div>
                  {result && (
                    <div className="text-sm text-muted-foreground">
                      <div>Crash at {result.crashedAtSec}s → Peak {result.peakMult}×</div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="rising" className="text-center space-y-2 w-full">
                  <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={`text-7xl font-black ${multColor}`}
                  >
                    {mult.toFixed(2)}×
                  </motion.div>
                  <p className="text-muted-foreground text-sm">Rising… crash could happen any moment!</p>
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
