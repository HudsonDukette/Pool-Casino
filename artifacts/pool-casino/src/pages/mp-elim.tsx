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

type Screen = "setup" | "lobby" | "playing" | "done";

interface LobbyState {
  id: string;
  hostId: number;
  betAmount: number;
  status: "waiting" | "playing" | "done";
  spinReady: boolean;
  players: { username: string; alive: boolean; isYou: boolean }[];
  eliminatedNames: string[];
  winner?: { userId: number; username: string; payout: number; newBalance: number };
}

export default function MpElim() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("setup");
  const [betAmount, setBetAmount] = useState("100");
  const [lobbyCode, setLobbyCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [lastElim, setLastElim] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHost = lobby?.hostId === user?.id;

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function pollLobby(id: string) {
    try {
      const r = await fetch(`${BASE}api/mp/elim/${id}`, { credentials: "include" });
      if (!r.ok) return;
      const data: LobbyState = await r.json();
      setLobby(data);
      if (data.status === "playing" && screen !== "playing") setScreen("playing");
      if (data.status === "done") {
        setScreen("done");
        stopPolling();
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      }
    } catch {}
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = setInterval(() => pollLobby(id), 1200);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleCreate() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/elim/create`, {
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
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast({ title: "Enter a lobby code", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/elim/${code}/join`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setLobbyCode(code);
      setScreen("lobby");
      await pollLobby(code);
      startPolling(code);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleStart() {
    if (!lobby) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/elim/${lobby.id}/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleSpin() {
    if (!lobby || !lobby.spinReady) return;
    setSpinning(true);
    try {
      const r = await fetch(`${BASE}api/mp/elim/${lobby.id}/spin`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      if (data.eliminated) setLastElim(data.eliminated);
      await pollLobby(lobby.id);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSpinning(false); }
  }

  const aliveCount = lobby?.players.filter(p => p.alive).length ?? 0;
  const myPlayer = lobby?.players.find(p => p.isYou);
  const amAlive = myPlayer?.alive ?? true;

  return (
    <GameShell
      gameType="elim-mp"
      title="🎡 Elimination Wheel"
      accentColor="text-purple-400"
      description="Multiplayer — players bet equal stakes. Each round the wheel eliminates one player. Last survivor wins the pot!"
      payTableEntries={GAME_PAY_TABLES.elimwheel ?? []}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* SETUP */}
          {screen === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-4">
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-purple-300">Create Lobby</h3>
                  <BetInput value={betAmount} onChange={setBetAmount} />
                  <Button className="w-full font-bold" style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)" }} disabled={loading} onClick={handleCreate}>
                    {loading ? "Creating…" : "Create Lobby"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-purple-300">Join Lobby</h3>
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
                  <p className="text-xs text-muted-foreground">The lobby host picks the bet amount. You pay the same.</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* LOBBY */}
          {screen === "lobby" && lobby && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-purple-300">Lobby: <span className="font-mono text-white tracking-widest">{lobby.id}</span></h3>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">{lobby.players.length}/8 players</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Bet per player: <span className="text-white font-semibold">{formatCurrency(lobby.betAmount)}</span> · Pot: <span className="text-emerald-300 font-semibold">{formatCurrency(lobby.betAmount * lobby.players.length)}</span></p>
                  <div className="space-y-1">
                    {lobby.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-black/20">
                        <span className="text-purple-400">👤</span>
                        <span className={p.isYou ? "text-purple-300 font-semibold" : "text-white"}>
                          {p.username}{p.isYou ? " (you)" : ""}
                        </span>
                        {i === 0 && <span className="ml-auto text-xs text-yellow-400">HOST</span>}
                      </div>
                    ))}
                  </div>
                  {isHost ? (
                    <Button className="w-full font-bold" style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)" }} disabled={loading || lobby.players.length < 2} onClick={handleStart}>
                      {loading ? "Starting…" : lobby.players.length < 2 ? "Need 2+ players" : "Start Game!"}
                    </Button>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground animate-pulse">Waiting for host to start…</p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">Share code <span className="text-white font-mono">{lobby.id}</span> with friends</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PLAYING */}
          {screen === "playing" && lobby && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Players alive</p>
                    <p className="text-4xl font-black text-purple-300">{aliveCount}</p>
                    <p className="text-xs text-muted-foreground">Pot: {formatCurrency(lobby.betAmount * lobby.players.length)}</p>
                  </div>

                  {/* Wheel visual */}
                  <div className="flex justify-center py-2">
                    <motion.div
                      animate={spinning ? { rotate: 360 * 5 } : {}}
                      transition={spinning ? { duration: 1.8, ease: "easeOut" } : {}}
                      className="w-32 h-32 rounded-full border-4 border-purple-500/50 flex items-center justify-center text-5xl"
                      style={{ background: "conic-gradient(from 0deg, #7c3aed, #ec4899, #f97316, #22c55e, #3b82f6, #7c3aed)" }}
                    >
                    </motion.div>
                  </div>

                  {lastElim && (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center p-2 rounded-lg bg-red-900/30 border border-red-500/30">
                      <p className="text-red-300 font-semibold text-sm">💀 {lastElim} eliminated!</p>
                    </motion.div>
                  )}

                  {/* Player list */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {lobby.players.map((p, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${p.alive ? "bg-black/20" : "bg-black/5 opacity-40"}`}>
                        <span>{p.alive ? "✅" : "💀"}</span>
                        <span className={p.isYou ? "text-purple-300 font-semibold" : p.alive ? "text-white" : "text-muted-foreground line-through"}>
                          {p.username}
                        </span>
                      </div>
                    ))}
                  </div>

                  {!amAlive && (
                    <div className="text-center p-3 rounded-xl bg-red-950/40 border border-red-500/30">
                      <p className="text-red-300 font-semibold">You've been eliminated!</p>
                      <p className="text-xs text-muted-foreground mt-1">Watch as the last player standing wins the pot</p>
                    </div>
                  )}

                  {isHost && aliveCount > 1 && (
                    <Button
                      className="w-full font-bold text-lg"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
                      disabled={spinning || !lobby.spinReady}
                      onClick={handleSpin}
                    >
                      {spinning ? "🎡 Spinning…" : !lobby.spinReady ? "Processing…" : "🎡 Spin the Wheel!"}
                    </Button>
                  )}
                  {!isHost && (
                    <p className="text-center text-sm text-muted-foreground animate-pulse">
                      {aliveCount > 1 ? "Waiting for host to spin…" : "Final spin…"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* DONE */}
          {screen === "done" && lobby && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <Card className="border-purple-500/30 bg-purple-950/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-5xl">{lobby.winner?.username === myPlayer?.username ? "🏆" : "💀"}</div>
                  {lobby.winner ? (
                    <>
                      <h3 className="text-2xl font-black text-purple-300">{lobby.winner.username} wins!</h3>
                      <p className="text-emerald-300 text-xl font-bold">+{formatCurrency(lobby.winner.payout)}</p>
                      {lobby.winner.username === myPlayer?.username && (
                        <p className="text-sm text-muted-foreground">Your new balance: {formatCurrency(lobby.winner.newBalance)}</p>
                      )}
                    </>
                  ) : (
                    <h3 className="text-xl font-bold text-muted-foreground">Game over — no winner</h3>
                  )}
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">Elimination Order</p>
                    {lobby.eliminatedNames.map((n, i) => (
                      <p key={i} className="text-muted-foreground">#{i + 1} — {n}</p>
                    ))}
                  </div>
                  <Button className="w-full" style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)" }} onClick={() => { setScreen("setup"); setLobby(null); setLobbyCode(""); setJoinCode(""); setLastElim(null); }}>
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
