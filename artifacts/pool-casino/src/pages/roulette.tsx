import React, { useState, useEffect } from "react";
import { usePlayRoulette, useGetPool, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Coins, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Roulette() {
  const { data: pool } = useGetPool();
  const { data: user } = useGetMe({ query: { retry: false } });
  const playMut = usePlayRoulette();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [betAmount, setBetAmount] = useState<string>("10");
  const [color, setColor] = useState<"red" | "black">("red");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Dynamic chance estimation based on UI representation (actual calculated on server, this is just for UI feel)
  const numericBet = parseFloat(betAmount) || 0;
  const estimatedChance = numericBet <= 0 ? 0 : 
                          numericBet <= 1 ? 95 : 
                          numericBet <= 10 ? 80 : 
                          numericBet <= 100 ? 50 : 
                          numericBet <= 1000 ? 10 : 0.01;

  const handlePlay = () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to play.", variant: "destructive" });
      return;
    }
    if (numericBet <= 0 || (pool && numericBet > pool.maxBet)) {
      toast({ title: "Invalid Bet", description: "Bet amount is outside allowed limits.", variant: "destructive" });
      return;
    }
    if (numericBet > user.balance) {
      toast({ title: "Insufficient Funds", description: "You do not have enough coins.", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setResult(null);

    playMut.mutate(
      { data: { betAmount: numericBet, color } },
      {
        onSuccess: (data) => {
          // Fake spin delay for UX
          setTimeout(() => {
            setResult(data);
            setSpinning(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pool"] });
            
            if (data.won) {
              toast({
                title: "You Won! 🎉",
                description: `Payout: ${formatCurrency(data.payout)}`,
                className: "bg-success text-success-foreground border-none",
              });
            }
          }, 2000);
        },
        onError: (err) => {
          setSpinning(false);
          toast({
            title: "Error",
            description: err.error?.error || "Failed to place bet",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Game Area */}
        <div className="flex-1 space-y-6">
          <Card className="bg-black/60 border-white/10 overflow-hidden relative min-h-[400px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,170,0.05),transparent_70%)]" />
            
            <AnimatePresence mode="wait">
              {!spinning && !result ? (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="text-center z-10">
                  <img src={`${import.meta.env.BASE_URL}images/roulette-icon.png`} alt="Roulette" className="w-48 h-48 mx-auto opacity-50 mb-4" />
                  <p className="text-muted-foreground text-lg">Place your bet to spin</p>
                </motion.div>
              ) : spinning ? (
                <motion.div key="spinning" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="z-10">
                  <motion.img 
                    src={`${import.meta.env.BASE_URL}images/roulette-icon.png`} 
                    alt="Spinning" 
                    className="w-48 h-48 mx-auto drop-shadow-[0_0_30px_rgba(0,255,170,0.5)]"
                    animate={{ rotate: 360 * 10 }}
                    transition={{ duration: 2, ease: "circOut" }}
                  />
                  <p className="text-primary mt-8 text-xl font-bold font-display animate-pulse text-center neon-text-primary">Spinning...</p>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-center z-10">
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-5xl font-display font-bold shadow-2xl ${
                    result.resultColor === "red" ? "bg-red-500 text-white shadow-red-500/50" : 
                    result.resultColor === "black" ? "bg-gray-900 text-white shadow-gray-900/50" : 
                    "bg-green-500 text-white shadow-green-500/50"
                  }`}>
                    {result.resultNumber}
                  </div>
                  <h3 className="mt-6 text-3xl font-bold font-display uppercase tracking-widest text-white">
                    {result.resultColor} {result.resultNumber}
                  </h3>
                  {result.won ? (
                    <p className="mt-4 text-2xl text-success font-mono font-bold neon-text-primary">
                      +{formatCurrency(result.payout)}
                    </p>
                  ) : (
                    <p className="mt-4 text-xl text-destructive font-mono opacity-80">
                      -{formatCurrency(result.betAmount)}
                    </p>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>
        </div>

        {/* Controls Area */}
        <div className="w-full md:w-80 space-y-6">
          <Card className="border-white/10 bg-card/80">
            <CardContent className="p-6 space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Bet Amount</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    min="0.01" 
                    step="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={spinning}
                    className="pl-10 font-mono text-lg h-14 bg-black/50"
                    icon={<Coins className="w-5 h-5" />}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((numericBet / 2).toString())} disabled={spinning}>1/2</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((numericBet * 2).toString())} disabled={spinning}>2x</Button>
                  {user && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((user.balance).toString())} disabled={spinning}>Max</Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Color</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={color === "red" ? "default" : "outline"}
                    onClick={() => setColor("red")}
                    disabled={spinning}
                    className={`h-14 ${color === "red" ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" : "hover:bg-red-500/10 hover:text-red-400"}`}
                  >
                    Red
                  </Button>
                  <Button
                    variant={color === "black" ? "default" : "outline"}
                    onClick={() => setColor("black")}
                    disabled={spinning}
                    className={`h-14 ${color === "black" ? "bg-gray-800 hover:bg-gray-700 shadow-gray-800/30 text-white border-gray-600" : "hover:bg-gray-800/50 hover:text-white"}`}
                  >
                    Black
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Win Chance
                  </span>
                  <span className="font-mono font-medium text-primary">~{estimatedChance}%</span>
                </div>
                <Button 
                  size="lg" 
                  className="w-full h-16 text-xl" 
                  onClick={handlePlay}
                  disabled={spinning || numericBet <= 0}
                >
                  {spinning ? "Placing Bet..." : "Place Bet"}
                </Button>
              </div>

            </CardContent>
          </Card>

          {pool && (
            <div className="text-xs text-muted-foreground text-center bg-white/5 p-4 rounded-xl border border-white/5">
              Max Bet Allowed: <span className="text-white font-mono">{formatCurrency(pool.maxBet)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
