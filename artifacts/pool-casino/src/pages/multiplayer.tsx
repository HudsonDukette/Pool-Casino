import React from "react";
import { motion } from "framer-motion";
import { useMultiplayer, type GameType } from "@/context/MultiplayerContext";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Swords, Trophy, Clock, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

interface MatchHistoryItem {
  id: number;
  game_type: string;
  winner_id: number | null;
  final_bet: string;
  completed_at: string;
  score: number;
  opponent_username: string;
}

const GAME_DEFS = [
  {
    id: "war" as GameType,
    name: "War",
    emoji: "🃏",
    desc: "Draw cards against your opponent. Highest card wins the round. Best of 3.",
    color: "border-purple-500/30 hover:border-purple-500/60",
    badge: "Card Game",
  },
  {
    id: "highlow" as GameType,
    name: "Higher or Lower",
    emoji: "🎲",
    desc: "A die is rolled. Guess if the next roll is higher or lower. Best of 3.",
    color: "border-blue-500/30 hover:border-blue-500/60",
    badge: "Dice Game",
  },
];

export default function Multiplayer() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const { queued, queueGameType, joinQueue, leaveQueue, connected, currentMatch } = useMultiplayer();

  const { data: historyData } = useQuery({
    queryKey: ["match-history"],
    queryFn: async () => {
      const r = await fetch(`${BASE}api/matches/history`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: !!user && !user.isGuest,
    staleTime: 30000,
  });

  const history: MatchHistoryItem[] = historyData?.matches ?? [];
  const isGuest = user?.isGuest;

  const handleQueue = (gameType: GameType) => {
    if (!user || isGuest) return;
    if (queued && queueGameType === gameType) leaveQueue();
    else joinQueue(gameType);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-10">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${connected ? "bg-primary" : "bg-gray-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? "bg-primary" : "bg-gray-400"}`}></span>
          </span>
          {connected ? "Live Multiplayer" : "Connecting..."}
        </div>
        <h1 className="text-4xl font-black text-white">Multiplayer Arena</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Challenge real players to PvP matches. No house edge — winner takes all.
        </p>
      </motion.div>

      <div className="flex justify-end">
        <Link href="/badges">
          <Button variant="outline" size="sm" className="gap-2">
            <Trophy className="w-4 h-4" /> Badges & Challenges
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {GAME_DEFS.map((game, i) => {
          const isThisQueued = queued && queueGameType === game.id;
          const inMatch = currentMatch?.gameType === game.id;

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-card rounded-2xl border-2 p-6 space-y-4 transition-all ${game.color} ${isThisQueued ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{game.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold text-white">{game.name}</h2>
                    <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">{game.badge}</span>
                  </div>
                </div>
                <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-3 py-1 font-medium">Live</span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{game.desc}</p>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" /><span>1v1</span>
                <span>·</span>
                <Swords className="w-3.5 h-3.5" /><span>No house edge</span>
                <span>·</span>
                <span>Best of 3</span>
              </div>

              {!user || isGuest ? (
                <Link href="/login"><Button className="w-full" variant="outline">Log in to Play</Button></Link>
              ) : inMatch ? (
                <Link href={`/multiplayer/${game.id}`}><Button className="w-full">Resume Match</Button></Link>
              ) : (
                <Button
                  className={`w-full ${isThisQueued ? "bg-destructive hover:bg-destructive/90" : "shadow-[0_0_15px_rgba(0,255,170,0.2)]"}`}
                  onClick={() => handleQueue(game.id)}
                  disabled={queued && !isThisQueued}
                >
                  {isThisQueued ? <><Clock className="w-4 h-4 mr-2 animate-spin" /> Cancel Search</> : <><Swords className="w-4 h-4 mr-2" /> Find Match</>}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Matches
          </h2>
          <div className="space-y-2">
            {history.slice(0, 10).map(match => {
              const won = match.winner_id === user?.id;
              const draw = match.winner_id === null;
              return (
                <div key={match.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{match.game_type === "war" ? "🃏" : "🎲"}</span>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{match.game_type} vs {match.opponent_username}</p>
                      <p className="text-xs text-muted-foreground">{new Date(match.completed_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${won ? "text-green-400" : draw ? "text-yellow-400" : "text-red-400"}`}>
                      {won ? "Won" : draw ? "Draw" : "Lost"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(parseFloat(match.final_bet))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
