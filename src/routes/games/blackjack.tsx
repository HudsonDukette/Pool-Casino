import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Hand, Shield, Zap } from "lucide-react";
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

type Card = {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  value: string;
  numericValue: number;
};

type Hand = {
  cards: Card[];
  total: number;
  busted: boolean;
};

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      let numericValue = parseInt(value);
      if (value === "A") numericValue = 11;
      else if (["J", "Q", "K"].includes(value)) numericValue = 10;
      deck.push({ suit, value, numericValue });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateHandValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  
  for (const card of cards) {
    total += card.numericValue;
    if (card.value === "A") aces++;
  }
  
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  
  return total;
}

function CardComponent({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  const suitColors = {
    hearts: "text-red-500",
    diamonds: "text-red-500",
    clubs: "text-black",
    spades: "text-black",
  };

  const suitSymbols = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        className="w-16 h-24 bg-gradient-to-br from-blue-900 to-blue-700 rounded-xl border-2 border-blue-600 flex items-center justify-center shadow-lg"
      >
        <div className="text-blue-400 text-2xl">?</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className="w-16 h-24 bg-white rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg"
    >
      <span className={`text-2xl font-bold ${suitColors[card.suit]}`}>{card.value}</span>
      <span className={`text-3xl ${suitColors[card.suit]}`}>{suitSymbols[card.suit]}</span>
    </motion.div>
  );
}

export const Route = createFileRoute("/games/blackjack")({
  head: () => ({
    meta: [
      { title: "Blackjack — PoolCasino" },
      { name: "description", content: "Classic blackjack with interactive gameplay. Hit, stand, double down, and split your way to victory." },
      { property: "og:title", content: "Blackjack — PoolCasino" },
      { property: "og:description", content: "Classic blackjack with interactive gameplay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlackjackGame,
});

function BlackjackGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [gameState, setGameState] = useState<"betting" | "playing" | "finished">("betting");
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Hand>({ cards: [], total: 0, busted: false });
  const [dealerHand, setDealerHand] = useState<Hand>({ cards: [], total: 0, busted: false });
  const [dealerHidden, setDealerHidden] = useState(true);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = gameState === "betting" && bet > 0 && bet <= balance;

  function startGame() {
    if (!canPlay) {
      if (bet > balance) toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    const newDeck = shuffleDeck(createDeck());
    const playerCards = [newDeck.pop()!, newDeck.pop()!];
    const dealerCards = [newDeck.pop()!, newDeck.pop()!];

    setDeck(newDeck);
    setPlayerHand({
      cards: playerCards,
      total: calculateHandValue(playerCards),
      busted: false,
    });
    setDealerHand({
      cards: dealerCards,
      total: calculateHandValue([dealerCards[0]]), // Only show first card value
      busted: false,
    });
    setDealerHidden(true);
    setGameState("playing");
    setResult(null);
  }

  function hit() {
    if (gameState !== "playing" || deck.length === 0) return;

    const newCard = deck.pop()!;
    const newPlayerCards = [...playerHand.cards, newCard];
    const newTotal = calculateHandValue(newPlayerCards);
    const busted = newTotal > 21;

    setPlayerHand({
      cards: newPlayerCards,
      total: newTotal,
      busted,
    });

    if (busted) {
      endGame(false, 0, "Busted! You went over 21.");
    }
  }

  function stand() {
    if (gameState !== "playing") return;

    // Dealer's turn
    setDealerHidden(false);
    let newDealerCards = [...dealerHand.cards];
    let dealerTotal = calculateHandValue(newDealerCards);

    // Dealer hits until 17 or higher
    while (dealerTotal < 17 && deck.length > 0) {
      const newCard = deck.pop()!;
      newDealerCards = [...newDealerCards, newCard];
      dealerTotal = calculateHandValue(newDealerCards);
    }

    const dealerBusted = dealerTotal > 21;
    setDealerHand({
      cards: newDealerCards,
      total: dealerTotal,
      busted: dealerBusted,
    });

    // Determine winner
    if (dealerBusted) {
      endGame(true, bet * 2, "Dealer busted! You win!");
    } else if (playerHand.total > dealerTotal) {
      endGame(true, bet * 2, `You win with ${playerHand.total} vs ${dealerTotal}!`);
    } else if (playerHand.total < dealerTotal) {
      endGame(false, 0, `Dealer wins with ${dealerTotal} vs ${playerHand.total}.`);
    } else {
      endGame(true, bet, "Push! It's a tie.");
    }
  }

  function doubleDown() {
    if (gameState !== "playing" || deck.length === 0 || playerHand.cards.length !== 2) return;

    const doubledBet = bet * 2;
    if (doubledBet > balance) {
      toast({ title: "Insufficient balance for double down", variant: "destructive" });
      return;
    }

    const newCard = deck.pop()!;
    const newPlayerCards = [...playerHand.cards, newCard];
    const newTotal = calculateHandValue(newPlayerCards);
    const busted = newTotal > 21;

    setPlayerHand({
      cards: newPlayerCards,
      total: newTotal,
      busted,
    });

    if (busted) {
      endGame(false, doubledBet, "Busted on double down!");
    } else {
      // Automatically stand after double down
      stand();
    }
  }

  async function endGame(won: boolean, payout: number, message: string) {
    setGameState("finished");
    setResult({ won, payout, message });

    try {
      if (isGuest) {
        await new Promise((r) => setTimeout(r, 700));
        const next = balance - bet + payout;
        updateGuestBalance(next);
      } else {
        const res = await playGameFn({
          data: { gameId: "blackjack", option: won ? "win" : "loss", betAmount: bet },
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
    setPlayerHand({ cards: [], total: 0, busted: false });
    setDealerHand({ cards: [], total: 0, busted: false });
    setDealerHidden(true);
    setResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Blackjack</h1>
          <p className="text-muted-foreground mt-2">Beat the dealer to 21. Hit, stand, or double down.</p>
        </div>

        {/* Game Table */}
        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50 shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            {/* Dealer's Hand */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">Dealer's Hand</h3>
                {!dealerHidden && <span className="text-2xl font-bold text-white ml-2">{dealerHand.total}</span>}
              </div>
              <div className="flex gap-3 flex-wrap">
                {dealerHand.cards.length > 0 ? (
                  dealerHand.cards.map((card, i) => (
                    <CardComponent 
                      key={i} 
                      card={card} 
                      hidden={dealerHidden && i === 1} 
                    />
                  ))
                ) : (
                  <div className="w-16 h-24 bg-green-800/50 rounded-xl border-2 border-green-700/50 flex items-center justify-center">
                    <span className="text-green-600 text-4xl">?</span>
                  </div>
                )}
              </div>
            </div>

            {/* Player's Hand */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Hand className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-primary">Your Hand</h3>
                {playerHand.cards.length > 0 && (
                  <span className="text-2xl font-bold text-white ml-2">{playerHand.total}</span>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                {playerHand.cards.length > 0 ? (
                  playerHand.cards.map((card, i) => (
                    <CardComponent key={i} card={card} />
                  ))
                ) : (
                  <div className="w-16 h-24 bg-green-800/50 rounded-xl border-2 border-green-700/50 flex items-center justify-center">
                    <span className="text-green-600 text-4xl">?</span>
                  </div>
                )}
              </div>
            </div>

            {/* Game Controls */}
            {gameState === "betting" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Place your bet</p>
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
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-[0_0_30px_rgba(0,255,170,0.4)]"
                >
                  Deal Cards ({formatCurrency(bet || 0)})
                </Button>
              </div>
            )}

            {gameState === "playing" && (
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={hit} 
                  className="flex-1 min-w-[120px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                >
                  <Zap className="w-4 h-4 mr-2" /> Hit
                </Button>
                <Button 
                  onClick={stand} 
                  variant="outline"
                  className="flex-1 min-w-[120px] border-white/20 hover:border-white/40"
                >
                  Stand
                </Button>
                {playerHand.cards.length === 2 && (
                  <Button 
                    onClick={doubleDown}
                    variant="outline"
                    className="flex-1 min-w-[120px] border-accent/30 hover:border-accent/50 text-accent"
                  >
                    Double ({formatCurrency(bet * 2)})
                  </Button>
                )}
              </div>
            )}

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
                      {result.won ? "🎉 You Win!" : "😔 You Lose"}
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