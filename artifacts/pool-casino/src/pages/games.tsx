import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useGetPool } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import rouletteImg from "@/assets/game-roulette.png";
import plinkoImg from "@/assets/game-plinko.png";
import blackjackImg from "@/assets/game-blackjack.png";
import crashImg from "@/assets/game-crash.png";
import slotsImg from "@/assets/game-slots.png";
import diceImg from "@/assets/game-dice.png";
import coinflipImg from "@/assets/game-coinflip.png";
import wheelImg from "@/assets/game-wheel.png";
import guessImg from "@/assets/game-guess.png";
import minesImg from "@/assets/game-mines.png";

const games = [
  {
    id: "roulette",
    name: "Neon Roulette",
    description: "Classic red or black with dynamic odds based on the global pool.",
    image: rouletteImg,
    href: "/games/roulette",
    accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(0,255,170,0.2)]",
    titleClass: "group-hover:text-primary",
    tag: "Classic",
    tagColor: "bg-primary/20 text-primary",
  },
  {
    id: "plinko",
    name: "Drop Plinko",
    description: "Drop the ball through the pegs. Control your risk for massive multipliers.",
    image: plinkoImg,
    href: "/games/plinko",
    accentClass: "group-hover:border-secondary/50 group-hover:shadow-[0_0_30px_rgba(255,0,255,0.2)]",
    titleClass: "group-hover:text-secondary",
    tag: "Physics",
    tagColor: "bg-secondary/20 text-secondary",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    description: "Race to 21 against the dealer. Hit or Stand. Blackjack pays 2.5×.",
    image: blackjackImg,
    href: "/games/blackjack",
    accentClass: "group-hover:border-green-500/50 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]",
    titleClass: "group-hover:text-green-400",
    tag: "Strategy",
    tagColor: "bg-green-500/20 text-green-400",
  },
  {
    id: "crash",
    name: "Crash",
    description: "Watch the multiplier climb and cash out before it crashes. Set your target and launch.",
    image: crashImg,
    href: "/games/crash",
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    titleClass: "group-hover:text-red-400",
    tag: "Thrill",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "slots",
    name: "Neon Slots",
    description: "Match all 3 reels to win. Sevens pay 20×, diamonds pay 10×, and more!",
    image: slotsImg,
    href: "/games/slots",
    accentClass: "group-hover:border-pink-500/50 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]",
    titleClass: "group-hover:text-pink-400",
    tag: "Luck",
    tagColor: "bg-pink-500/20 text-pink-400",
  },
  {
    id: "dice",
    name: "Dice Roll",
    description: "Guess exact (5×) or pick high/low (1.9×). Simple, fast, addictive.",
    image: diceImg,
    href: "/games/dice",
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Quick",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "coinflip",
    name: "Coin Flip",
    description: "The simplest bet. Pick heads or tails and double your money. 1.95× on win.",
    image: coinflipImg,
    href: "/games/coinflip",
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    titleClass: "group-hover:text-amber-400",
    tag: "50/50",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "wheel",
    name: "Fortune Wheel",
    description: "Spin the wheel and land on multipliers from 0.2× to 10×. Rarer segments = bigger rewards.",
    image: wheelImg,
    href: "/games/wheel",
    accentClass: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]",
    titleClass: "group-hover:text-purple-400",
    tag: "Spin",
    tagColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "guess",
    name: "Number Guess",
    description: "Guess 1–100. Exact match pays 50×! Within 1 pays 10×. The closer, the bigger.",
    image: guessImg,
    href: "/games/guess",
    accentClass: "group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
    titleClass: "group-hover:text-cyan-400",
    tag: "Precision",
    tagColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "mines",
    name: "Mines",
    description: "Choose your mines, reveal safe tiles one by one, and cash out before you explode.",
    image: minesImg,
    href: "/games/mines",
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Risk",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
  // ── New Games ──
  {
    id: "highlow",
    name: "High-Low",
    description: "Draw a card, then guess if the next is higher or lower. Correct pays 1.85×. Ties push.",
    emoji: "🃏",
    emojiGradient: "from-yellow-900/60 to-yellow-700/20",
    href: "/games/highlow",
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Card",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "doubledice",
    name: "Double Dice",
    description: "Roll two dice. Bet even/odd (1.9×) or nail the exact sum for up to 18× payout.",
    emoji: "🎲",
    emojiGradient: "from-orange-900/60 to-orange-700/20",
    href: "/games/doubledice",
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Dice",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "ladder",
    name: "Risk Ladder",
    description: "Climb 10 rungs with escalating multipliers up to 30×. Cash out anytime — or risk it all.",
    emoji: "🪜",
    emojiGradient: "from-lime-900/60 to-lime-700/20",
    href: "/games/ladder",
    accentClass: "group-hover:border-lime-500/50 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]",
    titleClass: "group-hover:text-lime-400",
    tag: "Stateful",
    tagColor: "bg-lime-500/20 text-lime-400",
  },
  {
    id: "war",
    name: "War",
    description: "Draw a card against the dealer. Higher card wins 2×. Tie returns your bet.",
    emoji: "⚔️",
    emojiGradient: "from-red-900/60 to-red-700/20",
    href: "/games/war",
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    titleClass: "group-hover:text-red-400",
    tag: "Card",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "target",
    name: "Target Multiplier",
    description: "Pick your target (1.5× to 50×). Higher targets are harder to hit — but reward more.",
    emoji: "🎯",
    emojiGradient: "from-blue-900/60 to-blue-700/20",
    href: "/games/target",
    accentClass: "group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    titleClass: "group-hover:text-blue-400",
    tag: "Pick",
    tagColor: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "icebreak",
    name: "Ice Break",
    description: "16 tiles hide 4 danger spots. Flip tiles — miss all dangers to win up to 10×.",
    emoji: "❄️",
    emojiGradient: "from-cyan-900/60 to-cyan-700/20",
    href: "/games/icebreak",
    accentClass: "group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
    titleClass: "group-hover:text-cyan-400",
    tag: "Grid",
    tagColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "advwheel",
    name: "Advanced Wheel",
    description: "9-segment wheel with payouts up to 50×. Bigger jackpots than Fortune Wheel.",
    emoji: "🎡",
    emojiGradient: "from-purple-900/60 to-purple-700/20",
    href: "/games/advwheel",
    accentClass: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]",
    titleClass: "group-hover:text-purple-400",
    tag: "Jackpot",
    tagColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "range",
    name: "Range Bet",
    description: "A number 1–100 is drawn. Pick your range: narrow (4.75×) or wide (1.9×).",
    emoji: "📊",
    emojiGradient: "from-teal-900/60 to-teal-700/20",
    href: "/games/range",
    accentClass: "group-hover:border-teal-500/50 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]",
    titleClass: "group-hover:text-teal-400",
    tag: "Range",
    tagColor: "bg-teal-500/20 text-teal-400",
  },
  {
    id: "pyramid",
    name: "Pyramid Pick",
    description: "Climb pyramid levels (50/50 each). Survive 5 levels to win 23×.",
    emoji: "🔺",
    emojiGradient: "from-amber-900/60 to-amber-700/20",
    href: "/games/pyramid",
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    titleClass: "group-hover:text-amber-400",
    tag: "Levels",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "lightning",
    name: "Lightning Round",
    description: "3, 5, or 10 rapid 50/50 flips at 1.9× each. Win as many rounds as you can.",
    emoji: "⚡",
    emojiGradient: "from-yellow-900/60 to-yellow-600/20",
    href: "/games/lightning",
    accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.3)]",
    titleClass: "group-hover:text-yellow-300",
    tag: "Rapid",
    tagColor: "bg-yellow-400/20 text-yellow-300",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function Games() {
  const { data: pool } = useGetPool({ query: { refetchInterval: 5000 } });
  const disabledGames = pool?.disabledGames ?? [];
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4 pt-8 pb-4"
      >
        <h1 className="text-4xl md:text-5xl font-display font-bold">Casino Games</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          20 games. One global pool. Every bet matters.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {games.map((game) => {
          const g = game as any;
          const hasImage = !!g.image;
          const isDisabled = disabledGames.includes(game.id);

          const thumbnail = hasImage ? (
            <div className="h-[160px] relative overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
              {isDisabled ? (
                <img src={g.image} alt={game.name} className="w-full h-full object-cover grayscale" />
              ) : (
                <motion.img src={g.image} alt={game.name} className="w-full h-full object-cover"
                  whileHover={{ scale: 1.06 }} transition={{ duration: 0.5, ease: "easeOut" }} />
              )}
            </div>
          ) : (
            <div className={`h-[160px] relative overflow-hidden border-b border-white/5 bg-gradient-to-br ${g.emojiGradient ?? "from-white/5 to-transparent"} flex items-center justify-center`}>
              <span className="text-7xl select-none">{g.emoji}</span>
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
            </div>
          );

          if (isDisabled) {
            return (
              <motion.div key={game.id} variants={item}>
                <Card className="h-full overflow-hidden bg-card/20 border-white/5 relative opacity-50 cursor-not-allowed select-none">
                  <div className="absolute top-3 right-3 z-20">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                  </div>
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                    <div className="text-center space-y-1">
                      <p className="text-2xl">🔧</p>
                      <p className="text-xs font-medium text-yellow-400">Temporarily Unavailable</p>
                    </div>
                  </div>
                  <CardContent className="p-0 flex flex-col h-[280px]">
                    {thumbnail}
                    <div className="p-5 flex-1 flex flex-col justify-center space-y-1.5">
                      <h3 className="text-xl font-display font-bold text-white/40">{game.name}</h3>
                      <p className="text-muted-foreground/50 text-xs line-clamp-2 leading-relaxed">{game.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          }

          return (
            <motion.div key={game.id} variants={item}>
              <Link href={game.href} className="block group h-full">
                <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/5 relative cursor-pointer ${game.accentClass}`}>
                  <div className="absolute top-3 right-3 z-20">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                  </div>
                  <CardContent className="p-0 flex flex-col h-[280px]">
                    {thumbnail}
                    <div className="p-5 flex-1 flex flex-col justify-center space-y-1.5">
                      <h3 className={`text-xl font-display font-bold transition-colors duration-300 ${game.titleClass}`}>
                        {game.name}
                      </h3>
                      <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                        {game.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
