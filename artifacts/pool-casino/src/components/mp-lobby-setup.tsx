import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BetInput } from "@/components/game-shell";
import { formatCurrency } from "@/lib/utils";
import { useGetMe } from "@workspace/api-client-react";

const BASE = (import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/"
  : import.meta.env.BASE_URL);

interface PublicLobby {
  id: string;
  betAmount: number;
  players: number;
  maxPlayers: number;
  hostName: string;
}

interface Props {
  gameSlug: "elim" | "vault" | "speed";
  accentColor: string;
  accentGradient: string;
  onEnterLobby: (lobbyId: string) => void;
}

type Mode = "pick" | "matchmake" | "browse" | "join-private" | "create-public" | "create-private";

export function MpLobbySetup({ gameSlug, accentColor, accentGradient, onEnterLobby }: Props) {
  const { data: user } = useGetMe({ query: { retry: false } });
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("pick");
  const [betAmount, setBetAmount] = useState("100");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<PublicLobby[]>([]);
  const [fetchingLobbies, setFetchingLobbies] = useState(false);

  const apiBase = `${BASE}api/mp/${gameSlug}`;

  async function fetchPublicLobbies() {
    setFetchingLobbies(true);
    try {
      const r = await fetch(`${apiBase}/public`, { credentials: "include" });
      if (r.ok) setPublicLobbies(await r.json());
    } catch {}
    finally { setFetchingLobbies(false); }
  }

  useEffect(() => {
    if (mode === "browse") fetchPublicLobbies();
  }, [mode]);

  async function handleMatchmake() {
    if (!user || user.isGuest) { toast({ title: "Log in to play multiplayer", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/matchmake`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: parseFloat(betAmount) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      toast({ title: data.joined ? "Joined existing lobby!" : "Created new lobby — waiting for players…" });
      onEnterLobby(data.lobbyId);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleJoinPublic(lobbyId: string, lobbyBet: number) {
    if (!user || user.isGuest) { toast({ title: "Log in to play multiplayer", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/${lobbyId}/join`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      onEnterLobby(lobbyId);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleJoinPrivate() {
    if (!user || user.isGuest) { toast({ title: "Log in to play multiplayer", variant: "destructive" }); return; }
    if (!joinCode.trim()) { toast({ title: "Enter a lobby code", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/${joinCode.toUpperCase()}/join`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      onEnterLobby(joinCode.toUpperCase());
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCreate(isPublic: boolean) {
    if (!user || user.isGuest) { toast({ title: "Log in to play multiplayer", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: parseFloat(betAmount), isPublic }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      onEnterLobby(data.lobbyId);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  const accent = accentColor;

  if (mode === "pick") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto"
      >
        {[
          {
            id: "matchmake" as Mode,
            icon: "🎯",
            title: "Quick Match",
            desc: "Auto-join or create a public lobby at your bet size",
          },
          {
            id: "browse" as Mode,
            icon: "🔍",
            title: "Browse Public",
            desc: "See all open public lobbies and pick one to join",
          },
          {
            id: "join-private" as Mode,
            icon: "🔐",
            title: "Join Private",
            desc: "Enter a lobby code from a friend",
          },
          {
            id: "create-public" as Mode,
            icon: "🌐",
            title: "Create Public",
            desc: "Open lobby anyone can join and discover",
          },
          {
            id: "create-private" as Mode,
            icon: "👥",
            title: "Create Private",
            desc: "Invite-only lobby — share the code with friends",
          },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className="text-left p-4 rounded-xl border border-white/10 bg-card/40 hover:border-white/20 hover:bg-card/60 transition-all group"
          >
            <div className="text-2xl mb-2">{opt.icon}</div>
            <div className={`font-semibold text-sm mb-1 group-hover:${accent} transition-colors`}>{opt.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</div>
          </button>
        ))}
      </motion.div>
    );
  }

  const back = (
    <button onClick={() => setMode("pick")} className="text-xs text-muted-foreground hover:text-white transition-colors mb-4 flex items-center gap-1">
      ← Back
    </button>
  );

  if (mode === "matchmake") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-4">
        {back}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-2xl">🎯</p>
              <h3 className={`font-semibold ${accent}`}>Quick Match</h3>
              <p className="text-xs text-muted-foreground">We'll find a public lobby at your bet size or create one for you.</p>
            </div>
            <BetInput value={betAmount} onChange={setBetAmount} />
            <Button
              className="w-full font-bold"
              style={{ background: accentGradient }}
              disabled={loading}
              onClick={handleMatchmake}
            >
              {loading ? "Searching…" : "Find Game"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (mode === "browse") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-4">
        {back}
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${accent}`}>Public Lobbies</h3>
          <button onClick={fetchPublicLobbies} className="text-xs text-muted-foreground hover:text-white transition-colors">
            ↺ Refresh
          </button>
        </div>
        {fetchingLobbies && <p className="text-center text-sm text-muted-foreground py-8">Loading lobbies…</p>}
        {!fetchingLobbies && publicLobbies.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <p className="text-3xl">👻</p>
            <p className="text-muted-foreground text-sm">No public lobbies open right now.</p>
            <Button variant="outline" size="sm" onClick={() => setMode("create-public")}>Create One</Button>
          </div>
        )}
        <div className="space-y-2">
          {publicLobbies.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-card/40">
              <div>
                <p className="font-semibold text-sm">{l.hostName}'s lobby</p>
                <p className="text-xs text-muted-foreground">
                  Bet: <span className="text-white">{formatCurrency(l.betAmount)}</span>
                  {" · "}{l.players}/{l.maxPlayers} players
                </p>
              </div>
              <Button
                size="sm"
                style={{ background: accentGradient }}
                disabled={loading}
                onClick={() => handleJoinPublic(l.id, l.betAmount)}
              >
                Join
              </Button>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (mode === "join-private") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-4">
        {back}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-2xl">🔐</p>
              <h3 className={`font-semibold ${accent}`}>Join Private Lobby</h3>
              <p className="text-xs text-muted-foreground">Enter the lobby code your friend shared with you.</p>
            </div>
            <input
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-3 text-white font-mono tracking-widest text-center uppercase text-lg"
              placeholder="XXXXXX"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <Button
              className="w-full font-bold"
              style={{ background: accentGradient }}
              disabled={loading || joinCode.length < 4}
              onClick={handleJoinPrivate}
            >
              {loading ? "Joining…" : "Join Lobby"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (mode === "create-public") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-4">
        {back}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-2xl">🌐</p>
              <h3 className={`font-semibold ${accent}`}>Create Public Lobby</h3>
              <p className="text-xs text-muted-foreground">Anyone can browse and join. You start the game when ready.</p>
            </div>
            <BetInput value={betAmount} onChange={setBetAmount} />
            <Button
              className="w-full font-bold"
              style={{ background: accentGradient }}
              disabled={loading}
              onClick={() => handleCreate(true)}
            >
              {loading ? "Creating…" : "Create Lobby"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (mode === "create-private") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-4">
        {back}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-2xl">👥</p>
              <h3 className={`font-semibold ${accent}`}>Create Private Lobby</h3>
              <p className="text-xs text-muted-foreground">Only players with your code can join. Share it with friends.</p>
            </div>
            <BetInput value={betAmount} onChange={setBetAmount} />
            <Button
              className="w-full font-bold"
              style={{ background: accentGradient }}
              disabled={loading}
              onClick={() => handleCreate(false)}
            >
              {loading ? "Creating…" : "Create Private Lobby"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return null;
}
