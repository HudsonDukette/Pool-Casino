import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

const features = [
  { emoji: "🏗️", title: "Create Your Casino", description: "Name it, brand it, set your table limits and house rules." },
  { emoji: "📊", title: "Manage Odds", description: "Tweak game odds and house edges to maximize your edge." },
  { emoji: "💰", title: "View Earnings", description: "Track revenue, player activity, and profit in real time." },
  { emoji: "🎨", title: "Custom Branding", description: "Upload a logo, pick a color theme, and style your casino." },
  { emoji: "📣", title: "Promotions", description: "Run deposit bonuses and events to attract more players." },
  { emoji: "🛡️", title: "Player Management", description: "Set VIP tiers, ban problem players, and manage disputes." },
];

export default function Casinos() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10 px-4">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-medium mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          In Development
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold">🏦 Player-Owned Casinos</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Create and manage your own casino, set odds, and compete with other players.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {features.map((f) => (
          <motion.div key={f.title} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
            <Card className="relative bg-card/30 border-white/5 overflow-hidden group cursor-not-allowed select-none">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col items-center gap-1">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Coming Soon</span>
                </div>
              </div>
              <CardContent className="p-5 space-y-3">
                <span className="text-3xl">{f.emoji}</span>
                <div>
                  <h3 className="font-display font-bold text-white/60">{f.title}</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">{f.description}</p>
                </div>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/70 font-medium">
                  Coming Soon
                </span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-center py-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
        <p className="text-muted-foreground text-sm">
          Player-owned casinos are being designed from the ground up.
        </p>
        <p className="text-muted-foreground/50 text-xs mt-1">This will change how PoolCasino works entirely.</p>
      </motion.div>
    </div>
  );
}
