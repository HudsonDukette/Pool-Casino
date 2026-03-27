import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-advwheel.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const SEGMENTS = [
  { label: "0×",   color: "#1f1f2e" },
  { label: "0.3×", color: "#2a1a3a" },
  { label: "1.5×", color: "#0d3a2a" },
  { label: "2×",   color: "#1a3a1a" },
  { label: "3×",   color: "#0d2a3a" },
  { label: "5×",   color: "#1a1a4a" },
  { label: "10×",  color: "#2a0d4a" },
  { label: "25×",  color: "#4a0d2a" },
  { label: "50×",  color: "#6a0a0a" },
];

const COLORS = ["#1f1f2e","#2a1a3a","#0d3a2a","#1a3a1a","#0d2a3a","#1a1a4a","#2a0d4a","#4a0d2a","#6a0a0a"];
const BORDER_COLORS = ["#444","#7c3aed","#065f46","#166534","#164e63","#312e81","#4c1d95","#831843","#7f1d1d"];
const TEXT_COLORS = ["#666","#a78bfa","#34d399","#4ade80","#38bdf8","#818cf8","#c084fc","#f472b6","#f87171"];

export default function AdvWheel() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const rotRef = useRef(0);

  async function handleSpin() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setSpinning(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/advwheel`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Animate to the landed segment
      const segCount = data.segments?.length ?? SEGMENTS.length;
      const segAngle = 360 / segCount;
      const targetAngle = data.segmentIndex * segAngle;
      const extra = 360 * (5 + Math.floor(Math.random() * 4));
      const finalRot = rotRef.current + extra + (360 - targetAngle - segAngle / 2);
      rotRef.current = finalRot;
      setRotation(finalRot);

      setTimeout(() => {
        setSpinning(false);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        if (data.won) toast({ title: `🎡 ${data.segment}! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        else toast({ title: `Landed on ${data.segment}. ${data.payout > 0 ? `Got ${formatCurrency(data.payout)} back.` : "No win."}`, variant: data.payout > 0 ? "default" : "destructive" });
      }, 3000);
    } catch (err: unknown) {
      setSpinning(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const segCount = SEGMENTS.length;
  const segAngle = 360 / segCount;
  const cx = 100, cy = 100, r = 90;

  function segPath(i: number) {
    const a1 = ((i * segAngle) - 90) * (Math.PI / 180);
    const a2 = ((i * segAngle + segAngle) - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
  }

  function labelPos(i: number) {
    const mid = ((i * segAngle + segAngle / 2) - 90) * (Math.PI / 180);
    return { x: cx + (r * 0.65) * Math.cos(mid), y: cy + (r * 0.65) * Math.sin(mid) };
  }

  return (
    <GameShell heroImage={heroImg} title="Advanced Wheel" description="9 segments with payouts up to 50×. Higher-risk spin, bigger potential jackpots." accentColor="text-purple-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading || spinning} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {SEGMENTS.map((s, i) => (
                <div key={i} className="rounded-lg px-2 py-1.5 border border-white/5" style={{ background: COLORS[i] + "80" }}>
                  <span style={{ color: TEXT_COLORS[i] }} className="font-mono font-bold">{s.label}</span>
                </div>
              ))}
            </div>
            <Button className="w-full font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]"
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
              size="lg" disabled={loading || spinning} onClick={handleSpin}>
              {spinning ? "Spinning…" : "🎡 Spin"}
            </Button>
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`text-center px-4 py-3 rounded-xl border ${result.won ? "bg-purple-950/40 border-purple-500/30" : "bg-black/30 border-white/10"}`}>
                  <p className={`font-display font-bold text-xl ${result.won ? "text-purple-300" : "text-muted-foreground"}`}>
                    {result.segment} {result.won ? `+${formatCurrency(result.payout)}` : result.payout > 0 ? formatCurrency(result.payout) : ""}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-4">
            <div className="relative w-52 h-52">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0"
                style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "20px solid white" }} />
              <motion.svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl"
                animate={{ rotate: rotation }} transition={{ duration: 3, ease: [0.2, 0.8, 0.4, 1] }}>
                {SEGMENTS.map((_, i) => (
                  <g key={i}>
                    <path d={segPath(i)} fill={COLORS[i]} stroke={BORDER_COLORS[i]} strokeWidth="1.5" />
                    <text x={labelPos(i).x} y={labelPos(i).y} textAnchor="middle" dominantBaseline="middle"
                      fill={TEXT_COLORS[i]} fontSize="9" fontWeight="bold" fontFamily="monospace"
                      transform={`rotate(${i * segAngle + segAngle / 2}, ${labelPos(i).x}, ${labelPos(i).y})`}>
                      {SEGMENTS[i].label}
                    </text>
                  </g>
                ))}
                <circle cx="100" cy="100" r="10" fill="#0a0a0f" stroke="#333" strokeWidth="2" />
              </motion.svg>
            </div>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
