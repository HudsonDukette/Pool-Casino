import React, { useState, useEffect, useRef, useCallback } from "react";
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
  { label: "MISS",    minPos: 0,    maxPos: 0.35, color: "#ef4444", glow: "#ff000066", mult: "0.2×" },
  { label: "FAIR",    minPos: 0.35, maxPos: 0.55, color: "#f97316", glow: "#f9731666", mult: "0.8×" },
  { label: "GOOD",    minPos: 0.55, maxPos: 0.75, color: "#eab308", glow: "#eab30866", mult: "1.5×" },
  { label: "GREAT",   minPos: 0.75, maxPos: 0.90, color: "#22c55e", glow: "#22c55e66", mult: "2.5×" },
  { label: "PERFECT", minPos: 0.90, maxPos: 1.00, color: "#a855f7", glow: "#a855f766", mult: "5.0×" },
];

function getZone(pos: number) {
  return ZONES.find(z => pos >= z.minPos && pos < z.maxPos) ?? ZONES[0];
}

// Arc gauge parameters
const CX = 160, CY = 155, R = 120;
const START_ANG = 210, END_ANG = 330; // degrees (total 300 degrees)
const TOTAL_DEG = END_ANG - START_ANG; // + 360 for wrap = 300 deg sweep

function degToRad(d: number) { return (d * Math.PI) / 180; }
function arcPoint(deg: number, r: number) {
  const rad = degToRad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}
function posToAngle(pos: number) {
  // 0 → START_ANG, 1 → START_ANG + TOTAL_DEG (wrapping 360)
  const deg = START_ANG + pos * TOTAL_DEG;
  return deg >= 360 ? deg - 360 : deg;
}

function arcPath(startDeg: number, endDeg: number, r: number, thickness: number) {
  const inner = r - thickness;
  const p1 = arcPoint(startDeg, r);
  const p2 = arcPoint(endDeg, r);
  const p3 = arcPoint(endDeg, inner);
  const p4 = arcPoint(startDeg, inner);
  const large = (endDeg - startDeg + 360) % 360 > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z"
  ].join(" ");
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
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; deg: number }[]>([]);

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
      const t = (elapsed % period) / period;
      const barPos = (1 - Math.cos(t * Math.PI * 2)) / 2; // 0 → 1 → 0 smooth
      setPos(barPos);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function spawnSparks(atPos: number) {
    const ang = posToAngle(atPos);
    const tip = arcPoint(ang, R + 12);
    const newSparks = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: tip.x,
      y: tip.y,
      deg: Math.random() * 360,
    }));
    setSparks(newSparks);
    setTimeout(() => setSparks([]), 700);
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) { toast({ title: "Invalid bet", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    setSparks([]);
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
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
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
    const frozenPos = pos;
    setPhase("done");
    phaseRef.current = "done";
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    spawnSparks(frozenPos);
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
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }

  const zone = getZone(pos);
  const needleAngle = posToAngle(pos);
  const needleTip = arcPoint(needleAngle, R - 8);
  const needleBase1 = arcPoint(needleAngle + 90, 10);
  const needleBase2 = arcPoint(needleAngle - 90, 10);

  return (
    <GameShell
      casinoId={casinoId}
      gameType="powerbar"
      payTableEntries={GAME_PAY_TABLES.powerbar}
      title="⚡ Power Bar"
      accentColor="text-yellow-400"
      description="Stop the needle in the power zone for maximum voltage — perfect timing = 5× surge!"
    >
      <div className="flex flex-col md:flex-row gap-6 max-w-3xl mx-auto items-start justify-center">

        {/* === Voltmeter Gauge === */}
        <div className="flex-1 flex flex-col items-center gap-3">
          <div className="relative select-none">
            <svg width="320" height="200" viewBox="0 0 320 200" className="overflow-visible">
              {/* Dark background arc */}
              <path
                d={arcPath(START_ANG, START_ANG + TOTAL_DEG, R, 22)}
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1"
              />

              {/* Zone arc segments */}
              {ZONES.map((z) => {
                const sA = START_ANG + z.minPos * TOTAL_DEG;
                const eA = START_ANG + z.maxPos * TOTAL_DEG;
                return (
                  <g key={z.label}>
                    <path
                      d={arcPath(sA, eA, R, 22)}
                      fill={z.color}
                      opacity={0.18}
                    />
                    {/* Glow on current zone */}
                    {zone.label === z.label && (phase === "running" || phase === "done") && (
                      <path
                        d={arcPath(sA, eA, R, 22)}
                        fill={z.color}
                        opacity={0.55}
                        filter="url(#glow)"
                      />
                    )}
                  </g>
                );
              })}

              {/* Zone tick marks */}
              {ZONES.map((z) => {
                const midA = START_ANG + (z.minPos + (z.maxPos - z.minPos) / 2) * TOTAL_DEG;
                const outer = arcPoint(midA, R + 4);
                const inner2 = arcPoint(midA, R - 27);
                return (
                  <text
                    key={z.label + "_lbl"}
                    x={inner2.x}
                    y={inner2.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={z.color}
                    opacity="0.9"
                  >
                    {z.mult}
                  </text>
                );
              })}

              {/* Outer ring */}
              <path
                d={arcPath(START_ANG, START_ANG + TOTAL_DEG, R + 2, 2)}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Needle */}
              {(phase === "running" || phase === "done") && (
                <g>
                  <polygon
                    points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
                    fill={zone.color}
                    filter="url(#glow)"
                    opacity="0.95"
                  />
                  {/* Needle tip dot */}
                  <circle cx={needleTip.x} cy={needleTip.y} r="5" fill={zone.color} filter="url(#glow)" />
                </g>
              )}

              {/* Center hub */}
              <circle cx={CX} cy={CY} r="14" fill="#0f172a" stroke="#334155" strokeWidth="2" />
              <circle cx={CX} cy={CY} r="6" fill={phase === "running" ? zone.color : "#334155"} filter={phase === "running" ? "url(#glow)" : ""} />

              {/* Spark particles */}
              {sparks.map(s => (
                <motion.circle
                  key={s.id}
                  cx={s.x} cy={s.y} r="4"
                  fill={zone.color}
                  initial={{ opacity: 1, cx: s.x, cy: s.y }}
                  animate={{
                    opacity: 0,
                    cx: s.x + Math.cos(degToRad(s.deg)) * 30,
                    cy: s.y + Math.sin(degToRad(s.deg)) * 30,
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              ))}

              {/* SVG filter for glow */}
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>

            {/* Center readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
              <AnimatePresence mode="wait">
                {phase === "idle" ? (
                  <motion.div key="idle-center" className="text-center">
                    <div className="text-2xl font-black text-slate-400">⚡</div>
                    <div className="text-xs text-slate-500">READY</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="active-center"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="text-xl font-black" style={{ color: zone.color, textShadow: `0 0 12px ${zone.color}` }}>
                      {zone.mult}
                    </div>
                    <div className="text-[10px] font-bold tracking-widest" style={{ color: zone.color, opacity: 0.7 }}>
                      {zone.label}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Zone legend strip */}
          <div className="flex gap-1 w-full max-w-[300px] h-4 rounded overflow-hidden">
            {ZONES.map(z => (
              <div
                key={z.label}
                style={{
                  flex: z.maxPos - z.minPos,
                  background: z.color,
                  opacity: zone.label === z.label && phase !== "idle" ? 1 : 0.3,
                  transition: "opacity 0.15s",
                }}
                title={`${z.label}: ${z.mult}`}
              />
            ))}
          </div>
        </div>

        {/* === Controls panel === */}
        <Card className="bg-card/40 border-white/10 w-full md:w-60 flex-shrink-0">
          <CardContent className="p-5 space-y-4">
            {phase === "idle" && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t border-white/5 pt-2">
                  <div className="flex items-center gap-1.5"><span style={{ color: "#ef4444" }}>●</span> Miss — 0.2×</div>
                  <div className="flex items-center gap-1.5"><span style={{ color: "#f97316" }}>●</span> Fair — 0.8×</div>
                  <div className="flex items-center gap-1.5"><span style={{ color: "#eab308" }}>●</span> Good — 1.5×</div>
                  <div className="flex items-center gap-1.5"><span style={{ color: "#22c55e" }}>●</span> Great — 2.5×</div>
                  <div className="flex items-center gap-1.5"><span style={{ color: "#a855f7" }}>●</span> Perfect — 5.0×</div>
                </div>
                <Button
                  size="lg"
                  className="w-full font-bold"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
                  disabled={loading}
                  onClick={handleStart}
                >
                  {loading ? "Starting…" : "⚡ Charge Up"}
                </Button>
              </>
            )}

            {phase === "running" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center animate-pulse">Needle sweeping… stop it!</p>
                <Button
                  size="lg"
                  className="w-full text-xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${zone.color}, ${zone.color}aa)`,
                    boxShadow: `0 0 24px ${zone.glow ?? zone.color}`,
                    animation: "pulse 0.6s infinite",
                  }}
                  onClick={handleStop}
                >
                  ⚡ STOP!
                </Button>
                <p className="text-center text-xs font-bold" style={{ color: zone.color }}>
                  Currently: {zone.label} ({zone.mult})
                </p>
              </div>
            )}

            {phase === "done" && result && (
              <div className="space-y-3">
                <div className={`text-center p-3 rounded-xl border ${result.won ? "bg-emerald-950/40 border-emerald-500/30" : "bg-red-950/40 border-red-500/30"}`}>
                  <p className={`text-xl font-black ${result.won ? "text-emerald-300" : "text-red-300"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(result.payout)}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {result.zone} zone · {result.multiplier}×
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => { setPhase("idle"); setResult(null); setPos(0); }}
                >
                  🔄 Play Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
