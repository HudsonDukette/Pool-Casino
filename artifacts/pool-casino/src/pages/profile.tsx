import React, { useState } from "react";
import { useGetMe, useGetUserStats, useGetTransactions, useClaimDailyReward } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Trophy, Gift, ArrowDownToLine, ArrowUpRight, Coins, History, Calendar, Target, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Profile() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false } });
  const { data: stats, isLoading: statsLoading } = useGetUserStats({ query: { enabled: !!user } });
  const [page, setPage] = useState(0);
  const limit = 10;
  const { data: txData, isLoading: txLoading } = useGetTransactions({ offset: page * limit, limit }, { query: { enabled: !!user, keepPreviousData: true } });
  
  const claimMut = useClaimDailyReward();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!user && !userLoading) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Please log in to view your profile</h2>
        <Button onClick={() => window.location.href = '/login'}>Go to Login</Button>
      </div>
    );
  }

  const handleClaim = () => {
    claimMut.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: "Claimed!", description: data.message, className: "bg-success text-success-foreground border-none" });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      },
      onError: (err) => {
        toast({ title: "Claim Failed", description: err.error?.error || "Cannot claim right now", variant: "destructive" });
      }
    });
  };

  const statCards = [
    { label: "Total Profit", value: formatCurrency(stats?.totalProfit || 0), icon: <Trophy className="w-5 h-5 text-yellow-400" />, color: stats?.totalProfit && stats.totalProfit > 0 ? "text-success" : "text-white" },
    { label: "Biggest Win", value: formatCurrency(stats?.biggestWin || 0), icon: <ArrowUpRight className="w-5 h-5 text-primary" /> },
    { label: "Games Played", value: formatNumber(stats?.gamesPlayed || 0), icon: <Gamepad2Icon className="w-5 h-5 text-secondary" /> },
    { label: "Win Rate", value: stats?.gamesPlayed ? `${((stats.totalWins / stats.gamesPlayed) * 100).toFixed(1)}%` : "0%", icon: <Target className="w-5 h-5 text-accent" /> },
    { label: "Current Streak", value: `${stats?.currentStreak || 0} Wins`, icon: <Flame className="w-5 h-5 text-orange-500" /> },
    { label: "Biggest Bet", value: formatCurrency(stats?.biggestBet || 0), icon: <Coins className="w-5 h-5 text-blue-400" /> },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in">
      {/* Header Profile Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 bg-card border border-white/5 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_20px_rgba(0,255,170,0.3)] border-2 border-background">
            <span className="text-3xl font-display font-bold text-background">{user?.username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">{user?.username}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" /> 
              Joined {user ? format(new Date(user.createdAt), 'MMM yyyy') : '...'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 relative z-10 w-full md:w-auto">
          <div className="bg-black/50 px-6 py-3 rounded-2xl border border-white/5 flex flex-col items-end w-full md:w-auto">
            <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Available Balance</span>
            <span className="text-3xl font-mono font-bold text-primary neon-text-primary">
              {formatCurrency(user?.balance || 0)}
            </span>
          </div>
          <Button 
            variant="outline" 
            className="w-full md:w-auto bg-white/5 hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all"
            onClick={handleClaim}
            disabled={claimMut.isPending}
          >
            <Gift className="w-4 h-4 mr-2" /> Daily Reward
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-black/40 border-white/5">
            <CardContent className="p-6 flex flex-col justify-center items-center text-center space-y-2">
              <div className="p-3 bg-white/5 rounded-full mb-2">
                {stat.icon}
              </div>
              <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</h4>
              <p className={`text-xl md:text-2xl font-mono font-bold ${stat.color || "text-white"}`}>
                {statsLoading ? "-" : stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions */}
      <Card className="bg-black/40 border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="w-5 h-5" /> Recent History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-white/5 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Game</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Bet</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Result</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Payout</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : txData?.transactions && txData.transactions.length > 0 ? (
                  txData.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize bg-black/50">{tx.gameType}</Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {formatCurrency(tx.betAmount)}
                      </td>
                      <td className="px-6 py-4">
                        {tx.result === "win" ? (
                          <Badge variant="success" className="bg-success/20 text-success border-none">WIN {tx.multiplier ? `${tx.multiplier}x` : ''}</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/20 text-destructive border-none">LOSS</Badge>
                        )}
                      </td>
                      <td className={`px-6 py-4 font-mono text-right font-medium ${tx.payout > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {tx.payout > 0 ? '+' : ''}{formatCurrency(tx.payout)}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {format(new Date(tx.timestamp), 'MMM d, HH:mm')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {txData && txData.total > limit && (
             <div className="p-4 border-t border-white/5 flex items-center justify-between">
               <span className="text-sm text-muted-foreground">Showing {page * limit + 1} to Math.min((page + 1) * limit, txData.total) of {txData.total}</span>
               <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                 <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= txData.total}>Next</Button>
               </div>
             </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function Gamepad2Icon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" x2="10" y1="12" y2="12" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="15" x2="15.01" y1="13" y2="13" />
      <line x1="18" x2="18.01" y1="11" y2="11" />
      <rect width="20" height="12" x="2" y="6" rx="2" />
    </svg>
  )
}
