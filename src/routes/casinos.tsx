import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Crown, Coins, Users, Settings, TrendingUp, 
  Gamepad2, LogOut, ShieldAlert, Sparkles, Heart, Star
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
  createPlayerCasino,
  getPlayerCasinos,
  getPlayerCasinoDetails,
  joinPlayerCasino,
  leavePlayerCasino,
  placeCasinoBet,
  updateCasinoSettings,
  fundCasinoBankroll,
  withdrawCasinoProfits,
} from "@/lib/casino.functions";

const THEMES = [
  { id: "default", name: "Classic", colors: "from-purple-500 to-pink-500" },
  { id: "neon", name: "Neon", colors: "from-cyan-500 to-blue-500" },
  { id: "gold", name: "Gold", colors: "from-yellow-500 to-orange-500" },
  { id: "rose", name: "Rose", colors: "from-pink-500 to-rose-500" },
  { id: "emerald", name: "Emerald", colors: "from-emerald-500 to-teal-500" },
  { id: "sunset", name: "Sunset", colors: "from-orange-500 to-red-500" },
];

const AVAILABLE_GAMES = [
  { id: "coinflip", name: "Coin Flip", icon: "🪙" },
  { id: "dice", name: "Dice Roll", icon: "🎲" },
  { id: "wheel", name: "Fortune Wheel", icon: "🎡" },
  { id: "crash", name: "Crash", icon: "📈" },
  { id: "plinko", name: "Plinko", icon: "🔻" },
];

export const Route = createFileRoute("/casinos")({
  head: () => ({
    meta: [
      { title: "Player Casinos — PoolCasino" },
      { name: "description", content: "Create and manage your own casino with custom games and settings." },
      { property: "og:title", content: "Player Casinos — PoolCasino" },
      { property: "og:description", content: "Create and manage your own casino." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerCasinos,
});

function PlayerCasinos() {
  const { user, isAuthenticated } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCasino, setSelectedCasino] = useState<string | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);

  // Form state
  const [casinoName, setCasinoName] = useState("");
  const [casinoDescription, setCasinoDescription] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [houseEdge, setHouseEdge] = useState(5);
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(1000);
  const [initialBankroll, setInitialBankroll] = useState(10000);
  const [selectedGames, setSelectedGames] = useState<string[]>(["coinflip", "dice", "wheel", "crash", "plinko"]);

  // Betting state
  const [betGameId, setBetGameId] = useState("coinflip");
  const [betOption, setBetOption] = useState("heads");
  const [betAmount, setBetAmount] = useState("10");

  const createCasinoFn = useServerFn(createPlayerCasino);
  const getCasinosFn = useServerFn(getPlayerCasinos);
  const getCasinoDetailsFn = useServerFn(getPlayerCasinoDetails);
  const joinCasinoFn = useServerFn(joinPlayerCasino);
  const leaveCasinoFn = useServerFn(leavePlayerCasino);
  const placeBetFn = useServerFn(placeCasinoBet);
  const updateSettingsFn = useServerFn(updateCasinoSettings);
  const fundBankrollFn = useServerFn(fundCasinoBankroll);
  const withdrawProfitsFn = useServerFn(withdrawCasinoProfits);

  const { data: casinos, refetch: refetchCasinos } = useQuery({
    queryKey: ["player-casinos"],
    queryFn: () => getCasinosFn({}),
    refetchInterval: 10000,
  });

  const { data: casinoDetails } = useQuery({
    queryKey: ["casino-details", selectedCasino],
    queryFn: () => selectedCasino ? getCasinoDetailsFn({ data: { casinoId: selectedCasino } }) : null,
    enabled: !!selectedCasino,
    refetchInterval: 5000,
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("player-casinos")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_casinos" }, () => refetchCasinos())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchCasinos]);

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 mb-6">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-gray-800 mb-4">Player Casinos</h1>
          <p className="text-gray-600 mb-8">Create your own casino and become the house!</p>
          <Link to="/login">
            <Button className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400">
              Log in to Start
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const handleCreateCasino = async () => {
    try {
      await createCasinoFn({
        data: {
          name: casinoName,
          description: casinoDescription,
          theme: selectedTheme,
          houseEdge,
          minBet,
          maxBet,
          initialBankroll,
        },
      });
      setShowCreateModal(false);
      refetchCasinos();
      toast({ title: "Casino created successfully! 🎉" });
    } catch (error) {
      toast({
        title: "Failed to create casino",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleJoinCasino = async (casinoId: string) => {
    try {
      await joinCasinoFn({ data: { casinoId } });
      refetchCasinos();
      toast({ title: "Joined casino successfully! 🎉" });
    } catch (error) {
      toast({
        title: "Failed to join casino",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleLeaveCasino = async (casinoId: string) => {
    try {
      await leaveCasinoFn({ data: { casinoId } });
      refetchCasinos();
      toast({ title: "Left casino" });
    } catch (error) {
      toast({
        title: "Failed to leave casino",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedCasino) return;

    try {
      const result = await placeBetFn({
        data: {
          casinoId: selectedCasino,
          gameId: betGameId,
          option: betOption,
          betAmount: Number(betAmount),
        },
      });
      setShowBetModal(false);
      refetchCasinos();
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

  const toggleGameSelection = (gameId: string) => {
    setSelectedGames(prev =>
      prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              Player Casinos
            </h1>
            <p className="text-gray-600 mt-2">Create your own casino and become the house!</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Casino
          </Button>
        </div>

        {/* Casinos Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {casinos?.map((casino: any) => (
            <motion.div
              key={casino.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="cursor-pointer"
              onClick={() => setSelectedCasino(casino.id)}
            >
              <Card className={`border-pink-100 hover:border-purple-200 hover:shadow-xl transition-all rounded-3xl ${
                selectedCasino === casino.id ? "ring-2 ring-purple-400" : ""
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-display font-bold text-gray-800">
                        {casino.name}
                      </CardTitle>
                      <CardDescription className="text-gray-500 text-sm">
                        {casino.description || "No description"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                        {casino.theme}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-3">
                      <p className="text-xs text-purple-600 font-medium">Bankroll</p>
                      <p className="text-lg font-bold text-purple-700">{formatCurrency(casino.bankroll)}</p>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-3">
                      <p className="text-xs text-orange-600 font-medium">House Edge</p>
                      <p className="text-lg font-bold text-orange-700">{casino.house_edge}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>Owner: {casino.owner?.username || "Unknown"}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-2xl border-purple-200 text-purple-600 hover:bg-purple-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: `/casinos/${casino.id}` });
                      }}
                    >
                      <Gamepad2 className="w-4 h-4 mr-1" />
                      Play
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBetModal(true);
                      }}
                    >
                      <Coins className="w-4 h-4 mr-1" />
                      Quick Bet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {casinos?.length === 0 && (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 mb-6">
                <Crown className="w-12 h-12 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-2">No casinos yet</h3>
              <p className="text-gray-500 mb-6">Be the first to create your own casino!</p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your Casino
              </Button>
            </div>
          )}
        </div>

        {/* Create Casino Modal */}
        <AnimatePresence>
          {showCreateModal && (
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
                className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-bold text-gray-800">Create Your Casino</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-full"
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Casino Name</label>
                    <Input
                      value={casinoName}
                      onChange={(e) => setCasinoName(e.target.value)}
                      placeholder="My Awesome Casino"
                      className="rounded-2xl border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Description</label>
                    <Input
                      value={casinoDescription}
                      onChange={(e) => setCasinoDescription(e.target.value)}
                      placeholder="Welcome to my casino!"
                      className="rounded-2xl border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setSelectedTheme(theme.id)}
                          className={`p-4 rounded-2xl border-2 transition-all ${
                            selectedTheme === theme.id
                              ? "border-purple-400 bg-purple-50"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.colors} mx-auto mb-2`} />
                          <span className="text-sm font-medium">{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                      <label className="text-sm font-medium text-gray-700 mb-2">Initial Bankroll</label>
                      <Input
                        type="number"
                        value={initialBankroll}
                        onChange={(e) => setInitialBankroll(Number(e.target.value))}
                        min={1000}
                        className="rounded-2xl border-gray-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3">Available Games</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AVAILABLE_GAMES.map((game) => (
                        <button
                          key={game.id}
                          onClick={() => toggleGameSelection(game.id)}
                          className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-2 ${
                            selectedGames.includes(game.id)
                              ? "border-purple-400 bg-purple-50"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          <span className="text-xl">{game.icon}</span>
                          <span className="text-sm font-medium">{game.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateCasino}
                    disabled={!casinoName || !initialBankroll}
                    className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 shadow-lg"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Casino
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Bet Modal */}
        <AnimatePresence>
          {showBetModal && casinoDetails && (
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
                  <h2 className="text-2xl font-display font-bold text-gray-800">Quick Bet</h2>
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
                    <label className="text-sm font-medium text-gray-700 mb-2">Select Game</label>
                    <select
                      value={betGameId}
                      onChange={(e) => setBetGameId(e.target.value)}
                      className="w-full rounded-2xl border-gray-200 p-3"
                    >
                      {casinoDetails.enabled_games.map((gameId: string) => {
                        const game = AVAILABLE_GAMES.find(g => g.id === gameId);
                        return game ? (
                          <option key={gameId} value={gameId}>{game.icon} {game.name}</option>
                        ) : null;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Bet Amount</label>
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min={casinoDetails.min_bet}
                      max={casinoDetails.max_bet}
                      className="rounded-2xl border-gray-200"
                    />
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
      </div>
    </Layout>
  );
}