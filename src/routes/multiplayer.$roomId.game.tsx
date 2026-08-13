import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Shield } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getRoomDetails } from "@/lib/multiplayer.functions";
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

type MultiplayerRoom = {
  id: string;
  game_id: string;
  created_by: string;
  bet_amount: number;
  max_players: number;
  status: string;
  created_at: string;
  creator: { username: string | null; avatar_url: string | null };
  players: Array<{
    user_id: string;
    status: string;
    player: { username: string | null; avatar_url: string | null };
  }>;
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

function CardComponent({ card }: { card: Card }) {
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

  return (
    <div className="w-12 h-16 bg-white rounded-lg border border-gray-300 flex flex-col items-center justify-center shadow">
      <span className={`text-lg font-bold ${suitColors[card.suit]}`}>{card.value}</span>
      <span className={`text-xl ${suitColors[card.suit]}`}>{suitSymbols[card.suit]}</span>
    </div>
  );
}

export const Route = createFileRoute("/multiplayer/$roomId/game")({
  component: MultiplayerBlackjack,
});

function MultiplayerBlackjack() {
  const { roomId } = Route.useParams();
  const { user, isAuthenticated } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const getRoomDetailsFn = useServerFn(getRoomDetails);

  const [gameState, setGameState] = useState<"betting" | "playing" | "finished">("betting");
  const [deck, setDeck] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Hand>({ cards: [], total: 0, busted: false });
  const [playerHands, setPlayerHands] = useState<Record<string, Hand>>({});
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  const { data: room, refetch } = useQuery({
    queryKey: ["multiplayer-room", roomId],
    queryFn: () => getRoomDetailsFn({ data: { roomId } }),
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (room?.status === "playing" && gameState === "betting") {
      startGame();
    }
  }, [room?.status, gameState]);

  function startGame() {
    const newDeck = shuffleDeck(createDeck());
    setDeck(newDeck);
    
    // Deal cards to all players
    const hands: Record<string, Hand> = {};
    room?.players.forEach((player) => {
      const cards = [newDeck.pop()!, newDeck.pop()!];
      hands[player.user_id] = {
        cards,
        total: calculateHandValue(cards),
        busted: false,
      };
    });
    
    // Deal to dealer
    const dealerCards = [newDeck.pop()!, newDeck.pop()!];
    setDealerHand({
      cards: dealerCards,
      total: calculateHandValue([dealerCards[0]]), // Show only first card
      busted: false,
    });
    
    setPlayerHands(hands);
    setGameState("playing");
    setCurrentPlayerIndex(0);
  }

  function hit() {
    if (!deck.length || !user) return;
    
    const newCard = deck.pop()!;
    const currentHand = playerHands[user.id];
    const newCards = [...currentHand.cards, newCard];
    const newTotal = calculateHandValue(newCards);
    const busted = newTotal > 21;
    
    setPlayerHands({
      ...playerHands,
      [user.id]: { cards: newCards, total: newTotal, busted },
    });
    
    if (busted) {
      nextPlayer();
    }
  }

  function stand() {
    nextPlayer();
  }

  function nextPlayer() {
    const nextIndex = currentPlayerIndex + 1;
    if (nextIndex >= (room?.players.length || 0)) {
      // All players done, dealer's turn
      dealerPlay();
    } else {
      setCurrentPlayerIndex(nextIndex);
    }
  }

  function dealerPlay() {
    let newDealerCards = [...dealerHand.cards];
    let dealerTotal = calculateHandValue(newDealerCards);
    
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
    
    determineWinner(dealerBusted, dealerTotal);
  }

  function determineWinner(dealerBusted: boolean, dealerTotal: number) {
    let bestPlayer: string | null = null;
    let bestScore = -1;
    
    Object.entries(playerHands).forEach(([userId, hand]) => {
      if (hand.busted) return;
      
      if (dealerBusted) {
        if (hand.total > bestScore) {
          bestScore = hand.total;
          bestPlayer = userId;
        }
      } else if (hand.total > dealerTotal && hand.total > bestScore) {
        bestScore = hand.total;
        bestPlayer = userId;
      }
    });
    
    setWinner(bestPlayer);
    setGameState("finished");
  }

  const isMyTurn = room?.players[currentPlayerIndex]?.user_id === user?.id;
  const myHand = user ? playerHands[user.id] : null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/multiplayer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Leave Game
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Multiplayer Blackjack
          </h1>
          <p className="text-muted-foreground mt-2">
            Pot: {formatCurrency((room?.bet_amount || 0) * (room?.players.length || 0))}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Dealer */}
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/50 lg:col-span-3">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">Dealer</h3>
                {gameState === "playing" && (
                  <span className="text-2xl font-bold text-white ml-2">{dealerHand.total}</span>
                )}
                {gameState === "finished" && (
                  <span className="text-2xl font-bold text-white ml-2">{calculateHandValue(dealerHand.cards)}</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {dealerHand.cards.length > 0 ? (
                  dealerHand.cards.map((card, i) => (
                    <div key={i}>
                      {gameState === "playing" && i === 1 ? (
                        <div className="w-12 h-16 bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg border border-blue-600 flex items-center justify-center">
                          <span className="text-blue-400">?</span>
                        </div>
                      ) : (
                        <CardComponent card={card} />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="w-12 h-16 bg-green-800/50 rounded-lg border border-green-700/50 flex items-center justify-center">
                    <span className="text-green-600">?</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Players */}
          {room?.players.map((player, index) => {
            const hand = playerHands[player.user_id];
            const isCurrentPlayer = index === currentPlayerIndex;
            const isWinner = winner === player.user_id;
            
            return (
              <Card 
                key={player.user_id}
                className={`${
                  isCurrentPlayer ? "ring-2 ring-primary" : ""
                } ${isWinner ? "ring-2 ring-yellow-500" : ""} bg-black/50 border-white/10`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                      {player.player.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm">{player.player.username || "Anonymous"}</span>
                        {player.user_id === room.created_by && <Crown className="w-3 h-3 text-yellow-500" />}
                        {player.user_id === user?.id && <span className="text-xs text-primary">(You)</span>}
                      </div>
                      {isCurrentPlayer && gameState === "playing" && (
                        <span className="text-xs text-primary">Playing...</span>
                      )}
                      {isWinner && gameState === "finished" && (
                        <span className="text-xs text-yellow-400">🏆 Winner!</span>
                      )}
                    </div>
                  </div>
                  
                  {hand && hand.cards.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-1 flex-wrap">
                        {hand.cards.map((card, i) => (
                          <div key={i} className="w-8 h-12 bg-white rounded border border-gray-300 flex items-center justify-center">
                            <span className="text-xs font-bold">{card.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total: {hand.total} {hand.busted && "(Busted)"}
                      </div>
                    </div>
                  )}

                  {isCurrentPlayer && gameState === "playing" && isMyTurn && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={hit} className="flex-1">
                        Hit
                      </Button>
                      <Button size="sm" variant="outline" onClick={stand} className="flex-1">
                        Stand
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Game Status */}
          {gameState === "finished" && winner && (
            <Card className="lg:col-span-3 bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-700/50">
              <CardContent className="p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-4xl mb-4"
                >
                  🏆
                </motion.div>
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">
                  {room?.players.find(p => p.user_id === winner)?.player.username || "Unknown"} Wins!
                </h2>
                <p className="text-muted-foreground">
                  They win {formatCurrency((room?.bet_amount || 0) * (room?.players.length || 0))}
                </p>
                <Button 
                  onClick={() => navigate({ to: "/multiplayer" })}
                  className="mt-4"
                >
                  Back to Lobby
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}