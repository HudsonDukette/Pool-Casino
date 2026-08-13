import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bomb, Gem } from "lucide-react";
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

const GRID_SIZE = 5;

type Tile = {
  index: number;
  revealed: boolean;
  isMine: boolean;
  isGem: boolean;
};

function TileComponent({ tile, onClick, disabled }: { tile: Tile; onClick: () => void; disabled: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || tile.revealed}
      whileHover={!disabled && !tile.revealed ? { scale: 1.05 } : {}}
      whileTap={!disabled && !tile.revealed ? { scale: 0.95 } : {}}
      className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
        tile.revealed
          ? tile.isMine
            ? "bg-red-500/30 border-red-500"
            : "bg-green-500/30 border-green-500"
          : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
      } ${disabled && !tile.revealed ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {tile.revealed ? (
        tile.isMine ? (
          <Bomb className="w-6 h-6 text-red-500" />
        ) : (
          <Gem className="w-6 h-6 text-green-400" />
        )
      ) : (
        <span className="text-gray-500 text-lg">?</span>
      )}
    </motion.button>
  );
}

export const Route = createFileRoute("/games/mines")({
  head: () => ({
    meta: [
      { title: "Mines — PoolCasino" },
      { name: "description", content: "Uncover tiles avoiding hidden mines for multiplier rewards." },
      { property: "og:title", content: "Mines — PoolCasino" },
      { property: "og:description", content: "Uncover tiles avoiding hidden mines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MinesGame,
});

function MinesGame() {
  const { user, isGuest, updateGuestBalance, setBalance, refresh } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => getPool(), refetchInterval: 10000 });
  const playGameFn = useServerFn(playGame);

  const [betAmount, setBetAmount] = useState("10");
  const [mineCount, setMineCount] = useState(3);
  const [gameState, setGameState] = useState<"betting" | "playing" | "finished">("betting");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [result, setResult] = useState<{ won: boolean; payout: number; message: string } | null>(null);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;
  const poolTotal = pool?.totalAmount ?? 0;

  const canPlay = gameState === "betting" && bet > 0 && bet <= balance;
  const canCashOut = gameState === "playing" && currentMultiplier > 1;

  function initializeGame() {
    const totalTiles = GRID_SIZE * GRID_SIZE;
    const minePositions = new Set<number>();
    
    while (minePositions.size < mineCount) {
      minePositions.add(Math.floor(Math.random() * totalTiles));
    }

    const newTiles: Tile[] = Array.from({ length: totalTiles }, (_, i) => ({
      index: i,
      revealed: false,
      isMine: minePositions.has(i),
      isGem: !minePositions.has(i),
    }));

    setTiles(newTiles);
    setCurrentMultiplier(1);
    setGameState("playing");
    setResult(null);
  }

  function revealTile(index: number) {
    if (gameState !== "playing") return;

    const tile = tiles[index];
    if (tile.revealed) return;

    const newTiles = [...tiles];
    newTiles[index] = { ...tile, revealed: true };
    setTiles(newTiles);

    if (tile.isMine) {
      // Hit a mine - game over
      endGame(false, 0, "💥 You hit a mine!");
    } else {
      // Safe tile - increase multiplier
      const revealedGems = newTiles.filter(t => t.revealed && t.isGem).length;
      const remainingTiles = GRID_SIZE * GRID_SIZE - revealedGems - mineCount;
      const newMultiplier = 1 + (revealedGems * 0.2);
      setCurrentMultiplier(newMultiplier);

      // Auto cash out if all gems found
      if (remainingTiles === 0) {
        cashOut();
      }
    }
  }

  function cashOut() {
    if (!canCashOut) return;

    const payout = bet * currentMultiplier;
    endGame(true, payout, `✨ Cashed out at ${currentMultiplier.toFixed(2)}×!`);
  }

  function endGame(won: boolean, payout: number, message: string) {
    setGameState("finished");
    setResult({ won, payout, message });

    // Reveal all tiles
    const revealedTiles = tiles.map(t => ({ ...t, revealed: true }));
    setTiles(revealedTiles);

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
          data: { gameId: "mines", option: mineCount.toString(), betAmount: bet },
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
    setTiles([]);
    setCurrentMultiplier(1);
    setResult(null);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Mines</h1>
          <p className="text-muted-foreground mt-2">Uncover gems and avoid mines. Each safe tile increases your multiplier.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Mines Grid */}
          <Card className="bg-gradient-to-br from-rose-900/30 to-red-900/30 border-rose-700/50 shadow-2xl">
            <CardContent className="p-6">
              <div className="grid grid-cols-5 gap-2 justify-items-center">
                {tiles.map((tile) => (
                  <TileComponent
                    key={tile.index}
                    tile={tile}
                    onClick={() => revealTile(tile.index)}
                    disabled={gameState !== "playing"}
                  />
                ))}
              </div>

              {gameState === "betting" && (
                <div className="mt-4 text-center text-muted-foreground">
                  Place your bet to start
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              {/* Mine Count Selection */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Number of mines</p>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 6, 12].map((count) => (
                    <button
                      key={count}
                      onClick={() => setMineCount(count)}
                      disabled={gameState !== "betting"}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        mineCount === count
                          ? "border-rose-500 bg-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                          : "border-rose-500/30 bg-rose-500/10 hover:border-rose-500/50"
                      } ${gameState !== "betting" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="font-semibold text-rose-400">{count} mines</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {count === 3 ? "Safe" : count === 6 ? "Medium" : "High risk"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet Amount */}
              {gameState === "betting" && (
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
              )}

              {/* Game Buttons */}
              {gameState === "betting" && (
                <Button
                  onClick={initializeGame}
                  disabled={!canPlay}
                  className="w-full h-12 text-base bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
                >
                  Start Game ({formatCurrency(bet || 0)})
                </Button>
              )}

              {gameState === "playing" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <p className="text-sm text-muted-foreground">Current multiplier</p>
                    <p className="text-2xl font-bold text-primary">{currentMultiplier.toFixed(2)}×</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Potential win: {formatCurrency(bet * currentMultiplier)}
                    </p>
                  </div>
                  <Button
                    onClick={cashOut}
                    disabled={!canCashOut}
                    className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  >
                    Cash Out ({formatCurrency(bet * currentMultiplier)})
                  </Button>
                </div>
              )}

              {gameState === "finished" && result && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl border-2 ${
                      result.won
                        ? "bg-primary/20 border-primary/50"
                        : "bg-destructive/20 border-destructive/50"
                    }`}
                  >
                    <p className={`font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? "🎉 You Won!" : "😔 Game Over"}
                    </p>
                    <p className="text-sm text-white mt-1">{result.message}</p>
                    {result.payout > 0 && (
                      <p className="text-lg font-mono text-primary mt-2">
                        +{formatCurrency(result.payout)}
                      </p>
                    )}
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
              <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
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
      </div>
    </Layout>
  );
}