import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useMultiplayer, type GameType } from "@/context/MultiplayerContext";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Trophy, Clock, Users } from "lucide-react";
import { formatCurrency, safeLocaleDate } from "@/lib/utils";
import elimwheelImg from "@/assets/game-elimwheel.png";
import timedsafeImg from "@/assets/game-timedsafe.png";
import reversecrashImg from "@/assets/game-reversecrash.png";

const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/" : import.meta.env.BASE_URL);

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
  { id: "war" as GameType, name: "War", emoji: "🃏", desc: "Draw cards against your opponent. Highest card wins the round. Best of 3.", color: "border-purple-500/30 hover:border-purple-500/60", badge: "Card Game" },
  { id: "highlow" as GameType, name: "Higher or Lower", emoji: "🎲", desc: "A die is rolled. Guess if the next roll is higher or lower. Best of 3.", color: "border-blue-500/30 hover:border-blue-500/60", badge: "Dice Game" },
  { id: "coinflip" as GameType, name: "Coin Flip", emoji: "🪙", desc: "Pick heads or tails — match the flip to win. Best of 3.", color: "border-yellow-500/30 hover:border-yellow-500/60", badge: "Classic" },
  { id: "rps" as GameType, name: "Rock Paper Scissors", emoji: "✂️", desc: "Classic RPS — both pick simultaneously. Best of 3.", color: "border-green-500/30 hover:border-green-500/60", badge: "Classic" },
  { id: "dicebattle" as GameType, name: "Dice Battle", emoji: "🎯", desc: "Roll 2 dice, highest total wins each round. Best of 3.", color: "border-orange-500/30 hover:border-orange-500/60", badge: "Dice Game" },
  { id: "numguess" as GameType, name: "Number Guess", emoji: "🔢", desc: "System picks 1–100. Closest guess wins the round. Best of 3.", color: "border-cyan-500/30 hover:border-cyan-500/60", badge: "Puzzle" },
  { id: "reaction" as GameType, name: "Reaction Time", emoji: "⚡", desc: "Wait for the green light, then react first. Early click loses the round. Best of 3.", color: "border-lime-500/30 hover:border-lime-500/60", badge: "Reflex" },
  { id: "quickmath" as GameType, name: "Quick Math", emoji: "🧮", desc: "Solve simple math problems — fastest correct answer wins. First to 3 of 5.", color: "border-pink-500/30 hover:border-pink-500/60", badge: "Mind Game" },
  { id: "tugofwar" as GameType, name: "Tug of War", emoji: "🪢", desc: "Tap your button to pull the rope to your side. First to the edge wins!", color: "border-rose-500/30 hover:border-rose-500/60", badge: "Timing" },
  { id: "lastman" as GameType, name: "Last Man Standing", emoji: "💀", desc: "Stay in or fold — risk increases each round. First to fail loses.", color: "border-red-500/30 hover:border-red-500/60", badge: "High Risk" },
  { id: "bjpvp" as GameType, name: "Blackjack PvP", emoji: "🃏", desc: "Both draw cards and try to get closest to 21 without busting. No dealer.", color: "border-violet-500/30 hover:border-violet-500/60", badge: "Card Game" },
  { id: "poker" as GameType, name: "5-Card Poker", emoji: "♠️", desc: "Both players get 5 cards. Best poker hand wins immediately.", color: "border-indigo-500/30 hover:border-indigo-500/60", badge: "Card Game" },
  { id: "cardrace" as GameType, name: "Card Draw Race", emoji: "🏁", desc: "Draw cards to reach 21. Closest without busting wins.", color: "border-teal-500/30 hover:border-teal-500/60", badge: "Card Game" },
  { id: "speedclick" as GameType, name: "Speed Click", emoji: "👆", desc: "Click as fast as possible for 5 seconds. Most clicks wins. Rate-limited.", color: "border-amber-500/30 hover:border-amber-500/60", badge: "Reflex" },
  { id: "memory" as GameType, name: "Memory Match", emoji: "🧠", desc: "Flip cards to find pairs — take turns. Player with most pairs wins.", color: "border-sky-500/30 hover:border-sky-500/60", badge: "Memory" },
  { id: "splitorsteal" as GameType, name: "Split or Steal", emoji: "🤝", desc: "Split = both gain. Steal = only you gain. Both steal = both lose. 1 round, pure psychology.", color: "border-emerald-500/30 hover:border-emerald-500/60", badge: "Social" },
  { id: "riskdice" as GameType, name: "Risk Dice", emoji: "🎲", desc: "Pick 1–3 dice to roll. More dice = higher potential but diminishing returns. Highest total wins. Best of 3.", color: "border-purple-500/30 hover:border-purple-500/60", badge: "Dice Game" },
  { id: "duelflip" as GameType, name: "Duel Flip", emoji: "🪙", desc: "Both call the coin flip. Right when opponent is wrong = win. Best of 5.", color: "border-yellow-500/30 hover:border-yellow-500/60", badge: "Classic" },
  { id: "riskauction" as GameType, name: "Risk Auction", emoji: "🏛️", desc: "Bid 1–10 points on a prize. Highest bidder wins 2× the prize but pays their bid. 1 round.", color: "border-amber-500/30 hover:border-amber-500/60", badge: "Strategy" },
  { id: "quickdraw" as GameType, name: "Quick Draw", emoji: "🔫", desc: "Draw when you see the signal — but a decoy fires first. React early = you lose. Best of 3.", color: "border-red-500/30 hover:border-red-500/60", badge: "Reflex" },
  { id: "balancebattle" as GameType, name: "Balance Battle", emoji: "⚖️", desc: "Split 10 points between Attack and Defense. Your attack vs opponent's defense. 1 round.", color: "border-indigo-500/30 hover:border-indigo-500/60", badge: "Strategy" },
];

const GAME_EMOJI_MAP: Record<string, string> = Object.fromEntries(GAME_DEFS.map(g => [g.id, g.emoji]));

export default function Multiplayer() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const { queued, queueGameType, joinQueue, leaveQueue, connected, currentMatch, lobbyStats } = useMultiplayer();

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
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-10">
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
          24 games. No house edge — real players only.
        </p>
      </motion.div>

      <div className="flex justify-end">
        <Link href="/badges">
          <Button variant="outline" size="sm" className="gap-2">
            <Trophy className="w-4 h-4" /> Badges & Challenges
          </Button>
        </Link>
      </div>

      {/* Lobby-based multiplayer games */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">🏆 Lobby Games</h2>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-full">3 games · Up to 8 players</span>
        </div>
        <p className="text-sm text-muted-foreground">Create or join a lobby. Bet against real players — last one standing or highest score wins the pot.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              id: "elimwheel",
              name: "Elimination Wheel",
              image: elimwheelImg,
              description: "Last survivor wins. Each spin eliminates one real player from the shared pot!",
              href: "/games/elimwheel",
              accentClass: "hover:border-purple-500/50 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)]",
              titleClass: "group-hover:text-purple-400",
              tag: "Up to 8 players",
              tagColor: "bg-purple-500/20 text-purple-300",
            },
            {
              id: "timedsafe",
              name: "Vault Race",
              image: timedsafeImg,
              description: "The safe cracks at a secret moment. Last player to open BEFORE the crack wins the pot!",
              href: "/games/timedsafe",
              accentClass: "hover:border-amber-400/50 hover:shadow-[0_0_24px_rgba(251,191,36,0.25)]",
              titleClass: "group-hover:text-amber-300",
              tag: "Up to 6 players",
              tagColor: "bg-amber-500/20 text-amber-300",
            },
            {
              id: "reversecrash",
              name: "Speed Test",
              image: reversecrashImg,
              description: "Multiplier falls from 3×. Lock in yours before it crashes — highest locked mult wins!",
              href: "/games/reversecrash",
              accentClass: "hover:border-green-500/50 hover:shadow-[0_0_24px_rgba(34,197,94,0.25)]",
              titleClass: "group-hover:text-green-400",
              tag: "Up to 6 players",
              tagColor: "bg-green-500/20 text-green-400",
            },
          ].map((g) => (
            <Link key={g.id} href={g.href} className="block group">
              <Card className={`overflow-hidden bg-card/40 border-white/10 transition-all duration-300 cursor-pointer ${g.accentClass}`}>
                <CardContent className="p-0">
                  <div className="h-[130px] relative overflow-hidden border-b border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
                    <div className="absolute top-2 left-2 z-20">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-300">⚡ Lobby</span>
                    </div>
                    <div className="absolute top-2 right-2 z-20">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${g.tagColor}`}>{g.tag}</span>
                    </div>
                    <motion.img src={g.image} alt={g.name} className="w-full h-full object-cover"
                      whileHover={{ scale: 1.05 }} transition={{ duration: 0.4, ease: "easeOut" }} />
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className={`font-bold text-white transition-colors ${g.titleClass}`}>{g.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{g.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 1v1 PvP matchmaking games */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">⚔️ PvP Matchmaking</h2>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-full">21 games · 1v1</span>
        </div>
        <p className="text-sm text-muted-foreground">Queue up and get matched with another player automatically. Winner takes the pot.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAME_DEFS.map((game, i) => {
          const isThisQueued = queued && queueGameType === game.id;
          const inMatch = currentMatch?.gameType === game.id;
          const stats = lobbyStats[game.id];

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`relative bg-card rounded-2xl border-2 p-5 space-y-3 transition-all ${game.color} ${isThisQueued ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{game.emoji}</span>
                  <div>
                    <h2 className="text-base font-bold text-white">{game.name}</h2>
                    <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">{game.badge}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{game.desc}</p>

              {stats && (
                <div className="flex items-center gap-3 text-xs">
                  <span className={`flex items-center gap-1 ${stats.playing > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${stats.playing > 0 ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                    {stats.playing} playing
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className={`${stats.queued > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                    {stats.queued} waiting
                  </span>
                </div>
              )}

              {!user || isGuest ? (
                <Link href="/login"><Button className="w-full" variant="outline" size="sm">Log in to Play</Button></Link>
              ) : inMatch ? (
                <Link href={`/multiplayer/${game.id}`}><Button className="w-full" size="sm">Resume Match</Button></Link>
              ) : (
                <Button
                  size="sm"
                  className={`w-full ${isThisQueued ? "bg-destructive hover:bg-destructive/90" : ""}`}
                  onClick={() => handleQueue(game.id)}
                  disabled={queued && !isThisQueued}
                >
                  {isThisQueued ? <><Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Cancel</> : <><Swords className="w-3.5 h-3.5 mr-1.5" /> Find Match</>}
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
              const emoji = GAME_EMOJI_MAP[match.game_type] ?? "⚔️";
              return (
                <div key={match.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{match.game_type.replace(/-/g, " ")} vs {match.opponent_username}</p>
                      <p className="text-xs text-muted-foreground">{safeLocaleDate(match.completed_at)}</p>
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
