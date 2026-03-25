import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const games = [
  {
    id: "roulette",
    name: "Neon Roulette",
    description: "Classic red or black with dynamic odds based on the global pool.",
    emoji: "🎡",
    href: "/games/roulette",
    active: true,
    accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(0,255,170,0.15)]",
    titleClass: "group-hover:text-primary",
    tag: "Classic",
    tagColor: "bg-primary/20 text-primary",
  },
  {
    id: "plinko",
    name: "Drop Plinko",
    description: "Drop the ball through the pegs. Control your risk for massive multipliers.",
    emoji: "🔴",
    href: "/games/plinko",
    active: true,
    accentClass: "group-hover:border-secondary/50 group-hover:shadow-[0_0_30px_rgba(255,0,255,0.15)]",
    titleClass: "group-hover:text-secondary",
    tag: "Physics",
    tagColor: "bg-secondary/20 text-secondary",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    description: "Race to 21 against the dealer. Hit or Stand. Blackjack pays 2.5×.",
    emoji: "🃏",
    href: "/games/blackjack",
    active: true,
    accentClass: "group-hover:border-green-500/50 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]",
    titleClass: "group-hover:text-green-400",
    tag: "Strategy",
    tagColor: "bg-green-500/20 text-green-400",
  },
  {
    id: "crash",
    name: "Crash",
    description: "Watch the multiplier climb and cash out before it crashes. Set your target and launch.",
    emoji: "🚀",
    href: "/games/crash",
    active: true,
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    titleClass: "group-hover:text-red-400",
    tag: "Thrill",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "slots",
    name: "Neon Slots",
    description: "Match all 3 reels to win. Sevens pay 20×, diamonds pay 10×, and more!",
    emoji: "🎰",
    href: "/games/slots",
    active: true,
    accentClass: "group-hover:border-pink-500/50 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]",
    titleClass: "group-hover:text-pink-400",
    tag: "Luck",
    tagColor: "bg-pink-500/20 text-pink-400",
  },
  {
    id: "dice",
    name: "Dice Roll",
    description: "Guess exact (5×) or pick high/low (1.9×). Simple, fast, addictive.",
    emoji: "🎲",
    href: "/games/dice",
    active: true,
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Quick",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "coinflip",
    name: "Coin Flip",
    description: "The simplest bet. Pick heads or tails and double your money. 1.95× on win.",
    emoji: "👑",
    href: "/games/coinflip",
    active: true,
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    titleClass: "group-hover:text-amber-400",
    tag: "50/50",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "wheel",
    name: "Fortune Wheel",
    description: "Spin the wheel and land on multipliers from 0.2× to 10×. Rarer segments = bigger rewards.",
    emoji: "🎡",
    href: "/games/wheel",
    active: true,
    accentClass: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
    titleClass: "group-hover:text-purple-400",
    tag: "Spin",
    tagColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "guess",
    name: "Number Guess",
    description: "Guess 1–100. Exact match pays 50×! Within 1 pays 10×. The closer, the bigger.",
    emoji: "🎯",
    href: "/games/guess",
    active: true,
    accentClass: "group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]",
    titleClass: "group-hover:text-cyan-400",
    tag: "Precision",
    tagColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "mines",
    name: "Mines",
    description: "Place mines and reveal safe tiles. More reveals = bigger multiplier. Hit a mine and you lose.",
    emoji: "💣",
    href: "/games/mines",
    active: true,
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Risk",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
];

export default function Games() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="text-center space-y-4 pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-display font-bold">Casino Games</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          10 games. One global pool. Every bet matters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {games.map((game) => {
          const content = (
            <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/5 relative ${game.active ? game.accentClass : "opacity-60 cursor-not-allowed"}`}>
              {!game.active && (
                <div className="absolute top-3 right-3 z-20">
                  <Badge variant="outline" className="bg-black/80 backdrop-blur-md text-xs">Coming Soon</Badge>
                </div>
              )}
              {game.active && (
                <div className="absolute top-3 right-3 z-20">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                </div>
              )}
              <CardContent className="p-0 flex flex-col h-[280px]">
                <div className="h-2/5 bg-black/40 flex items-center justify-center p-6 relative overflow-hidden border-b border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
                  <span className="text-6xl relative z-20 select-none">{game.emoji}</span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center space-y-2">
                  <h3 className={`text-xl font-display font-bold transition-colors ${game.active ? game.titleClass : ""}`}>
                    {game.name}
                  </h3>
                  <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );

          if (game.active) {
            return (
              <Link key={game.id} href={game.href} className="block group">
                {content}
              </Link>
            );
          }

          return <div key={game.id} className="group">{content}</div>;
        })}
      </div>
    </div>
  );
}
