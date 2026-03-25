import React, { useState } from "react";
import { 
  useGetRichestPlayers, 
  useGetBiggestWinners, 
  useGetBiggestBettors 
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Trophy, TrendingUp, DollarSign, Crown, Medal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "richest" | "winners" | "bettors";

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<Tab>("richest");

  const { data: richest, isLoading: loadingRichest } = useGetRichestPlayers({ query: { enabled: activeTab === "richest" } });
  const { data: winners, isLoading: loadingWinners } = useGetBiggestWinners({ query: { enabled: activeTab === "winners" } });
  const { data: bettors, isLoading: loadingBettors } = useGetBiggestBettors({ query: { enabled: activeTab === "bettors" } });

  const getActiveData = () => {
    switch (activeTab) {
      case "richest": return { data: richest?.entries || [], loading: loadingRichest, icon: <Crown className="w-4 h-4 text-yellow-400" /> };
      case "winners": return { data: winners?.entries || [], loading: loadingWinners, icon: <TrendingUp className="w-4 h-4 text-success" /> };
      case "bettors": return { data: bettors?.entries || [], loading: loadingBettors, icon: <DollarSign className="w-4 h-4 text-primary" /> };
    }
  };

  const { data, loading, icon } = getActiveData();

  const tabs = [
    { id: "richest", label: "Richest Players", icon: <Crown className="w-4 h-4" /> },
    { id: "winners", label: "Biggest Winners", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "bettors", label: "High Rollers", icon: <DollarSign className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="text-center space-y-4 pt-8 pb-4">
        <div className="inline-flex items-center justify-center p-4 bg-accent/10 rounded-full mb-2">
          <Trophy className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold">Hall of Fame</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          The legends of PoolCasino. Do you have what it takes to climb the ranks?
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center p-1 bg-black/40 rounded-xl border border-white/10 max-w-md mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Board */}
      <Card className="bg-card/40 border-white/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 py-4 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            <div className="w-16">Rank</div>
            <div className="flex-1">Player</div>
            <div className="text-right">Amount</div>
          </div>
          
          <div className="min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="divide-y divide-white/5"
                >
                  {data.map((entry, idx) => (
                    <div key={entry.username} className={`flex items-center px-6 py-5 hover:bg-white/[0.02] transition-colors ${idx < 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}>
                      <div className="w-16 flex items-center">
                        {idx === 0 ? <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" /> :
                         idx === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                         idx === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                         <span className="font-mono text-muted-foreground font-bold text-lg w-6 text-center">{entry.rank}</span>}
                      </div>
                      
                      <div className="flex-1 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/10 text-white'
                        }`}>
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-bold text-lg ${idx < 3 ? 'text-white' : 'text-muted-foreground'}`}>
                          {entry.username}
                        </span>
                      </div>
                      
                      <div className="text-right flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-widest hidden sm:inline">{entry.label}</span>
                        <span className={`font-mono font-bold text-xl ${idx === 0 ? 'text-primary neon-text-primary' : 'text-white'}`}>
                          {formatCurrency(entry.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            ) : (
               <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                 <Trophy className="w-12 h-12 mb-4 opacity-20" />
                 <p>No data available yet.</p>
               </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
