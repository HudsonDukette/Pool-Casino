import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@/lib/api-client-react/src";
import { GameShell } from "@/components/game-shell";
import { formatCurrency } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";
import { MpLobbySetup } from "@/components/mp-lobby-setup";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

type Screen = "setup" | "lobby" | "playing" | "done";

interface VaultLobbyState {
  id: string;
  hostId: number;
  betAmount: number;
  isPublic: boolean;
  status: "waiting" | "playing" | "done";
  startedAt?: number;
  crackAtSec?: number;
  players: { username: string; opened: boolean; openedAtSec: number | boolean | null; eliminated: boolean; isYou: boolean }[];
  myOpenedAtSec: number | null;
  myEliminated: boolean;
  winner?: { userId: number; username: string; openedAtSec: number; payout: number; newBalance: number };
  isHost: boolean;
  isInLobby: boolean;
}

export default function MpVault() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("setup");
  const [lobbyCode, setLobbyCode] = useState("");
  const [lobby, setLobby] = useState<VaultLobbyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [opened, setOpened] = useState(false);
  const [cracked, setCracked] = useState(false);
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
      const r = await fetch(`${BASE}api/mp/vault/${id}`, { credentials: "include" });
      if (!r.ok) return;
      const data: VaultLobbyState = await r.json();
      setLobby(data);
      if (data.status === "playing" && screen !== "playing") setScreen("playing");
      if (data.status === "done") {
        setScreen("done");
        stopPolling();
        stopRaf();
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      }
    } catch {}
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = setInterval(() => pollLobby(id), 1200);
  }

  function startTimer(startedAt: number) {
    stopRaf();
    function tick() {
      setElapsed((Date.now() - startedAt) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => { stopPolling(); stopRaf(); }, []);

  useEffect(() => {
    if (lobby?.status === "playing" && lobby.startedAt) {
      startTimer(lobby.startedAt);
    }
  }, [lobby?.status, lobby?.startedAt]);

  function handleEnterLobby(id: string) {
    setLobbyCode(id);
    setScreen("lobby");
    pollLobby(id);
    startPolling(id);
  }

  async function handleStart() {
    if (!lobby) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/mp/vault/${lobby.id}/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleOpen() {
    if (!lobby || opened) return;
    setOpened(true);
    try {
      const r = await fetch(`${BASE}api/mp/vault/${lobby.id}/open`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      if (data.cracked) {
        setCracked(true);
        toast({ title: "💥 You opened after the crack!", description: "The safe already cracked — you're eliminated.", variant: "destructive" });
      } else {
        toast({ title: `🔓 Opened at ${data.openedAtSec?.toFixed(1)}s`, description: "Waiting for others…", className: "bg-emerald-950 border-emerald-500/30" });
      }
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  }

  function copyCode() {
    navigator.clipboard.writeText(lobbyCode).then(() => toast({ title: "Lobby code copied!" }));
  }

  const numOpened = lobby?.players.filter(p => p.opened).length ?? 0;
  const myPlayer = lobby?.players.find(p => p.isYou);

  const tensionPct = Math.min(100, (elapsed / 50) * 100);
  const tensionColor = tensionPct < 40 ? "#22c55e" : tensionPct < 70 ? "#eab308" : "#ef4444";

  return (
    <GameShell
      gameType="vault-race"
      title="🔐 Vault Race"
      accentColor="text-amber-400"
      description="Multiplayer — all players bet equal stakes. The safe cracks at a secret time. Last player to open BEFORE the crack wins the pot!"
      payTableEntries={GAME_PAY_TABLES.timedsafe ?? []}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* SETUP */}
          {screen === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MpLobbySetup
                gameSlug="vault"
                accentColor="text-amber-400"
                accentGradient="linear-gradient(135deg,#d97706,#92400e)"
                onEnterLobby={handleEnterLobby}
              />
            </motion.div>
          )}

          {/* LOBBY */}
          {screen === "lobby" && lobby && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="bg-card/40 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-amber-300">
                      {lobby.isPublic ? "🌐 Public" : "🔐 Private"} Lobby
                    </h3>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">{lobby.players.length}/6 players</span>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Lobby Code</p>
                      <p className="font-mono text-white text-xl font-bold tracking-widest">{lobby.id}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={copyCode}>Copy</Button>
                  </div>
                  {!lobby.isPublic && (
                    <p className="text-xs text-muted-foreground text-center">Share the code above with friends to invite them.</p>
                  )}

                  <p className="text-sm text-muted-foreground">Bet per player: <span className="text-white font-semibold">{formatCurrency(lobby.betAmount)}</span> · Pot: <span className="text-emerald-300 font-semibold">{formatCurrency(lobby.betAmount * lobby.players.length)}</span></p>

                  <div className="space-y-1">
                    {lobby.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-black/20">
                        <span className="text-amber-400">🔒</span>
                        <span className={p.isYou ? "text-amber-300 font-semibold" : "text-white"}>{p.username}{p.isYou ? " (you)" : ""}</span>
                        {i === 0 && <span className="ml-auto text-xs text-yellow-400">HOST</span>}
                      </div>
                    ))}
                  </div>

                  {lobby.isHost ? (
                    <Button
                      className="w-full font-bold"
                      style={{ background: "linear-gradient(135deg,#d97706,#92400e)" }}
                      disabled={loading || lobby.players.length < 2}
                      onClick={handleStart}
                    >
                      {loading ? "Starting…" : lobby.players.length < 2 ? "Waiting for players (need 2+)…" : "▶ Start Vault Race!"}
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
                  <div className="text-center space-y-3">
                    <motion.div
                      animate={opened ? {} : { scale: [1, 1.02, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-7xl"
                    >
                      {opened ? (cracked ? "💥" : "🔓") : "🔐"}
                    </motion.div>
                    <div className="text-3xl font-black" style={{ color: tensionColor, textShadow: `0 0 15px ${tensionColor}` }}>
                      {elapsed.toFixed(1)}s
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-3">
                      <motion.div
                        className="h-full rounded-full transition-all duration-100"
                        style={{ width: `${Math.min(100, tensionPct)}%`, background: tensionColor }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {opened ? (cracked ? "You were eliminated — opened after the crack!" : "You opened — waiting for others…") : "Hold your nerve… last to open before the crack wins!"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {lobby.players.map((p, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${p.eliminated ? "bg-red-950/30 opacity-50" : p.opened ? "bg-emerald-950/30" : "bg-black/20"}`}>
                        <span>{p.eliminated ? "💀" : p.opened ? "🔓" : "🔐"}</span>
                        <span className={p.isYou ? "text-amber-300 font-semibold" : "text-white"}>{p.username}</span>
                        {p.isYou && <span className="ml-auto text-[9px] text-amber-400">you</span>}
                      </div>
                    ))}
                  </div>

                  {!opened && (
                    <Button
                      className="w-full h-16 text-2xl font-black"
                      style={{ background: "linear-gradient(135deg,#d97706,#b45309)", boxShadow: "0 0 24px rgba(217,119,6,0.5)" }}
                      onClick={handleOpen}
                    >
                      🔓 OPEN SAFE NOW!
                    </Button>
                  )}
                  <p className="text-center text-xs text-muted-foreground">{numOpened}/{lobby.players.length} opened</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* DONE */}
          {screen === "done" && lobby && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <Card className="border-amber-500/30 bg-amber-950/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-5xl">{lobby.winner?.username === myPlayer?.username ? "🏆" : lobby.myEliminated ? "💀" : "😔"}</div>
                  {lobby.winner ? (
                    <>
                      <h3 className="text-2xl font-black text-amber-300">{lobby.winner.username} wins!</h3>
                      <p className="text-sm text-muted-foreground">Opened at {lobby.winner.openedAtSec.toFixed(1)}s — last before the crack!</p>
                      <p className="text-emerald-300 text-xl font-bold">+{formatCurrency(lobby.winner.payout)}</p>
                      {lobby.crackAtSec && <p className="text-xs text-muted-foreground">Safe cracked at {lobby.crackAtSec.toFixed(1)}s</p>}
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-red-300">Everyone was eliminated!</h3>
                      {lobby.crackAtSec && <p className="text-xs text-muted-foreground">Safe cracked at {lobby.crackAtSec.toFixed(1)}s</p>}
                    </>
                  )}
                  <div className="space-y-1 text-sm">
                    {lobby.players.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm px-2">
                        <span className={p.isYou ? "text-amber-300 font-semibold" : "text-white"}>{p.username}</span>
                        <span className="text-muted-foreground text-xs">
                          {p.eliminated ? "💀 eliminated" : p.opened ? `🔓 ${typeof p.openedAtSec === "number" ? p.openedAtSec.toFixed(1) + "s" : "opened"}` : "never opened"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    style={{ background: "linear-gradient(135deg,#d97706,#92400e)" }}
                    onClick={() => { setScreen("setup"); setLobby(null); setLobbyCode(""); setOpened(false); setCracked(false); setElapsed(0); stopPolling(); stopRaf(); }}
                  >
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
