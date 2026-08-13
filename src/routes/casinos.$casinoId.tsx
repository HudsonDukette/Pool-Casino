import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Crown, Coins, Users, Settings, TrendingUp, 
  Gamepad2, LogOut, ShieldAlert, Sparkles, Heart, Star,
  Plus, Minus, History, BarChart3, Target, Zap
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPlayerCasinoDetails,
  placeCasinoBet,
  updateCasinoSettings,
  fundCasinoBankroll,
  withdrawCasinoProfits,
  leavePlayerCasino,
} from "@/lib/casino.functions";

const AVAILABLE_GAMES = [
  { id: "coinflip", name: "Coin Flip", icon: "🪙", options: ["heads", "tails"] },
  { id: "dice", name: "Dice Roll", icon: "🎲", options: ["low", "high"] },
  { id: "wheel", name: "Fortune Wheel", icon: "🎡", options: ["red", "black", "green"] },
  { id: "crash", name: "Crash", icon: "📈", options: ["cashout"] },
  { id: "plinko", name: "Plinko", icon: "🔻", options: ["low", "medium", "high"] },
];

export const Route = createFileRoute("/casinos/$casinoId")({
  head: () => ({
    meta: [
      { title: "Casino Details — PoolCasino" },
      { name: "description", content: "View and play at player casinos." },
      { property: "og:title", content: "Casino Details — PoolCasino" },
      { property: "og:description", content: "View and play at player casinos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasinoDetails,
});

function CasinoDetails() {
  const { casinoId } = Route.useParams();
  const { user, isAuthenticated } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"play" | "stats" | "settings">("play");
  const [showBetModal, setShowBetModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Betting state
  const [betGameId, setBetGameId] = useState("coinflip");
  const [betOption, setBetOption] = useState("heads");
  const [betAmount, setBetAmount] = useState("10");

  // Settings state
  const [houseEdge, setHouseEdge] = useState(5);
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(1000);

  // Fund/Withdraw state
  const [fundAmount, setFundAmount] = useState("1000");
  const [withdrawAmount, setWithdrawAmount] = useState("1000");

  const getCasinoDetailsFn = useServerFn(getPlayerCasinoDetails);
  const placeBetFn = useServerFn(placeCasinoBet);
  const updateSettingsFn = useServerFn(updateCasinoSettings);
  const fundBankrollFn = useServerFn(fundCasinoBankroll);
  const withdrawProfitsFn = useServerFn(withdrawCasinoProfits);
  const leaveCasinoFn = useServerFn(leavePlayerCasino);

  const { data: casino, refetch: refetchCasino } = useQuery({
    queryKey: ["casino-details", casinoId],
    queryFn: () => getCasinoDetailsFn({ data: { casinoId } }),
    refetchInterval: 5000,
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`casino-${casinoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_casinos", filter: `id=eq.${casinoId}` }, () => refetchCasino())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "casino_bets", filter: `casino_id=eq.${casinoId}` }, () => refetchCasino())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [casinoId, refetchCasino]);

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-display font-bold text-gray-800 mb-4">Please Log In</h1>
          <Button onClick={() => navigate({ to: "/login" })}>Log In</Button>
        </div>
      </Layout>
    );
  }

  if (!casino) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-display font-bold text-gray-800 mb-4">Casino Not Found</h1>
          <Button onClick={() => navigate({ to: "/casinos" })}>Back to Casinos</Button>
        </div>
      </Layout>
    );
  }

  const isOwner = casino.owner_id === user?.id;
  const availableProfits = casino.bankroll - casino.initial_bankroll;

  const handlePlaceBet = async () => {
    try {
      const result = await placeBetFn({
        data: {
          casinoId,
          gameId: betGameId,
          option: betOption,
          betAmount: Number(betAmount),
        },
      });
      setShowBetModal(false);
      refetchCasino();
      toast({
        title: result.won ? "You won! 🎉" : "Better luck next time!",
        description: result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(Number(betAmount))}`,
        variant: result.won ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Bet failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateSettingsFn({
        data: {
          casinoId,
          settings: {
            houseEdge,
            minBet,
            maxBet,
          },
        },
      });
      refetchCasino();
      toast({ title: "Settings updated successfully! ✨" });
    } catch (error) {
      toast({
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleFundBankroll = async () => {
    try {
      await fundBankrollFn({
        data: {
          casinoId,
          amount: Number(fundAmount),
        },
      });
      setShowFundModal(false);
      refetchCasino();
      toast({ title: "Bankroll funded successfully! 💰" });
    } catch (error) {
      toast({
        title: "Failed to fund bankroll",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleWithdrawProfits = async () => {
    try {
      await withdrawProfitsFn({
        data: {
          casinoId,
          amount: Number(withdrawAmount),
        },
      });
      setShowWithdrawModal(false);
      refetchCasino();
      toast({ title: "Profits withdrawn successfully! 🎉" });
    } catch (error) {
      toast({
        title: "Failed to withdraw profits",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleLeaveCasino = async () => {
    if (!window.confirm("Are you sure you want to leave this casino?")) return;
    
    try {
      await leaveCasinoFn({ data: { casinoId } });
      navigate({ to: "/casinos" });
      toast({ title: "Left casino successfully" });
    } catch (error) {
      toast({
        title: "Failed to leave casino",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/casinos" })}
            className="mb-4 rounded-2xl text-gray-600 hover:text-purple-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Casinos
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center shadow-lg"
                >
                  <Crown className="w-8 h-8 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    {casino.name}
                  </h1>
                  <p className="text-gray-600">{casino.description || "No description"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Owner: {casino.owner?.username || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>Theme: {casino.theme}</span>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-500" />
                    <span className="text-purple-600 font-medium">You own this casino</span>
                  </div>
                )}
              </div>
            </div>

            {!isOwner && (
              <Button
                onClick={handleLeaveCasino}
                variant="outline"
                className="rounded-2xl border-red-200 text-red-500 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Casino
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-pink-100 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-600 font-medium">Bankroll</p>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(casino.bankroll)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Profits</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(availableProfits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-100 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-yellow-600 font-medium">House Edge</p>
                  <p className="text-2xl font-bold text-yellow-700">{casino.house_edge}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Bets</p>
                  <p className="text-2xl font-bold text-blue-700">{casino.stats?.totalBets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "play" ? "default" : "outline"}
            onClick={() => setActiveTab("play")}
            className={`rounded-2xl ${activeTab === "play" ? "bg-gradient-to-r from-pink-500 to-purple-500" : "border-purple-200 text-purple-600"}`}
          >
            <Gamepad2 className="w-4 h-4 mr-2" />
            Play
          </Button>
          <Button
            variant={activeTab === "stats" ? "default" : "outline"}
            onClick={() => setActiveTab("stats")}
            className={`rounded-2xl ${activeTab === "stats" ? "bg-gradient-to-r from-pink-500 to-purple-500" : "border-purple-200 text-purple-600"}`}
          >
            <History className="w-4 h-4 mr-2" />
            Stats
          </Button>
          {isOwner && (
            <Button
              variant={activeTab === "settings" ? "default" : "outline"}
              onClick={() => setActiveTab("settings")}
              className={`rounded-2xl ${activeTab === "settings" ? "bg-gradient-to-r from-pink-500 to-purple-500" : "border-purple-200 text-purple-600"}`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          )}
        </div>

        {/* Play Tab */}
        {activeTab === "play" && (
          <Card className="border-pink-100 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl font-display font-bold text-gray-800">Play Games</CardTitle>
              <CardDescription>Select a game and place your bet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {casino.enabled_games.map((gameId: string) => {
                  const game = AVAILABLE_GAMES.find(g => g.id === gameId);
                  if (!game) return null;
                  
                  return (
                    <button
                      key={gameId}
                      onClick={() => {
                        setBetGameId(gameId);
                        setBetOption(game.options[0]);
                        setShowBetModal(true);
                      }}
                      className="p-6 rounded-2xl border-2 border-purple-100 hover:border-purple-300 hover:shadow-lg transition-all bg-white"
                    >
                      <div className="text-4xl mb-3">{game.icon}</div>
                      <h3 className="font-bold text-gray-800">{game.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">Min: {formatCurrency(casino.min_bet)} - Max: {formatCurrency(casino.max_bet)}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <Card className="border-pink-100 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl font-display font-bold text-gray-800">Casino Statistics</CardTitle>
              <CardDescription>Performance metrics and betting history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-purple-700 mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Wagered</span>
                      <span className="font-bold text-gray-800">{formatCurrency(casino.stats?.totalWagered || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Payouts</span>
                      <span className="font-bold text-gray-800">{formatCurrency(casino.stats?.totalPayout || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-purple-200 pt-3">
                      <span className="text-purple-600 font-medium">Casino Profit</span>
                      <span className="font-bold text-purple-700">{formatCurrency(casino.stats?.casinoProfit || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-blue-700 mb-4">Activity</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Bets</span>
                      <span className="font-bold text-gray-800">{casino.stats?.totalBets || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Bet</span>
                      <span className="font-bold text-gray-800">
                        {casino.stats?.totalBets 
                          ? formatCurrency((casino.stats.totalWagered || 0) / casino.stats.totalBets)
                          : formatCurrency(0)
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payout Rate</span>
                      <span className="font-bold text-gray-800">
                        {casino.stats?.totalWagered 
                          ? ((casino.stats.totalPayout / casino.stats.totalWagered) * 100).toFixed(1) + "%"
                          : "0%"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Tab (Owner Only) */}
        {activeTab === "settings" && isOwner && (
          <Card className="border-pink-100 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl font-display font-bold text-gray-800">Casino Settings</CardTitle>
              <CardDescription>Manage your casino configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2">House Edge (%)</label>
                  <Input
                    type="number"
                    value={houseEdge}
                    onChange={(e) => setHouseEdge(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="rounded-2xl border-gray-200"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2">Min Bet</label>
                  <Input
                    type="number"
                    value={minBet}
                    onChange={(e) => setMinBet(Number(e.target.value))}
                    min={1}
                    className="rounded-2xl border-gray-200"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2">Max Bet</label>
                  <Input
                    type="number"
                    value={maxBet}
                    onChange={(e) => setMaxBet(Number(e.target.value))}
                    min={minBet}
                    className="rounded-2xl border-gray-200"
                  />
                </div>
              </div>

              <Button
                onClick={handleUpdateSettings}
                className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
              >
                <Settings className="w-5 h-5 mr-2" />
                Update Settings
              </Button>

              <div className="border-t border-pink-100 pt-6">
                <h3 className="font-semibold text-gray-800 mb-4">Bankroll Management</h3>
                <div className="flex gap-4">
                  <Button
                    onClick={() => setShowFundModal(true)}
                    variant="outline"
                    className="rounded-2xl border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Fund Bankroll
                  </Button>
                  <Button
                    onClick={() => setShowWithdrawModal(true)}
                    variant="outline"
                    className="rounded-2xl border-yellow-200 text-yellow-600 hover:bg-yellow-50"
                    disabled={availableProfits <= 0}
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    Withdraw Profits
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Available profits: {formatCurrency(availableProfits)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bet Modal */}
        <AnimatePresence>
          {showBetModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-bold text-gray-800">Place Bet</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBetModal(false)}
                    className="rounded-full"
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Game</label>
                    <div className="text-lg font-bold text-purple-600">
                      {AVAILABLE_GAMES.find(g => g.id === betGameId)?.icon} {AVAILABLE_GAMES.find(g => g.id === betGameId)?.name}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Option</label>
                    <select
                      value={betOption}
                      onChange={(e) => setBetOption(e.target.value)}
                      className="w-full rounded-2xl border-gray-200 p-3"
                    >
                      {AVAILABLE_GAMES.find(g => g.id === betGameId)?.options.map((opt) => (
                        <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Bet Amount</label>
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min={casino.min_bet}
                      max={casino.max_bet}
                      className="rounded-2xl border-gray-200"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min: {formatCurrency(casino.min_bet)} - Max: {formatCurrency(casino.max_bet)}
                    </p>
                  </div>

                  <Button
                    onClick={handlePlaceBet}
                    className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
                  >
                    <Coins className="w-5 h-5 mr-2" />
                    Place Bet
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fund Modal */}
        <AnimatePresence>
          {showFundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-bold text-gray-800">Fund Bankroll</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFundModal(false)}
                    className="rounded-full"
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <Input
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      min={100}
                      className="rounded-2xl border-gray-200"
                    />
                  </div>

                  <Button
                    onClick={handleFundBankroll}
                    className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Fund Bankroll
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Withdraw Modal */}
        <AnimatePresence>
          {showWithdrawModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-bold text-gray-800">Withdraw Profits</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowWithdrawModal(false)}
                    className="rounded-full"
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min={1}
                      max={availableProfits}
                      className="rounded-2xl border-gray-200"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {formatCurrency(availableProfits)}
                    </p>
                  </div>

                  <Button
                    onClick={handleWithdrawProfits}
                    className="w-full rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400"
                  >
                    <Minus className="w-5 h-5 mr-2" />
                    Withdraw Profits
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}