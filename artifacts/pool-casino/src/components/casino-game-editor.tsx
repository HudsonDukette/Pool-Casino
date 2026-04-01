import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export type PayTableEntry = {
  key: string;
  label: string;
  emoji: string;
  defaultValue: number;
  min: number;
  max: number;
};

type GameConfig = {
  payoutMultiplier: string;
  payTableConfig: string | null;
};

type CasinoGameEditorProps = {
  casinoId: number;
  gameType: string;
  payTableEntries?: PayTableEntry[];
  onSaved?: (payouts: Record<string, number>, multiplier: number) => void;
};

function parsePayTable(raw: string | null | undefined, defaults: Record<string, number>): Record<string, number> {
  if (!raw) return { ...defaults };
  try {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function CasinoGameEditor({ casinoId, gameType, payTableEntries = [], onSaved }: CasinoGameEditorProps) {
  const { toast } = useToast();
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [payouts, setPayouts] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    payTableEntries.forEach(e => { defaults[e.key] = e.defaultValue; });
    return defaults;
  });

  const defaults = Object.fromEntries(payTableEntries.map(e => [e.key, e.defaultValue]));

  const loadConfig = useCallback(async () => {
    const res = await fetch(`/api/casinos/${casinoId}/odds`, { credentials: "include" });
    if (res.ok) {
      setIsOwner(true);
      const data = await res.json();
      const odds = data.odds as GameConfig[];
      const gameOdds = odds.find((o: GameConfig & { gameType?: string }) => (o as Record<string, unknown>).gameType === gameType);
      if (gameOdds) {
        setMultiplier(parseFloat(gameOdds.payoutMultiplier));
        if (payTableEntries.length > 0) {
          setPayouts(parsePayTable(gameOdds.payTableConfig, defaults));
        }
      }
    } else {
      setIsOwner(false);
    }
  }, [casinoId, gameType]);

  useEffect(() => {
    if (casinoId) loadConfig();
  }, [casinoId, loadConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { payoutMultiplier: multiplier };
      if (payTableEntries.length > 0) body.payTableConfig = JSON.stringify(payouts);
      const res = await fetch(`/api/casinos/${casinoId}/odds/${gameType}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Payouts updated", description: "Changes saved — new players will see the updated pay table." });
      onSaved?.(payouts, multiplier);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function updatePayout(key: string, val: string) {
    const n = parseFloat(val);
    if (!isNaN(n)) setPayouts(prev => ({ ...prev, [key]: n }));
  }

  if (!isOwner) return null;

  const MULT_PRESETS = [0.75, 0.9, 1.0, 1.1, 1.25];

  return (
    <div className="mt-4">
      <Button
        variant="outline"
        size="sm"
        className={`border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs gap-1.5 transition-all ${open ? "bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        ⚙️ {open ? "Close Editor" : "Edit Payouts"}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 bg-amber-950/30 border border-amber-500/30 rounded-lg space-y-4">
              <p className="text-xs text-amber-300/70 font-medium uppercase tracking-wider">Casino Owner Controls</p>

              {/* Global multiplier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/80">Global Payout Multiplier</p>
                  <span className="text-sm font-mono font-bold text-amber-400">{multiplier.toFixed(2)}×</span>
                </div>
                <div className="flex gap-2">
                  {MULT_PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => setMultiplier(p)}
                      className={`flex-1 py-1 text-xs rounded border transition-all ${
                        Math.abs(multiplier - p) < 0.001
                          ? "border-amber-400 bg-amber-400/20 text-amber-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {p}×
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  value={multiplier}
                  onChange={e => setMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <p className="text-xs text-white/40">
                  Affects all payouts — 1.00× is default, higher = more generous to players
                </p>
              </div>

              {/* Per-symbol pay table */}
              {payTableEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-white/80">Symbol Payouts (× bet)</p>
                  <div className="space-y-2">
                    {payTableEntries.map(entry => (
                      <div key={entry.key} className="flex items-center gap-3">
                        <span className="text-lg w-8 text-center">{entry.emoji}</span>
                        <span className="text-sm text-white/60 flex-1">{entry.label}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs font-bold transition-all"
                            onClick={() => setPayouts(prev => ({ ...prev, [entry.key]: Math.max(entry.min, (prev[entry.key] ?? entry.defaultValue) - 1) }))}
                          >−</button>
                          <Input
                            type="number"
                            value={payouts[entry.key] ?? entry.defaultValue}
                            min={entry.min}
                            max={entry.max}
                            step={1}
                            onChange={e => updatePayout(entry.key, e.target.value)}
                            className="w-16 h-7 text-center text-sm bg-black/40 border-white/20 text-white"
                          />
                          <button
                            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs font-bold transition-all"
                            onClick={() => setPayouts(prev => ({ ...prev, [entry.key]: Math.min(entry.max, (prev[entry.key] ?? entry.defaultValue) + 1) }))}
                          >+</button>
                          <span className="text-xs text-white/40 w-4">×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/40">
                    Default: {payTableEntries.map(e => `${e.emoji} ${e.defaultValue}×`).join(", ")}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/40 hover:text-white/60 text-xs"
                  onClick={() => {
                    setMultiplier(1.0);
                    setPayouts({ ...defaults });
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type { GameConfig };
export { parsePayTable };
