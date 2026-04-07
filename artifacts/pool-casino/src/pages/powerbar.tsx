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

type Phase = "idle" | "running" | "done";

const ZONES = [
  { label: "MISS",    minPos: 0,    maxPos: 0.35, color: "#ef4444", mult: "0.2×" },
  { label: "FAIR",    minPos: 0.35, maxPos: 0.55, color: "#f97316", mult: "0.8×" },
  { label: "GOOD",    minPos: 0.55, maxPos: 0.75, color: "#eab308", mult: "1.5×" },
  { label: "GREAT",   minPos: 0.75, maxPos: 0.90, color: "#22c55e", mult: "2.5×" },
  { label: "PERFECT", minPos: 0.90, maxPos: 1.00, color: "#a855f7", mult: "5.0×" },
];

function getZone(pos: number) {
  return ZONES.find(z => pos >= z.minPos && pos < z.maxPos) ?? ZONES[0];
}

function getZoneColor(pos: number) {
  return getZone(pos).color;
}

export default function PowerBar() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<any>(null);

  const periodRef = useRef<number>(2000);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  function startAnimation(period: number) {
    periodRef.current = period;
    startedAtRef.current = Date.now();
    function tick() {
      if (phaseRef.current !== "running") return;
      const elapsed = Date.now() - startedAtRef.current!;
      const phase01 = (elapsed % period) / period;
      const barPos = Math.sin(phase01 * Math.PI);
      setPos(barPos);
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
    if (isNaN(bet) || bet <= 0) { toast({ title: "Invalid bet", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const body: any = { betAmount: bet };
      if (casinoId) body.casinoId = casinoId;
      const r = await fetch(`${BASE}api/powerbar/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to start");
      qc.invalidateQueries({ queryKey: ["/api/user/me"] });
      setPhase("running");
      phaseRef.current = "running";
      startAnimation(data.period);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (phaseRef.current !== "running") return;
    setPhase("done");
    phaseRef.current = "done";
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/powerbar/stop`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to stop");
      setPos(data.pos);
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/user/me"] });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }

  const barColor = getZoneColor(pos);
  const currentZone = getZone(pos);

  return (
    <GameShell
      title="Power Bar"
      description="Stop the bar at the right moment for maximum payout!"
      payTable={GAME_PAY_TABLES.powerbar}
    >
      <div className="flex flex-col gap-5 w-full max-w-md mx-auto">
        {/* Zone legend */}
        <div className="flex gap-1 h-5 rounded overflow-hidden w-full">
          {ZONES.map(z => (
            <div
              key={z.label}
              style={{
                flex: (z.maxPos - z.minPos),
                background: z.color,
                opacity: 0.85,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="text-[9px] font-bold text-white drop-shadow">{z.mult}</span>
            </div>
          ))}
        </div>

        {/* Bar track */}
        <Card className="relative overflow-hidden bg-gray-950 border-gray-700" style={{ height: 80 }}>
          <CardContent className="p-0 h-full flex items-center">
            {/* Zone segments as background */}
            <div className="absolute inset-0 flex">
              {ZONES.map(z => (
                <div
                  key={z.label}
                  style={{ flex: (z.maxPos - z.minPos), background: z.color, opacity: 0.12 }}
                />
              ))}
            </div>
            {/* Moving bar */}
            <motion.div
              className="absolute top-0 bottom-0 w-4 rounded"
              style={{
                left: `calc(${pos * 100}% - 8px)`,
                background: barColor,
                boxShadow: `0 0 18px ${barColor}`,
                transition: phase === "done" ? "left 0.15s ease-out" : "none",
              }}
            />
            {/* Center zone marker */}
            <div className="absolute top-0 bottom-0" style={{ left: "90%", width: 2, background: "#a855f7", opacity: 0.6 }} />
            <div className="absolute top-0 bottom-0" style={{ left: "75%", width: 1, background: "#22c55e", opacity: 0.4 }} />
          </CardContent>
        </Card>

        {/* Zone label */}
        <div className="text-center text-sm font-semibold" style={{ color: barColor }}>
          {phase === "running" ? currentZone.label + " — " + currentZone.mult : phase === "done" && result ? (
            <span style={{ color: result.won ? "#22c55e" : "#ef4444" }}>
              {result.zone.toUpperCase()} — {result.multiplier}× payout
            </span>
          ) : "Ready"}
        </div>

        {/* Result card */}
        <AnimatePresence>
          {result && phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className={`border-2 ${result.won ? "border-green-500 bg-green-950/40" : "border-red-500 bg-red-950/40"}`}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: result.won ? "#22c55e" : "#ef4444" }}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(result.payout)}`}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Zone: <span className="font-semibold capitalize" style={{ color: barColor }}>{result.zone}</span> · {result.multiplier}× · Balance: {formatCurrency(result.newBalance)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet input + controls */}
        {phase === "idle" && (
          <BetInput value={betAmount} onChange={setBetAmount} />
        )}

        {phase === "idle" && (
          <Button
            size="lg"
            className="w-full text-lg font-bold bg-indigo-600 hover:bg-indigo-500"
            disabled={loading}
            onClick={handleStart}
          >
            {loading ? "Starting…" : "Start"}
          </Button>
        )}

        {phase === "running" && (
          <Button
            size="lg"
            className="w-full text-xl font-extrabold bg-yellow-500 hover:bg-yellow-400 text-black animate-pulse"
            onClick={handleStop}
          >
            STOP!
          </Button>
        )}

        {phase === "done" && (
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => { setPhase("idle"); setResult(null); setPos(0); }}
          >
            Play Again
          </Button>
        )}
      </div>
    </GameShell>
  );
}
