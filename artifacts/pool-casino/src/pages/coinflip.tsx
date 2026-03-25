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

interface FlipResult {
  won: boolean;
  choice: string;
  result: string;
  payout: number;
  multiplier: number;
  newBalance: number;
}

function Coin({ side, flipping }: { side: "heads" | "tails"; flipping: boolean }) {
  return (
    <div className="relative w-32 h-32">
      <motion.div
        animate={flipping ? { rotateY: [0, 180, 360, 540, 720] } : { rotateY: 0 }}
        transition={flipping ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
        className="w-full h-full rounded-full border-4 border-yellow-400/60 bg-gradient-to-br from-yellow-300/30 to-yellow-500/20 shadow-[0_0_40px_rgba(250,204,21,0.4)] flex items-center justify-center"
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="text-5xl select-none">
          {side === "heads" ? "👑" : "⚡"}
        </span>
      </motion.div>
    </div>
  );
}

export default function CoinFlip() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<FlipResult>();

  const [betAmount, setBetAmount] = useState("10");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);

  const bet = parseFloat(betAmount) || 0;

  async function handleFlip() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setFlipping(true);
    setResult(null);

    setTimeout(async () => {
      const data = await api.call("coinflip", { betAmount: bet, choice });
      setFlipping(false);
      if (data) {
        setCoinSide(data.result as "heads" | "tails");
        setResult(data);
        qc.invalidateQueries({ queryKey: ["getMe"] });
        qc.invalidateQueries({ queryKey: ["getPool"] });
        toast({
          title: data.won ? `${data.result === "heads" ? "👑" : "⚡"} ${data.result.toUpperCase()}!` : `It's ${data.result}!`,
          description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
          variant: data.won ? "default" : "destructive",
        });
      }
    }, 900);
  }

  return (
    <GameShell title="Coin Flip" description="Pick heads or tails. Win 1.95× your bet." accentColor="text-yellow-400">
      <Card className="bg-card/40 border-white/10">
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col items-center gap-8">
            {/* Coin */}
            <Coin side={flipping ? choice : coinSide} flipping={flipping} />

            {/* Choice */}
            <div className="flex gap-4">
              <button
                onClick={() => setChoice("heads")}
                disabled={flipping || api.loading}
                className={`px-8 py-4 rounded-2xl border-2 font-display font-bold text-lg transition-all ${
                  choice === "heads"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                    : "border-white/10 bg-white/5 text-white hover:border-white/30"
                }`}
              >
                👑 Heads
              </button>
              <button
                onClick={() => setChoice("tails")}
                disabled={flipping || api.loading}
                className={`px-8 py-4 rounded-2xl border-2 font-display font-bold text-lg transition-all ${
                  choice === "tails"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                    : "border-white/10 bg-white/5 text-white hover:border-white/30"
                }`}
              >
                ⚡ Tails
              </button>
            </div>

            {/* Bet */}
            <div className="w-full max-w-sm space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={flipping || api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              size="lg"
              className="w-full max-w-sm bg-yellow-500/90 hover:bg-yellow-400 text-black font-bold"
              disabled={flipping || api.loading}
              onClick={handleFlip}
            >
              {flipping ? "Flipping…" : "Flip Coin (1.95×)"}
            </Button>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-center px-6 py-3 rounded-2xl ${result.won ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30"}`}
                >
                  <p className={`text-2xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                    {result.won ? "You Win!" : "You Lose"}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`} · Balance: {formatCurrency(result.newBalance)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </GameShell>
  );
}
