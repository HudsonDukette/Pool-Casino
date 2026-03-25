import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency } from "@/lib/utils";

interface DealResult {
  playerCards: string[];
  dealerUpcard?: string;
  dealerCards?: string[];
  playerTotal: number;
  dealerTotal?: number;
  done: boolean;
  won?: boolean;
  payout?: number;
  multiplier?: number;
  newBalance?: number;
  outcome?: string;
}

interface ActionResult {
  playerCards: string[];
  dealerCards?: string[];
  playerTotal: number;
  dealerTotal?: number;
  done: boolean;
  won?: boolean;
  payout?: number;
  multiplier?: number;
  newBalance?: number;
  outcome?: string;
}

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
function getCardSuit(index: number, card: string) {
  const suit = SUIT_SYMBOLS[index % SUIT_SYMBOLS.length];
  const isRed = suit === "♥" || suit === "♦";
  return { suit, isRed };
}

function PlayingCard({ label, hidden, index }: { label: string; hidden?: boolean; index: number }) {
  const { suit, isRed } = getCardSuit(index, label);
  return (
    <motion.div
      initial={{ rotateY: 90, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 300 }}
      className="w-16 h-24 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur flex flex-col items-center justify-center shadow-lg"
    >
      {hidden ? (
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
          🂠
        </div>
      ) : (
        <div className={`text-center ${isRed ? "text-red-400" : "text-white"}`}>
          <div className="text-xl font-bold leading-none">{label}</div>
          <div className="text-lg">{suit}</div>
        </div>
      )}
    </motion.div>
  );
}

function Hand({ cards, label, total, hidden }: { cards: string[]; label: string; total?: number | null; hidden?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {total !== null && total !== undefined && !hidden && (
          <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${total > 21 ? "bg-destructive/20 text-destructive" : total === 21 ? "bg-primary/20 text-primary" : "bg-white/10 text-white"}`}>
            {total}
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {cards.map((c, i) => (
          <PlayingCard key={i} label={c} index={i} hidden={i === 1 && !!hidden} />
        ))}
      </div>
    </div>
  );
}

const OUTCOME_LABELS: Record<string, string> = {
  blackjack:        "🃏 Blackjack! (2.5×)",
  dealer_blackjack: "Dealer Blackjack",
  push:             "🤝 Push — bet returned",
  bust:             "💥 Bust!",
  dealer_bust:      "🎉 Dealer Busts!",
  win:              "🏆 You Win!",
  lose:             "You Lose",
};

export default function Blackjack() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const dealApi = useGameApi<DealResult>();
  const actionApi = useGameApi<ActionResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [gameState, setGameState] = useState<DealResult | null>(null);
  const [actionState, setActionState] = useState<ActionResult | null>(null);
  const [phase, setPhase] = useState<"bet" | "play" | "done">("bet");

  const bet = parseFloat(betAmount) || 0;
  const loading = dealApi.loading || actionApi.loading;

  async function handleDeal() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setActionState(null);
    const data = await dealApi.call("blackjack/deal", { betAmount: bet });
    if (data) {
      setGameState(data);
      if (data.done) {
        setPhase("done");
        qc.invalidateQueries({ queryKey: ["getMe"] });
        qc.invalidateQueries({ queryKey: ["getPool"] });
        toast({
          title: OUTCOME_LABELS[data.outcome ?? ""] ?? "Game Over",
          description: data.payout ? `Payout: ${formatCurrency(data.payout)}` : "",
          variant: data.won ? "default" : "destructive",
        });
      } else {
        setPhase("play");
      }
    }
  }

  async function handleAction(action: "hit" | "stand") {
    const data = await actionApi.call("blackjack/action", { action });
    if (data) {
      if (action === "hit" && !data.done) {
        // Update player cards only
        setGameState(prev => prev ? { ...prev, playerCards: data.playerCards, playerTotal: data.playerTotal } : prev);
      } else {
        setActionState(data);
        setPhase("done");
        qc.invalidateQueries({ queryKey: ["getMe"] });
        qc.invalidateQueries({ queryKey: ["getPool"] });
        toast({
          title: OUTCOME_LABELS[data.outcome ?? ""] ?? "Game Over",
          description: data.payout ? `Payout: ${formatCurrency(data.payout)}` : "",
          variant: data.won ? "default" : "destructive",
        });
      }
    }
  }

  function handleReset() {
    setGameState(null);
    setActionState(null);
    setPhase("bet");
    dealApi.reset();
    actionApi.reset();
  }

  const finalState = actionState ?? (gameState?.done ? gameState : null);
  const currentGame = gameState;

  return (
    <GameShell title="Blackjack" description="Beat the dealer to 21. Blackjack pays 2.5×. Dealer stands on 17." accentColor="text-green-400">
      <div className="space-y-6">
        {/* Table */}
        <Card className="bg-[#0a1a0a] border-green-900/40 min-h-[400px]">
          <CardContent className="p-8 space-y-8">
            {/* Dealer */}
            {currentGame && (
              <Hand
                label="Dealer"
                cards={finalState?.dealerCards ?? [currentGame.dealerUpcard ?? "?", "?"]}
                total={finalState?.dealerTotal ?? null}
                hidden={phase === "play"}
              />
            )}

            {/* Divider */}
            {currentGame && <div className="border-t border-green-900/40" />}

            {/* Player */}
            {currentGame && (
              <Hand
                label="You"
                cards={currentGame.playerCards}
                total={currentGame.playerTotal}
              />
            )}

            {/* Outcome */}
            {finalState && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-center p-4 rounded-2xl ${
                    finalState.won ? "bg-primary/10 border border-primary/30" :
                    finalState.outcome === "push" ? "bg-yellow-400/10 border border-yellow-400/30" :
                    "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <p className={`text-2xl font-display font-bold ${
                    finalState.won ? "text-primary" :
                    finalState.outcome === "push" ? "text-yellow-400" :
                    "text-destructive"
                  }`}>
                    {OUTCOME_LABELS[finalState.outcome ?? ""] ?? "Game Over"}
                  </p>
                  {finalState.payout !== undefined && (
                    <p className="text-muted-foreground text-sm mt-1">
                      Payout: {formatCurrency(finalState.payout)} · Balance: {formatCurrency(finalState.newBalance ?? 0)}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Empty state */}
            {!currentGame && (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Place your bet and deal to start
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6">
            {phase === "bet" && (
              <div className="space-y-4">
                <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                {dealApi.error && <p className="text-sm text-destructive">{dealApi.error}</p>}
                <Button
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg"
                  size="lg"
                  disabled={loading}
                  onClick={handleDeal}
                >
                  {loading ? "Dealing…" : "🃏 Deal"}
                </Button>
              </div>
            )}

            {phase === "play" && (
              <div className="space-y-3">
                <p className="text-center text-muted-foreground text-sm">Your total: <span className="font-mono font-bold text-white">{currentGame?.playerTotal}</span></p>
                {actionApi.error && <p className="text-sm text-destructive">{actionApi.error}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg h-14"
                    disabled={loading}
                    onClick={() => handleAction("hit")}
                  >
                    {loading ? "…" : "👊 Hit"}
                  </Button>
                  <Button
                    className="bg-red-700 hover:bg-red-600 text-white font-bold text-lg h-14"
                    disabled={loading}
                    onClick={() => handleAction("stand")}
                  >
                    {loading ? "…" : "✋ Stand"}
                  </Button>
                </div>
              </div>
            )}

            {phase === "done" && (
              <Button
                className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg"
                size="lg"
                onClick={handleReset}
              >
                🃏 New Hand
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
