import React, { useRef } from "react";
import { Link } from "wouter";
import { useGetPool, useGetMe, useGetRecentBigWins } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, ArrowRight, TrendingUp, DollarSign, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** Pops + glows whenever `value` changes by using the value as the React key */
function AnimatedStat({
  value,
  className,
  glowColor = "rgba(0,255,170,0.8)",
}: {
  value: string;
  className?: string;
  glowColor?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ scale: 1.3, textShadow: `0 0 24px ${glowColor}` }}
        animate={{ scale: 1, textShadow: `0 0 0px ${glowColor}` }}
        transition={{ type: "spring", stiffness: 380, damping: 18, duration: 0.4 }}
        className={className}
        style={{ display: "inline-block" }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export default function Home() {
  const { data: pool, isLoading: isPoolLoading } = useGetPool({ query: { refetchInterval: 5000 } });
  const { data: user } = useGetMe({ query: { retry: false } });
  const { data: recentWins } = useGetRecentBigWins({ query: { refetchInterval: 10000 } });

  const poolStr       = isPoolLoading ? "Loading..." : formatCurrency(pool?.totalAmount || 0);
  const bigBetStr     = isPoolLoading ? "-"          : formatCurrency(pool?.biggestBet  || 0);
  const bigWinStr     = isPoolLoading ? "-"          : formatCurrency(pool?.biggestWin  || 0);

  // Track whether the pool grew (flash green) or shrank (flash accent)
  const prevPool = useRef<number | null>(null);
  const poolNum  = parseFloat(String(pool?.totalAmount ?? "0"));
  const grew     = prevPool.current !== null && poolNum > prevPool.current;
  if (pool) prevPool.current = poolNum;

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/casino-bg.png`}
            alt="Casino Background"
            className="w-full h-full object-cover opacity-60 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
        </div>

        <div className="relative z-10 px-6 py-16 md:py-24 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Global Pool Active
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight">
              Play against the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent neon-text-primary">
                Global Economy
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Every bet shapes the pool. When you lose, the pool grows. When you win, you take from the community. How much will you claim?
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/games">
                <Button size="lg" className="w-full sm:w-auto text-lg shadow-[0_0_30px_rgba(0,255,170,0.3)] hover:shadow-[0_0_40px_rgba(0,255,170,0.5)]">
                  <Gamepad2 className="mr-2 w-5 h-5" />
                  Play Now
                </Button>
              </Link>
              {!user && (
                <Link href="/register">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg">
                    Claim Free Coins
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Pool Stats Widget */}
          <div className="w-full md:w-auto min-w-[320px]">
            <Card className="bg-black/60 backdrop-blur-2xl border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Current Global Pool
                  </p>
                  <div className="font-mono text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    <AnimatedStat
                      value={poolStr}
                      glowColor={grew ? "rgba(0,255,170,0.9)" : "rgba(255,100,100,0.8)"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Biggest Bet</p>
                    <p className="font-mono font-medium text-lg text-primary overflow-hidden">
                      <AnimatedStat value={bigBetStr} glowColor="rgba(0,255,170,0.8)" />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Biggest Win</p>
                    <p className="font-mono font-medium text-lg text-accent overflow-hidden">
                      <AnimatedStat value={bigWinStr} glowColor="rgba(255,170,0,0.8)" />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-display font-bold">Featured Games</h2>
          <Link href="/games" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/games/roulette" className="group block">
            <Card className="h-full overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,255,170,0.15)] border-white/5 hover:border-primary/50 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-0 flex flex-col sm:flex-row h-full">
                <div className="p-8 flex-1 flex flex-col justify-center space-y-4">
                  <h3 className="text-2xl font-display font-bold group-hover:text-primary transition-colors">Neon Roulette</h3>
                  <p className="text-muted-foreground text-sm">Classic game with dynamic pool-based odds. Choose red or black and ride the spin.</p>
                  <div className="pt-2">
                    <Button variant="ghost" className="px-0 group-hover:text-primary">Play Game <ArrowRight className="w-4 h-4 ml-2" /></Button>
                  </div>
                </div>
                <div className="w-full sm:w-2/5 min-h-[200px] bg-black/50 flex items-center justify-center p-6 border-l border-white/5">
                  <img src={`${import.meta.env.BASE_URL}images/roulette-icon.png`} alt="Roulette" className="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(0,255,170,0.3)] group-hover:rotate-180 transition-transform duration-1000 ease-out" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/games/plinko" className="group block">
            <Card className="h-full overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,0,255,0.15)] border-white/5 hover:border-secondary/50 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-0 flex flex-col sm:flex-row h-full">
                <div className="p-8 flex-1 flex flex-col justify-center space-y-4">
                  <h3 className="text-2xl font-display font-bold group-hover:text-secondary transition-colors">Drop Plinko</h3>
                  <p className="text-muted-foreground text-sm">Drop the ball, hit the multipliers. Control your risk to hunt for massive payouts.</p>
                  <div className="pt-2">
                    <Button variant="ghost" className="px-0 group-hover:text-secondary">Play Game <ArrowRight className="w-4 h-4 ml-2" /></Button>
                  </div>
                </div>
                <div className="w-full sm:w-2/5 min-h-[200px] bg-black/50 flex items-center justify-center p-6 border-l border-white/5">
                  <img src={`${import.meta.env.BASE_URL}images/plinko-icon.png`} alt="Plinko" className="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(255,0,255,0.3)] group-hover:-translate-y-2 transition-transform duration-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Live Feed */}
      <section>
        <Card className="bg-black/40 border-white/5 overflow-hidden">
          <div className="flex items-center px-6 py-4 border-b border-white/5 bg-white/5">
            <TrendingUp className="w-5 h-5 text-accent mr-3" />
            <h2 className="text-lg font-bold">Live Big Wins</h2>
          </div>
          <div className="p-0 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-4 p-6 min-w-max">
              <AnimatePresence initial={false}>
                {recentWins?.wins && recentWins.wins.length > 0 ? (
                  recentWins.wins.map((win, i) => (
                    <motion.div
                      key={`${win.timestamp}-${win.username}`}
                      initial={{ opacity: 0, x: 40, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 22 }}
                      className="flex-shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{win.username}</span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded">{win.gameType}</span>
                        </div>
                        <div className="font-mono text-success font-semibold">
                          <AnimatedStat
                            value={`+${formatCurrency(win.payout)}`}
                            glowColor="rgba(0,255,100,0.7)"
                            className="text-success"
                          />
                          {win.multiplier && <span className="text-muted-foreground text-xs ml-2">({win.multiplier}x)</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground text-sm"
                  >
                    No recent big wins. Be the first!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
