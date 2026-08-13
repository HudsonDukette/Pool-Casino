import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { getPool } from "@/lib/pool.functions";

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
import highlowImg from "@/assets/game-highlow.png";
import doublediceImg from "@/assets/game-doubledice.png";
import ladderImg from "@/assets/game-ladder.png";
import warImg from "@/assets/game-war.png";
import targetImg from "@/assets/game-target.png";
import icebreakImg from "@/assets/game-icebreak.png";
import advwheelImg from "@/assets/game-advwheel.png";
import rangeImg from "@/assets/game-range.png";
import pyramidImg from "@/assets/game-pyramid.png";
import lightningImg from "@/assets/game-lightning.png";
import blinddrawImg from "@/assets/game-blinddraw.png";
import hiddenpathImg from "@/assets/game-hiddenpath.png";
import jackpothuntImg from "@/assets/game-jackpothunt.png";
import targethitImg from "@/assets/game-targethit.png";
import chainreactionImg from "@/assets/game-chainreaction.png";
import countdownImg from "@/assets/game-countdown.png";
import cardstackImg from "@/assets/game-cardstack.png";
import powergridImg from "@/assets/game-powergrid.png";
import combobuilderImg from "@/assets/game-combobuilder.png";
import safestepsImg from "@/assets/game-safesteps.png";
import predchainImg from "@/assets/game-predchain.png";
import powerbarImg from "@/assets/game-powerbar.png";

export const allGames = [
  { id: "roulette", name: "Neon Roulette", description: "Interactive spinning wheel with real physics. Bet on red, black, or green for big payouts!", image: rouletteImg, to: "/games/roulette", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(0,255,170,0.2)]", titleClass: "group-hover:text-primary", tag: "Interactive", tagColor: "bg-primary/20 text-primary" },
  { id: "slots", name: "Neon Slots", image: slotsImg, description: "Spin 3 reels. Match symbols for multipliers — or lose it all on a bust.", to: "/games/slots", accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Slots", tagColor: "bg-yellow-500/20 text-yellow-400" },
  { id: "blackjack", name: "Blackjack", image: blackjackImg, description: "Full interactive blackjack table with hit, stand, and double down. Beat the dealer to 21!", to: "/games/blackjack", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]", titleClass: "group-hover:text-accent", tag: "Interactive", tagColor: "bg-accent/20 text-accent" },
  { id: "crash", name: "Crash", image: crashImg, description: "Multiplier climbs until it crashes. Cash out before the boom — or lose everything.", to: "/games/crash", accentClass: "group-hover:border-destructive/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]", titleClass: "group-hover:text-destructive", tag: "Risk", tagColor: "bg-destructive/20 text-destructive" },
  { id: "plinko", name: "Plinko", image: plinkoImg, description: "Drop balls through a peg grid. High-risk sides hit 10×, center pays safe.", to: "/games/plinko", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(14,165,233,0.2)]", titleClass: "group-hover:text-success", tag: "Luck", tagColor: "bg-success/20 text-success" },
  { id: "dice", name: "Dice Roll", image: diceImg, description: "Bet over or under any number from 2–12. Higher risk means higher reward.", to: "/games/dice", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]", titleClass: "group-hover:text-primary", tag: "Skill", tagColor: "bg-primary/20 text-primary" },
  { id: "coinflip", name: "Coin Flip", image: coinflipImg, description: "Pure 50/50. But pool volatility shifts the payout above or below 2×.", to: "/games/coinflip", accentClass: "group-hover:border-secondary/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]", titleClass: "group-hover:text-secondary", tag: "Flip", tagColor: "bg-secondary/20 text-secondary" },
  { id: "wheel", name: "Fortune Wheel", image: wheelImg, description: "Spin 8 segments with different multipliers. High-risk slots pay up to 7×.", to: "/games/wheel", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-accent", tag: "Wheel", tagColor: "bg-accent/20 text-accent" },
  { id: "mines", name: "Mines", image: minesImg, description: "Uncover tiles on a 5×5 grid avoiding hidden mines. Each safe tile multiplies your bet.", to: "/games/mines", accentClass: "group-hover:border-destructive/50 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]", titleClass: "group-hover:text-destructive", tag: "Grid", tagColor: "bg-destructive/20 text-destructive" },
  { id: "highlow", name: "High-Low", image: highlowImg, description: "Guess if the next card is higher or lower. Each correct guess stacks the multiplier.", to: "/games/highlow", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]", titleClass: "group-hover:text-success", tag: "Card", tagColor: "bg-success/20 text-success" },
  { id: "doubledice", name: "Double Dice", image: doublediceImg, description: "Roll two dice and pick exact sum or range. Narrow bets pay up to 25×.", to: "/games/doubledice", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]", titleClass: "group-hover:text-primary", tag: "Dice", tagColor: "bg-primary/20 text-primary" },
  { id: "ladder", name: "Risk Ladder", image: ladderImg, description: "Climb the risk ladder for increasing multipliers. One wrong step ends the run.", to: "/games/ladder", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]", titleClass: "group-hover:text-accent", tag: "Levels", tagColor: "bg-accent/20 text-accent" },
  { id: "war", name: "War", image: warImg, description: "Your card vs dealer's card. Win at war to double your bet — ties trigger sudden death.", to: "/games/war", accentClass: "group-hover:border-destructive/50 group-hover:shadow-[0_0_30px_rgba(185,28,28,0.2)]", titleClass: "group-hover:text-destructive", tag: "Card", tagColor: "bg-destructive/20 text-destructive" },
  { id: "icebreak", name: "Ice Break", image: icebreakImg, description: "Tap ice blocks until one breaks the sheet. How far can you push your luck?", to: "/games/icebreak", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(96,165,250,0.2)]", titleClass: "group-hover:text-primary", tag: "Luck", tagColor: "bg-primary/20 text-primary" },
  { id: "lightning", name: "Lightning Round", image: lightningImg, description: "Multiple bet levels flash for 3 seconds each. Click exactly when your target lights up.", to: "/games/lightning", accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(250,204,21,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Speed", tagColor: "bg-yellow-400/20 text-yellow-400" },
  { id: "advwheel", name: "Advanced Wheel", image: advwheelImg, description: "Pick low, medium, or high risk. Different wheels have different payout curves.", to: "/games/advwheel", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-accent", tag: "Wheel", tagColor: "bg-accent/20 text-accent" },
  { id: "guess", name: "Number Guess", image: guessImg, description: "Pick a number 1–10. Tighter the range you bet, the bigger the payout if you're right.", to: "/games/guess", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]", titleClass: "group-hover:text-success", tag: "Pick", tagColor: "bg-success/20 text-success" },
  { id: "pyramid", name: "Pyramid", image: pyramidImg, description: "Build the pyramid level by level. Higher floors carry greater risk and greater reward.", to: "/games/pyramid", accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(217,119,6,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Levels", tagColor: "bg-yellow-400/20 text-yellow-400" },
  { id: "target", name: "Target Multiplier", image: targetImg, description: "Pick a multiplier target. Higher targets = longer odds, but massive payouts.", to: "/games/target", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(74,222,128,0.2)]", titleClass: "group-hover:text-success", tag: "Multiplier", tagColor: "bg-success/20 text-success" },
  { id: "range", name: "Range Bet", image: rangeImg, description: "Pick a tight range on a 1–100 scale. Narrow ranges pay higher. Wider ranges are safer.", to: "/games/range", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(56,189,248,0.2)]", titleClass: "group-hover:text-primary", tag: "Range", tagColor: "bg-primary/20 text-primary" },
  { id: "blinddraw", name: "Blind Draw", image: blinddrawImg, description: "Draw a face-down card — it's a mystery multiplier or a loss. Pure fate.", to: "/games/blinddraw", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]", titleClass: "group-hover:text-accent", tag: "Luck", tagColor: "bg-accent/20 text-accent" },
  { id: "hiddenpath", name: "Hidden Path", image: hiddenpathImg, description: "Pick a path through 3 hidden forks. All safe = 8× win. One wrong turn = bust.", to: "/games/hiddenpath", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]", titleClass: "group-hover:text-success", tag: "Risk", tagColor: "bg-success/20 text-success" },
  { id: "jackpothunt", name: "Jackpot Hunt", image: jackpothuntImg, description: "Open 1 of 5 boxes. One hides a 10× jackpot. Others give small wins or losses.", to: "/games/jackpothunt", accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Jackpot", tagColor: "bg-yellow-400/20 text-yellow-400" },
  { id: "targethit", name: "Target Hit", image: targethitImg, description: "Click the moving target. A perfect hit pays up to 5×. Narrow window, big reward.", to: "/games/targethit", accentClass: "group-hover:border-destructive/50 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]", titleClass: "group-hover:text-destructive", tag: "Skill", tagColor: "bg-destructive/20 text-destructive" },
  { id: "chainreaction", name: "Chain Reaction", image: chainreactionImg, description: "Each win chains a bigger multiplier. One loss wipes your chain. Cash out anytime.", to: "/games/chainreaction", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]", titleClass: "group-hover:text-accent", tag: "Chain", tagColor: "bg-accent/20 text-accent" },
  { id: "countdown", name: "Countdown Gamble", image: countdownImg, description: "Multiplier grows as the timer ticks down. Cash out before it hits zero or lose it all.", to: "/games/countdown", accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Race", tagColor: "bg-yellow-400/20 text-yellow-400" },
  { id: "powerbar", name: "Power Bar", image: powerbarImg, description: "A charging bar oscillates back and forth. Stop it in the perfect zone for a massive 5× payout!", to: "/games/powerbar", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]", titleClass: "group-hover:text-accent", tag: "Timing", tagColor: "bg-accent/20 text-accent" },
  { id: "cardstack", name: "Card Stack", image: cardstackImg, description: "Draw cards to build your stack without going over 21. Push your luck, one card at a time.", to: "/games/cardstack", accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]", titleClass: "group-hover:text-primary", tag: "Card", tagColor: "bg-primary/20 text-primary" },
  { id: "powergrid", name: "Power Grid", image: powergridImg, description: "A 4×4 grid of multipliers — pick tiles strategically. Hit a trap and lose everything.", to: "/games/powergrid", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]", titleClass: "group-hover:text-success", tag: "Grid", tagColor: "bg-success/20 text-success" },
  { id: "combobuilder", name: "Combo Builder", image: combobuilderImg, description: "Win streaks stack your combo multiplier. One loss resets it to zero. How high can you go?", to: "/games/combobuilder", accentClass: "group-hover:border-destructive/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]", titleClass: "group-hover:text-destructive", tag: "Streak", tagColor: "bg-destructive/20 text-destructive" },
  { id: "safesteps", name: "Safe Steps", image: safestepsImg, description: "Step forward for higher rewards. Each step raises the fail chance. Cash out or climb.", to: "/games/safesteps", accentClass: "group-hover:border-success/50 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]", titleClass: "group-hover:text-success", tag: "Levels", tagColor: "bg-success/20 text-success" },
  { id: "predchain", name: "Prediction Chain", image: predchainImg, description: "Predict 3 coin flips in a row. Each correct adds to your chain. Get all 3 for 6.5× payout.", to: "/games/predchain", accentClass: "group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-accent", tag: "Predict", tagColor: "bg-accent/20 text-accent" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200, damping: 20 } },
};

export const Route = createFileRoute("/games/")({
  head: () => ({
    meta: [
      { title: "Games — PoolCasino" },
      { name: "description", content: "Browse 32 solo casino games and bet against the global pool." },
      { property: "og:title", content: "Games — PoolCasino" },
      { property: "og:description", content: "Browse 32 solo casino games and bet against the shared PoolCasino bankroll." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamesIndex,
});

function GameCard({ game, disabledGames }: { game: typeof allGames[0]; disabledGames: string[] }) {
  const isDisabled = disabledGames.includes(game.id);

  const thumbnail = (
    <div className="h-[160px] relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
      {isDisabled ? (
        <img src={game.image} alt={game.name} className="w-full h-full object-cover grayscale" />
      ) : (
        <motion.img src={game.image} alt={game.name} className="w-full h-full object-cover"
          whileHover={{ scale: 1.06 }} transition={{ duration: 0.5, ease: "easeOut" }} />
      )}
    </div>
  );

  if (isDisabled) {
    return (
      <motion.div variants={item}>
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
    <motion.div variants={item}>
      <Link to={game.to} className="block group h-full">
        <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/10 relative cursor-pointer ${game.accentClass}`}>
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
}

function GamesIndex() {
  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => getPool(),
    refetchInterval: 5000,
  });
  const disabledGames = pool?.disabledGames ?? [];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12"
    >
      {allGames.map((game) => (
        <GameCard key={game.id} game={game} disabledGames={disabledGames} />
      ))}
    </motion.div>
  );
}