import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { getPool } from "@/lib/pool.functions";
import { playGame } from "@/lib/games/play.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function getCardValue(value: string): number {
  if (value === "A") return 1;
  if (value === "J") return 11;
  if (value === "Q") return 12;
  if (value === "K") return 13;
  return parseInt(value);
}

function getSuitSymbol(suit: string): string {
  const symbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
  return symbols[suit as keyof typeof symbols] || "?";
}

function getSuitColor(suit: string): string {
  return (suit === "hearts" || suit === "diamonds") ? "text-red-500" : "text-black";
}

function PlayingCard({ card, hidden = false }: { card: { suit: string; value: string }; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="w-24 h-36 bg-gradient-to-br from-blue-900 to-blue-700 rounded-xl border-2 border-blue-600 flex items-center justify-center shadow-lg">
        <div className="text-blue-400 text-3xl">?</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0, rotateY: -90 }}
      animate={{ scale: 1, rotateY: 0 }}
      className="w-24 h-36 bg-white rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg"
    >
      <span className={`text-3xl font-bold ${getSuitColor(card.suit)}`}>{card.value}</span>
      <span className={`text-4xl ${getSuitColor(card.suit)}`}>{getSuitSymbol(card.suit)}</span>
    </motion.div>
  );
}

export const Route = createFileRoute("/games/highlow")({
  head: () => ({
    meta: [
      { title: "High-Low — PoolCasino" },
      { name: "description", content: "Guess if the next card is higher or lower." },
      { property: "og:title", content: "High-Low — PoolCasino" },
      { property: "og:description", content: "Guess if the next card is higher or lower." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HighLowGame,
});

function HighLowGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [gameState, setGameState] = useState<"betting" | "playing" | "finished">("betting");
  const [currentCard, setCurrentCard] = useState<{ suit: string; value: string } | null>(null);
  const [previousCard, setPreviousCard] = useState<{ suit: string; value: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = gameState === "betting" && bet > 0 && bet <= balance;
  const canGuess = gameState === "playing" && currentCard !== null;

  function generateCard() {
    return {
      suit: SUITS[Math.floor(Math.random() * SUITS.length)],
      value: VALUES[Math.floor(Math.random() * VALUES.length)],
    };
  }

  function startGame() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    const firstCard = generateCard();
    setCurrentCard(firstCard);
    setPreviousCard(null);
    setStreak(0);
    setMultiplier(1);
    setGameState("playing");
    setResult(null);
  }

  function makeGuess(guess: "higher" | "lower" | "same") {
    if (!canGuess || !currentCard) return;

    const nextCard = generateCard();
    const currentValue = getCardValue(currentCard.value);
    const nextValue = getCardValue(nextCard.value);

    let won = false;
    if (guess === "higher" && nextValue > currentValue) won = true;
    else if (guess === "lower" && nextValue < currentValue) won = true;
    else if (guess === "same" && nextValue === currentValue) won = true;

    setPreviousCard(currentCard);
    setCurrentCard(nextCard);

    if (won) {
      const newStreak = streak + 1;
      const newMultiplier = 1 + (newStreak * 0.5);
      setStreak(newStreak);
      setMultiplier(newMultiplier);
    } else {
      endGame(false, 0, `Wrong guess! The card was ${nextCard.value}`);
    }
  }

  function cashOut() {
    if (gameState !== "playing" || multiplier <= 1) return;

    const payout = bet * multiplier;
    endGame(true, payout, `Cashed out with ${streak} correct guesses!`);
  }

  function endGame(won: boolean, payout: number, message: string) {
    setGameState("finished");
    setResult({ won, payout, message });
    processGameResult(won, payout, bet);
  }

  async function processGameResult(won: boolean, payout: number, betAmount: number) {
    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 500));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "highlow", option: won ? "win" : "loss", betAmount: bet },
        });
        setBalance(res.newBalance);
        queryClient.invalidateQueries({ queryKey: ["pool"] });
        refresh();
      }
    } catch (err) {
      toast({
        title: "Game failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  function resetGame() {
    setGameState("betting");
    setCurrentCard(null);
    setPreviousCard(null);
    setStreak(0);
    setMultiplier(1);
    setResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">High-Low</h1>
          <p className="text-muted-foreground mt-2">Guess if the next card is higher, lower, or the same. Build your streak!</p>
        </div>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-700/50 shadow-2xl">
          <CardContent className="p-8">
            {/* Cards Display */}
            <div className="flex justify-center gap-8 mb-8">
              {previousCard && (
                <div className="text-center">
                  <PlayingCard card={previousCard} />
                  <p className="text-sm text-muted-foreground mt-2">Previous</p>
                </div>
              )}
              {currentCard && (
                <div className="text-center">
                  <PlayingCard card={currentCard} />
                  <p className="text-sm text-muted-foreground mt-2">Current</p>
                </div>
              )}
              {!currentCard && (
                <div className="text-center">
                  <div className="w-24 h-36 bg-gray-800/50 rounded-xl border-2 border-gray-700 flex items-center justify-center">
                    <span className="text-gray-600 text-3xl">?</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Place bet to start</p>
                </div>
              )}
            </div>

            {/* Game Info */}
            {gameState === "playing" && (
              <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <p className="text-2xl font-bold text-primary">{streak}</p>
                </div>
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <p className="text-sm text-muted-foreground">Multiplier</p>
                  <p className="text-2xl font-bold text-accent">{multiplier.toFixed(1)}×</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-muted-foreground">Potential Win</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(bet * multiplier)}</p>
                </div>
              </div>
            )}

            {/* Betting Controls */}
            {gameState === "betting" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Bet amount</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="w-36 font-mono bg-black/50 border-white/20"
                    />
                    {[10, 25, 50, 100].map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        size="sm"
                        onClick={() => setBetAmount(String(v))}
                        className="border-white/20 hover:border-white/40"
                      >
                        {v}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(String(Math.floor(balance)))}
                      className="border-white/20 hover:border-white/40"
                    >
                      Max
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={startGame}
                  disabled={!canPlay}
                  className="w-full h-12 text-base bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                >
                  Start Game ({formatCurrency(bet || 0)})
                </Button>
              </div>
            )}

            {/* Guess Controls */}
            {gameState === "playing" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => makeGuess("lower")}
                    className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
                  >
                    <TrendingDown className="w-4 h-4 mr-2" /> Lower
                  </Button>
                  <Button
                    onClick={() => makeGuess("same")}
                    variant="outline"
                    className="border-purple-500/50 hover:border-purple-500 text-purple-400"
                  >
                    <Minus className="w-4 h-4 mr-2" /> Same
                  </Button>
                  <Button
                    onClick={() => makeGuess("higher")}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" /> Higher
                  </Button>
                </div>
                <Button
                  onClick={cashOut}
                  disabled={multiplier <= 1}
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  Cash Out ({formatCurrency(bet * multiplier)})
                </Button>
              </div>
            )}

            {/* Result */}
            {gameState === "finished" && result && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-2xl border-2 ${
                    result.won
                      ? "bg-primary/20 border-primary/50"
                      : "bg-destructive/20 border-destructive/50"
                  }`}
                >
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? "🎉 You Won!" : "😔 Game Over"}
                    </p>
                    <p className="text-lg text-white mt-2">{result.message}</p>
                    {result.payout > 0 && (
                      <p className="text-xl font-mono text-primary mt-2">
                        +{formatCurrency(result.payout)}
                      </p>
                    )}
                  </div>
                </motion.div>
                <Button
                  onClick={resetGame}
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  Play Again
                </Button>
              </div>
            )}

            {/* Stats */}
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Balance</span>
                <span className="font-mono font-semibold">{formatCurrency(balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool</span>
                <span className="font-mono font-semibold">{formatCurrency(poolTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}