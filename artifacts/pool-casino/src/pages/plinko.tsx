import React, { useState } from "react";
import { usePlayPlinko, useGetPool, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Coins, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const RISK_LEVELS = {
  low: { name: "Low", color: "bg-blue-500", mults: [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5] },
  medium: { name: "Medium", color: "bg-yellow-500", mults: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3] },
  high: { name: "High", color: "bg-destructive", mults: [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1] }
};

export default function Plinko() {
  const { data: pool } = useGetPool();
  const { data: user } = useGetMe({ query: { retry: false } });
  const playMut = usePlayPlinko();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [betAmount, setBetAmount] = useState<string>("10");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  
  // Board constants
  const ROWS = 8;
  const ROW_HEIGHT = 40;
  const PEG_SPACING = 40;

  // Animation state
  const [ballPath, setBallPath] = useState<{x: number, y: number}[]>([]);
  const [resultMulti, setResultMulti] = useState<number | null>(null);

  const numericBet = parseFloat(betAmount) || 0;

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

    setDropping(true);
    setResultMulti(null);

    playMut.mutate(
      { data: { betAmount: numericBet, risk } },
      {
        onSuccess: (data) => {
          // Calculate pixel path for animation
          let currentX = 0;
          let currentY = 0;
          const coords = [{x: currentX, y: currentY}];
          
          data.path.forEach((dir) => {
            currentY += ROW_HEIGHT;
            currentX += (dir === 'R' ? PEG_SPACING/2 : -PEG_SPACING/2);
            coords.push({x: currentX, y: currentY});
          });

          setBallPath(coords);

          // Reveal result after animation (roughly 8 * 0.3s)
          setTimeout(() => {
            setResultMulti(data.multiplier);
            setDropping(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pool"] });
            
            if (data.won) {
               toast({ title: "Big Win! 🚀", description: `You won ${formatCurrency(data.payout)} (${data.multiplier}x)`, className: "bg-success text-success-foreground border-none" });
            }
          }, coords.length * 200 + 200);
        },
        onError: (err) => {
          setDropping(false);
          toast({ title: "Error", description: err.error?.error || "Failed to place bet", variant: "destructive" });
        }
      }
    );
  };

  // Render Pegs
  const renderPegs = () => {
    const pegs = [];
    for (let r = 1; r <= ROWS; r++) {
      const pegsInRow = r + 1;
      const startX = -((pegsInRow - 1) * PEG_SPACING) / 2;
      for (let p = 0; p < pegsInRow; p++) {
        pegs.push(
          <div 
            key={`peg-${r}-${p}`}
            className="absolute w-2 h-2 rounded-full bg-white/20 shadow-[0_0_5px_rgba(255,255,255,0.2)]"
            style={{ 
              top: `${r * ROW_HEIGHT}px`, 
              left: `calc(50% + ${startX + p * PEG_SPACING}px)`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      }
    }
    return pegs;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Game Board */}
        <div className="flex-1 flex flex-col">
          <Card className="bg-black border-white/10 overflow-hidden relative flex-1 flex flex-col justify-end pt-12 pb-6 shadow-2xl min-h-[500px]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,255,0.05),transparent_70%)]" />
            
            <div className="relative w-full max-w-md mx-auto" style={{ height: `${ROWS * ROW_HEIGHT + 60}px` }}>
              {/* Pegs */}
              {renderPegs()}
              
              {/* Ball */}
              {ballPath.length > 0 && (
                <motion.div
                  className="absolute w-4 h-4 rounded-full bg-secondary shadow-[0_0_15px_rgba(255,0,255,1)] z-20"
                  initial={{ top: 0, left: '50%', x: '-50%', y: '-50%' }}
                  animate={{
                    top: ballPath.map(p => p.y),
                    left: ballPath.map(p => `calc(50% + ${p.x}px)`),
                  }}
                  transition={{
                    duration: ballPath.length * 0.2,
                    ease: "linear",
                    times: ballPath.map((_, i) => i / (ballPath.length - 1))
                  }}
                />
              )}

              {/* Multiplier Slots at bottom */}
              <div className="absolute bottom-0 w-full flex justify-center gap-1 px-4">
                {RISK_LEVELS[risk].mults.map((m, i) => {
                  const isHighlighted = resultMulti === m && !dropping && ballPath.length > 0;
                  return (
                    <div 
                      key={i} 
                      className={`flex-1 flex items-center justify-center rounded-md py-2 text-xs font-mono font-bold transition-all duration-300 ${
                        isHighlighted 
                          ? `${RISK_LEVELS[risk].color} text-white shadow-[0_0_15px_currentColor] scale-110 z-10` 
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {m}x
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Controls */}
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
                    disabled={dropping}
                    className="pl-10 font-mono text-lg h-14 bg-black/50 focus-visible:ring-secondary focus-visible:border-secondary"
                    icon={<Coins className="w-5 h-5" />}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((numericBet / 2).toString())} disabled={dropping}>1/2</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((numericBet * 2).toString())} disabled={dropping}>2x</Button>
                  {user && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount((user.balance).toString())} disabled={dropping}>Max</Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex justify-between">
                  Risk Level
                  <span className="text-xs text-secondary/70 flex items-center gap-1"><Info className="w-3 h-3"/> Alters payouts</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((r) => (
                    <Button
                      key={r}
                      variant={risk === r ? "default" : "outline"}
                      onClick={() => setRisk(r)}
                      disabled={dropping}
                      className={`capitalize ${risk === r ? 'bg-secondary hover:bg-secondary/90 shadow-secondary/20' : 'hover:text-secondary hover:border-secondary/50'}`}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  size="lg" 
                  className="w-full h-16 text-xl bg-secondary hover:bg-secondary/90 shadow-secondary/20" 
                  onClick={handlePlay}
                  disabled={dropping || numericBet <= 0}
                >
                  {dropping ? "Dropping..." : "Drop Ball"}
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
