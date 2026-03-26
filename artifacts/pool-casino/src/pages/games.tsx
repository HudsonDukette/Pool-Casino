import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
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
    glowColor: "rgba(0,255,170,0.15)",
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
    glowColor: "rgba(255,0,255,0.15)",
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
    glowColor: "rgba(34,197,94,0.15)",
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
    glowColor: "rgba(239,68,68,0.15)",
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
    glowColor: "rgba(236,72,153,0.15)",
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
    glowColor: "rgba(234,179,8,0.15)",
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
    glowColor: "rgba(245,158,11,0.15)",
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
    glowColor: "rgba(139,92,246,0.15)",
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
    glowColor: "rgba(6,182,212,0.15)",
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
    glowColor: "rgba(249,115,22,0.15)",
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
          10 games. One global pool. Every bet matters.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {games.map((game) => (
          <motion.div key={game.id} variants={item}>
            {game.disabled ? (
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
                <CardContent className="p-0 flex flex-col h-[300px]">
                  <div className="h-[175px] relative overflow-hidden border-b border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
                    <img src={game.image} alt={game.name} className="w-full h-full object-cover grayscale" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-center space-y-1.5">
                    <h3 className="text-xl font-display font-bold text-white/40">{game.name}</h3>
                    <p className="text-muted-foreground/50 text-xs line-clamp-2 leading-relaxed">{game.description}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Link href={game.href} className="block group h-full">
                <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/5 relative cursor-pointer ${game.accentClass}`}>
                  <div className="absolute top-3 right-3 z-20">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                  </div>
                  <CardContent className="p-0 flex flex-col h-[300px]">
                    <div className="h-[175px] relative overflow-hidden border-b border-white/5">
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
                      <motion.img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.06 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
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
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
