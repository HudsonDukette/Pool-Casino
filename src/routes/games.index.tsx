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
  { id: "roulette", name: "Neon Roulette", description: "Interactive spinning wheel with real physics. Bet on red, black, or green for big payouts!", image: rouletteImg, to: "/games/roulette", accentClass: "group-hover:border-pink-200 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]", titleClass: "group-hover:text-pink-500", tag: "Interactive", tagColor: "bg-pink-100 text-pink-600" },
  { id: "slots", name: "Neon Slots", image: slotsImg, description: "Spin 3 reels. Match symbols for multipliers — or lose it all on a bust.", to: "/games/slots", accentClass: "group-hover:border-yellow-200 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]", titleClass: "group-hover:text-yellow-500", tag: "Slots", tagColor: "bg-yellow-100 text-yellow-600" },
  { id: "blackjack", name: "Blackjack", image: blackjackImg, description: "Full interactive blackjack table with hit, stand, and double down. Beat the dealer to 21!", to: "/games/blackjack", accentClass: "group-hover:border-purple-200 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]", titleClass: "group-hover:text-purple-500", tag: "Interactive", tagColor: "bg-purple-100 text-purple-600" },
  { id: "crash", name: "Crash", image: crashImg, description: "Multiplier climbs until it crashes. Cash out before the boom — or lose everything.", to: "/games/crash", accentClass: "group-hover:border-red-200 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]", titleClass: "group-hover:text-red-400", tag: "Risk", tagColor: "bg-red-100 text-red-500" },
  { id: "plinko", name: "Plinko", image: plinkoImg, description: "Drop balls through a peg grid. High-risk sides hit 10×, center pays safe.", to: "/games/plinko", accentClass: "group-hover:border-sky-200 group-hover:shadow-[0_0_30px_rgba(14,165,233,0.2)]", titleClass: "group-hover:text-sky-400", tag: "Luck", tagColor: "bg-sky-100 text-sky-500" },
  { id: "dice", name: "Dice Roll", image: diceImg, description: "Bet over or under any number from 2–12. Higher risk means higher reward.", to: "/games/dice", accentClass: "group-hover:border-emerald-200 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]", titleClass: "group-hover:text-emerald-400", tag: "Skill", tagColor: "bg-emerald-100 text-emerald-600" },
  { id: "coinflip", name: "Coin Flip", image: coinflipImg, description: "Pure 50/50. But pool volatility shifts the payout above or below 2×.", to: "/games/coinflip", accentClass: "group-hover:border-amber-200 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]", titleClass: "group-hover:text-amber-400", tag: "Flip", tagColor: "bg-amber-100 text-amber-500" },
  { id: "wheel", name: "Fortune Wheel", image: wheelImg, description: "Spin 8 segments with different multipliers. High-risk slots pay up to 7×.", to: "/games/wheel", accentClass: "group-hover:border-fuchsia-200 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-fuchsia-400", tag: "Wheel", tagColor: "bg-fuchsia-100 text-fuchsia-500" },
  { id: "mines", name: "Mines", image: minesImg, description: "Uncover tiles on a 5×5 grid avoiding hidden mines. Each safe tile multiplies your bet.", to: "/games/mines", accentClass: "group-hover:border-rose-200 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]", titleClass: "group-hover:text-rose-400", tag: "Grid", tagColor: "bg-rose-100 text-rose-500" },
  { id: "highlow", name: "High-Low", image: highlowImg, description: "Guess if the next card is higher or lower. Each correct guess stacks the multiplier.", to: "/games/highlow", accentClass: "group-hover:border-cyan-200 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]", titleClass: "group-hover:text-cyan-400", tag: "Card", tagColor: "bg-cyan-100 text-cyan-500" },
  { id: "doubledice", name: "Double Dice", image: doublediceImg, description: "Roll two dice and pick exact sum or range. Narrow bets pay up to 25×.", to: "/games/doubledice", accentClass: "group-hover:border-lime-200 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]", titleClass: "group-hover:text-lime-400", tag: "Dice", tagColor: "bg-lime-100 text-lime-500" },
  { id: "ladder", name: "Risk Ladder", image: ladderImg, description: "Climb the risk ladder for increasing multipliers. One wrong step ends the run.", to: "/games/ladder", accentClass: "group-hover:border-orange-200 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]", titleClass: "group-hover:text-orange-400", tag: "Levels", tagColor: "bg-orange-100 text-orange-500" },
  { id: "war", name: "War", image: warImg, description: "Your card vs dealer's card. Win at war to double your bet — ties trigger sudden death.", to: "/games/war", accentClass: "group-hover:border-red-300 group-hover:shadow-[0_0_30px_rgba(185,28,28,0.2)]", titleClass: "group-hover:text-red-300", tag: "Card", tagColor: "bg-red-100 text-red-400" },
  { id: "icebreak", name: "Ice Break", image: icebreakImg, description: "Tap ice blocks until one breaks the sheet. How far can you push your luck?", to: "/games/icebreak", accentClass: "group-hover:border-blue-200 group-hover:shadow-[0_0_30px_rgba(96,165,250,0.2)]", titleClass: "group-hover:text-blue-400", tag: "Luck", tagColor: "bg-blue-100 text-blue-400" },
  { id: "lightning", name: "Lightning Round", image: lightningImg, description: "Multiple bet levels flash for 3 seconds each. Click exactly when your target lights up.", to: "/games/lightning", accentClass: "group-hover:border-yellow-200 group-hover:shadow-[0_0_30px_rgba(250,204,21,0.2)]", titleClass: "group-hover:text-yellow-300", tag: "Speed", tagColor: "bg-yellow-100 text-yellow-400" },
  { id: "advwheel", name: "Advanced Wheel", image: advwheelImg, description: "Pick low, medium, or high risk. Different wheels have different payout curves.", to: "/games/advwheel", accentClass: "group-hover:border-fuchsia-200 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-fuchsia-400", tag: "Wheel", tagColor: "bg-fuchsia-100 text-fuchsia-400" },
  { id: "guess", name: "Number Guess", image: guessImg, description: "Pick a number 1–10. Tighter the range you bet, the bigger the payout if you're right.", to: "/games/guess", accentClass: "group-hover:border-teal-200 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]", titleClass: "group-hover:text-teal-400", tag: "Pick", tagColor: "bg-teal-100 text-teal-500" },
  { id: "pyramid", name: "Pyramid", image: pyramidImg, description: "Build the pyramid level by level. Higher floors carry greater risk and greater reward.", to: "/games/pyramid", accentClass: "group-hover:border-amber-300 group-hover:shadow-[0_0_30px_rgba(217,119,6,0.2)]", titleClass: "group-hover:text-amber-500", tag: "Levels", tagColor: "bg-amber-100 text-amber-500" },
  { id: "target", name: "Target Multiplier", image: targetImg, description: "Pick a multiplier target. Higher targets = longer odds, but massive payouts.", to: "/games/target", accentClass: "group-hover:border-green-200 group-hover:shadow-[0_0_30px_rgba(74,222,128,0.2)]", titleClass: "group-hover:text-green-400", tag: "Multiplier", tagColor: "bg-green-100 text-green-400" },
  { id: "range", name: "Range Bet", image: rangeImg, description: "Pick a tight range on a 1–100 scale. Narrow ranges pay higher. Wider ranges are safer.", to: "/games/range", accentClass: "group-hover:border-sky-200 group-hover:shadow-[0_0_30px_rgba(56,189,248,0.2)]", titleClass: "group-hover:text-sky-300", tag: "Range", tagColor: "bg-sky-100 text-sky-300" },
  { id: "blinddraw", name: "Blind Draw", image: blinddrawImg, description: "Draw a face-down card — it's a mystery multiplier or a loss. Pure fate.", to: "/games/blinddraw", accentClass: "group-hover:border-indigo-200 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]", titleClass: "group-hover:text-indigo-400", tag: "Luck", tagColor: "bg-indigo-100 text-indigo-400" },
  { id: "hiddenpath", name: "Hidden Path", image: hiddenpathImg, description: "Pick a path through 3 hidden forks. All safe = 8× win. One wrong turn = bust.", to: "/games/hiddenpath", accentClass: "group-hover:border-emerald-200 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]", titleClass: "group-hover:text-emerald-400", tag: "Risk", tagColor: "bg-emerald-100 text-emerald-400" },
  { id: "jackpothunt", name: "Jackpot Hunt", image: jackpothuntImg, description: "Open 1 of 5 boxes. One hides a 10× jackpot. Others give small wins or losses.", to: "/games/jackpothunt", accentClass: "group-hover:border-amber-200 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]", titleClass: "group-hover:text-amber-400", tag: "Jackpot", tagColor: "bg-amber-100 text-amber-400" },
  { id: "targethit", name: "Target Hit", image: targethitImg, description: "Click the moving target. A perfect hit pays up to 5×. Narrow window, big reward.", to: "/games/targethit", accentClass: "group-hover:border-rose-200 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]", titleClass: "group-hover:text-rose-400", tag: "Skill", tagColor: "bg-rose-100 text-rose-400" },
  { id: "chainreaction", name: "Chain Reaction", image: chainreactionImg, description: "Each win chains a bigger multiplier. One loss wipes your chain. Cash out anytime.", to: "/games/chainreaction", accentClass: "group-hover:border-orange-200 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]", titleClass: "group-hover:text-orange-400", tag: "Chain", tagColor: "bg-orange-100 text-orange-400" },
  { id: "countdown", name: "Countdown Gamble", image: countdownImg, description: "Multiplier grows as the timer ticks down. Cash out before it hits zero or lose it all.", to: "/games/countdown", accentClass: "group-hover:border-yellow-200 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]", titleClass: "group-hover:text-yellow-400", tag: "Race", tagColor: "bg-yellow-100 text-yellow-400" },
  { id: "powerbar", name: "Power Bar", image: powerbarImg, description: "A charging bar oscillates back and forth. Stop it in the perfect zone for a massive 5× payout!", to: "/games/powerbar", accentClass: "group-hover:border-purple-200 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]", titleClass: "group-hover:text-purple-400", tag: "Timing", tagColor: "bg-purple-100 text-purple-400" },
  { id: "cardstack", name: "Card Stack", image: cardstackImg, description: "Draw cards to build your stack without going over 21. Push your luck, one card at a time.", to: "/games/cardstack", accentClass: "group-hover:border-blue-200 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]", titleClass: "group-hover:text-blue-400", tag: "Card", tagColor: "bg-blue-100 text-blue-400" },
  { id: "powergrid", name: "Power Grid", image: powergridImg, description: "A 4×4 grid of multipliers — pick tiles strategically. Hit a trap and lose everything.", to: "/games/powergrid", accentClass: "group-hover:border-lime-200 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]", titleClass: "group-hover:text-lime-400", tag: "Grid", tagColor: "bg-lime-100 text-lime-400" },
  { id: "combobuilder", name: "Combo Builder", image: combobuilderImg, description: "Win streaks stack your combo multiplier. One loss resets it to zero. How high can you go?", to: "/games/combobuilder", accentClass: "group-hover:border-red-200 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]", titleClass: "group-hover:text-red-400", tag: "Streak", tagColor: "bg-red-100 text-red-400" },
  { id: "safesteps", name: "Safe Steps", image: safestepsImg, description: "Step forward for higher rewards. Each step raises the fail chance. Cash out or climb.", to: "/games/safesteps", accentClass: "group-hover:border-teal-200 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]", titleClass: "group-hover:text-teal-400", tag: "Levels", tagColor: "bg-teal-100 text-teal-400" },
  { id: "predchain", name: "Prediction Chain", image: predchainImg, description: "Predict 3 coin flips in a row. Each correct adds to your chain. Get all 3 for 6.5× payout.", to: "/games/predchain", accentClass: "group-hover:border-fuchsia-200 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]", titleClass: "group-hover:text-fuchsia-400", tag: "Predict", tagColor: "bg-fuchsia-100 text-fuchsia-400" },
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
    <div className="h-[180px] relative overflow-hidden rounded-t-3xl">
      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent z-10" />
      {isDisabled ? (
        <img src={game.image} alt={game.name} className="w-full h-full object-cover grayscale" />
      ) : (
        <motion.img src={game.image} alt={game.name} className="w-full h-full object-cover"
          whileHover={{ scale: 1.08 }} transition={{ duration: 0.5, ease: "easeOut" }} />
      )}
    </div>
  );

  if (isDisabled) {
    return (
      <motion.div variants={item}>
        <Card className="h-full overflow-hidden bg-white/30 border-pink-100 relative opacity-50 cursor-not-allowed select-none rounded-3xl shadow-sm">
          <div className="absolute top-3 right-3 z-20">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <div className="text-center space-y-2">
              <p className="text-3xl">🔧</p>
              <p className="text-sm font-medium text-purple-500">Temporarily Unavailable</p>
            </div>
          </div>
          <CardContent className="p-0 flex flex-col h-[320px]">
            {thumbnail}
            <div className="p-6 flex-1 flex flex-col justify-center space-y-2">
              <h3 className="text-2xl font-display font-bold text-gray-400">{game.name}</h3>
              <p className="text-gray-400/60 text-sm line-clamp-2 leading-relaxed">{game.description}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={item}>
      <Link to={game.to} className="block group h-full">
        <Card className={`h-full overflow-hidden transition-all duration-500 bg-white border-pink-100 hover:border-purple-200 hover:shadow-xl relative cursor-pointer rounded-3xl ${game.accentClass}`}>
          <div className="absolute top-3 right-3 z-20">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
          </div>
          <CardContent className="p-0 flex flex-col h-[320px]">
            {thumbnail}
            <div className="p-6 flex-1 flex flex-col justify-center space-y-2">
              <h3 className={`text-2xl font-display font-bold transition-colors duration-300 ${game.titleClass}`}>
                {game.name}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
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