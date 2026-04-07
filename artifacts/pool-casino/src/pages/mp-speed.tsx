import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { formatCurrency } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

const START_MULT = 3.0;
const FALL_RATE = 0.12;

type Screen = "setup" | "lobby" | "playing" | "done";

interface SpeedLobbyState {
  id: string;
  hostId: number;
  betAmount: number;
  status: "waiting" | "playing" | "done";
  startedAt?: number;
  currentMult: number | null;
  players: { username: string; locked: boolean; lockedMult: number | string | null; isYou: boolean }[];
  myLockedMult: number | null;
  winner?: { userId: number; username: string; lockedMult: number; payout: number; newBalance: number };
  crashMult?: number;
  isHost: boolean;
  isInLobby: boolean;
}

export default function MpSpeed() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("setup");
  const [betAmount, setBetAmount] = useState("100");
  const [lobbyCode, setLobbyCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState<SpeedLobbyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [localMult, setLocalMult] = useState(START_MULT);
  const [locked, setLocked] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  function stopRaf() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  async function pollLobby(id: string) {
    try {
      const r = await fetch(`${BASE}api/mp/speed/${id}`, { credentials: "include" });
      if (!r.ok) return;
      const data: SpeedLobbyState = await r.json();
      setLobby(data);
      if (data.status === "playing" && screen !== "playing") setScreen("playing");
      if (data.status === "done") {
        setScreen("done");
        stopPolling();
        stopRaf();
        setCrashed(true);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      }
    } catch {}
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = setInterval(() => pollLobby(id), 1000);
  }

  function startAnimation(startedAt: number) {
    stopRaf();
    setLocalMult(START_MULT);
    setCrashed(false);
    function tick() {
      const elapsed = (Date.now() - startedAt) / 1000;
      const m = Math.max(0, START_MULT - elapsed * FALL_RATE);
      setLocalMult(parseFloat(m.toFixed(3)));
      if (m <= 0) { setCrashed(true); stopRaf(); return; }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => { stopPolling(); stopRaf(); }, []);

  useEffect(() => {
    if (lobby?.status === "playing" && lobby.startedAt && !locked) {
      startAnimation(lobby.startedAt);
    }
  }, [lobby?.status, lobby?.startedAt]);

  async function handleCreate() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/speed/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: parseFloat(betAmount) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setLobbyCode(data.lobbyId);
      setScreen("lobby");
      await pollLobby(data.lobbyId);
      startPolling(data.lobbyId);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast({ title: "Enter a lobby code", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/speed/${code}/join`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setLobbyCode(code);
      setScreen("lobby");
      await pollLobby(code);
      startPolling(code);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleStart() {
    if (!lobby) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/speed/${lobby.id}/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleLock() {
    if (!lobby || locked || crashed) return;
    const frozenMult = localMult;
    setLocked(true);
    stopRaf();
    try {
      const r = await fetch(`${BASE}api/mp/speed/${lobby.id}/lock`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: data.error || "Failed to lock", variant: "destructive" });
        setLocked(false);
        return;
      }
      toast({ title: `⚡ Locked at ${frozenMult.toFixed(3)}×`, description: "Waiting for others…", className: "bg-emerald-950 border-emerald-500/30" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  }

  const multColor = localMult > 2.0 ? "#22c55e" : localMult > 1.2 ? "#eab308" : localMult > 0.5 ? "#f97316" : "#ef4444";
  const numLocked = lobby?.players.filter(p => p.locked).length ?? 0;
  const myPlayer = lobby?.players.find(p => p.isYou);
  const displayMult = locked ? (lobby?.myLockedMult ?? localMult) : localMult;

  return (
    <GameShell
      gameType="speed-test"
      title="⚡ Speed Test"
      accentColor="text-green-400"
      description="Multiplayer — the multiplier falls from 3.0×. Lock in yours before it crashes! Highest locked multiplier wins the pot!"
      payTableEntries={GAME_PAY_TABLES.reversecrash ?? []}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* SETUP */}
          {screen === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-4">
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-green-300">Create Lobby</h3>
                  <BetInput value={betAmount} onChange={setBetAmount} />
                  <Button className="w-full font-bold" style={{ background: "linear-gradient(135deg,#16a34a,#14532d)" }} disabled={loading} onClick={handleCreate}>
                    {loading ? "Creating…" : "Create Lobby"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-green-300">Join Lobby</h3>
                  <input
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono tracking-widest text-center uppercase"
                    placeholder="LOBBY CODE"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <Button variant="outline" className="w-full" disabled={loading} onClick={handleJoin}>
                    {loading ? "Joining…" : "Join"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Lock early = safer but lower. Wait longer = riskier but higher payout. Highest wins!</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* LOBBY */}
          {screen === "lobby" && lobby && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-green-300">Lobby: <span className="font-mono text-white tracking-widest">{lobby.id}</span></h3>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">{lobby.players.length}/6 players</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Bet: <span className="text-white font-semibold">{formatCurrency(lobby.betAmount)}</span> · Pot: <span className="text-emerald-300 font-semibold">{formatCurrency(lobby.betAmount * lobby.players.length)}</span></p>
                  <div className="space-y-1">
                    {lobby.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-black/20">
                        <span className="text-green-400">⚡</span>
                        <span className={p.isYou ? "text-green-300 font-semibold" : "text-white"}>{p.username}{p.isYou ? " (you)" : ""}</span>
                        {i === 0 && <span className="ml-auto text-xs text-yellow-400">HOST</span>}
                      </div>
                    ))}
                  </div>
                  {lobby.isHost ? (
                    <Button className="w-full font-bold" style={{ background: "linear-gradient(135deg,#16a34a,#14532d)" }} disabled={loading || lobby.players.length < 2} onClick={handleStart}>
                      {loading ? "Starting…" : lobby.players.length < 2 ? "Need 2+ players" : "Start Speed Test!"}
                    </Button>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground animate-pulse">Waiting for host to start…</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PLAYING */}
          {screen === "playing" && lobby && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-5">
                  {/* Big multiplier display */}
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Multiplier</p>
                    <motion.div
                      key={crashed ? "crashed" : "live"}
                      animate={crashed ? { scale: [1, 1.2, 1], color: "#ef4444" } : {}}
                      className="text-7xl font-black"
                      style={{ color: crashed ? "#ef4444" : multColor, textShadow: `0 0 20px ${crashed ? "#ef444466" : multColor + "66"}` }}
                    >
                      {crashed ? "💥" : displayMult.toFixed(3) + "×"}
                    </motion.div>
                    {/* Fall bar */}
                    <div className="w-full bg-black/40 rounded-full h-4 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full transition-none"
                        style={{ width: `${Math.max(0, (localMult / START_MULT) * 100)}%`, background: multColor }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {crashed ? "CRASHED! 💥" : locked ? `Locked at ${lobby.myLockedMult?.toFixed(3)}× — waiting for others…` : "Falling… lock in your multiplier!"}
                    </p>
                  </div>

                  {/* Player list */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {lobby.players.map((p, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${p.locked ? "bg-emerald-950/30" : "bg-black/20"}`}>
                        <span>{p.locked ? "⚡" : "⏳"}</span>
                        <span className={p.isYou ? "text-green-300 font-semibold" : "text-white"}>{p.username}</span>
                        {p.locked && <span className="ml-auto text-[9px] text-emerald-400">locked</span>}
                      </div>
                    ))}
                  </div>

                  {!locked && !crashed && (
                    <Button
                      className="w-full h-16 text-2xl font-black"
                      style={{ background: `linear-gradient(135deg,${multColor},${multColor}aa)`, boxShadow: `0 0 24px ${multColor}66` }}
                      onClick={handleLock}
                    >
                      ⚡ LOCK {localMult.toFixed(2)}×!
                    </Button>
                  )}
                  {locked && !crashed && (
                    <div className="text-center p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                      <p className="text-emerald-300 font-semibold">Locked at {lobby.myLockedMult?.toFixed(3)}×</p>
                      <p className="text-xs text-muted-foreground">Waiting for others…</p>
                    </div>
                  )}
                  {crashed && !locked && (
                    <div className="text-center p-3 rounded-xl bg-red-950/40 border border-red-500/30">
                      <p className="text-red-300 font-semibold">Crashed before you locked!</p>
                    </div>
                  )}
                  <p className="text-center text-xs text-muted-foreground">{numLocked}/{lobby.players.length} locked</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* DONE */}
          {screen === "done" && lobby && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <Card className="border-green-500/30 bg-green-950/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-5xl">{lobby.winner?.username === myPlayer?.username ? "🏆" : "💀"}</div>
                  {lobby.winner ? (
                    <>
                      <h3 className="text-2xl font-black text-green-300">{lobby.winner.username} wins!</h3>
                      <p className="text-sm text-muted-foreground">Locked at {lobby.winner.lockedMult.toFixed(3)}× — highest multiplier!</p>
                      <p className="text-emerald-300 text-xl font-bold">+{formatCurrency(lobby.winner.payout)}</p>
                      {lobby.crashMult !== undefined && <p className="text-xs text-muted-foreground">Crash happened at {lobby.crashMult.toFixed(3)}×</p>}
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-red-300">Everyone crashed!</h3>
                      {lobby.crashMult !== undefined && <p className="text-xs text-muted-foreground">Crash at {lobby.crashMult.toFixed(3)}×</p>}
                    </>
                  )}
                  <div className="space-y-1">
                    {lobby.players.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm px-2">
                        <span className={p.isYou ? "text-green-300 font-semibold" : "text-white"}>{p.username}</span>
                        <span className="text-muted-foreground text-xs">
                          {typeof p.lockedMult === "number" ? `⚡ ${p.lockedMult.toFixed(3)}×` : p.locked ? "locked" : "💥 crashed"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" style={{ background: "linear-gradient(135deg,#16a34a,#14532d)" }} onClick={() => { setScreen("setup"); setLobby(null); setLobbyCode(""); setJoinCode(""); setLocked(false); setCrashed(false); setLocalMult(START_MULT); }}>
                    Play Again
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameShell>
  );
}
