import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  useAdminRefillPool,
  useAdminRefillPlayer,
  useAdminListPlayers,
  useAdminResetAllBalances,
  useAdminSeize,
  useAdminGetSettings,
  useAdminUpdateSettings,
  useGetPool,
} from "@workspace/api-client-react";
import type { AdminPlayer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  ShieldAlert, RefreshCw, Users, X, Plus, ArrowRight,
  Settings, Gamepad2, Power, PowerOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

const ALL_GAMES = [
  { id: "roulette",  name: "Neon Roulette",   emoji: "🎡" },
  { id: "plinko",    name: "Drop Plinko",      emoji: "🔮" },
  { id: "blackjack", name: "Blackjack",        emoji: "🃏" },
  { id: "crash",     name: "Crash",            emoji: "📈" },
  { id: "slots",     name: "Neon Slots",       emoji: "🎰" },
  { id: "dice",      name: "Dice Roll",        emoji: "🎲" },
  { id: "coinflip",  name: "Coin Flip",        emoji: "🪙" },
  { id: "wheel",     name: "Fortune Wheel",    emoji: "🎡" },
  { id: "guess",     name: "Number Guess",     emoji: "🔢" },
  { id: "mines",     name: "Mines",            emoji: "💣" },
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pool } = useGetPool({ query: { refetchInterval: 5000 } });
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useAdminListPlayers({
    query: { enabled: !!user?.isAdmin },
  });
  const { data: adminSettings, refetch: refetchSettings } = useAdminGetSettings({ query: { enabled: !!user?.isAdmin } });

  const refillPoolMut = useAdminRefillPool();
  const refillPlayerMut = useAdminRefillPlayer();
  const resetAllBalancesMut = useAdminResetAllBalances();
  const seizesMut = useAdminSeize();
  const updateSettingsMut = useAdminUpdateSettings();

  const [poolRefillAmount, setPoolRefillAmount] = useState("1000000");
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  const [playerRefillAmount, setPlayerRefillAmount] = useState("10000");
  const [balanceMode, setBalanceMode] = useState<"add" | "subtract">("add");
  const [resetBalanceAmount, setResetBalanceAmount] = useState("10000");
  const [confirmReset, setConfirmReset] = useState(false);
  const [forceReloadPending, setForceReloadPending] = useState(false);
  const [seizePlayers, setSeizePlayers] = useState<{ id: number; username: string } | null>(null);
  const [seizeAmount, setSeizeAmount] = useState("10000");
  const [seizeDestination, setSeizeDestination] = useState<"pool" | "user">("pool");
  const [seizeToUserId, setSeizeToUserId] = useState<number | null>(null);
  const [adminUsernameCost, setAdminUsernameCost] = useState("");
  const [adminAvatarCost, setAdminAvatarCost] = useState("");
  const [disabledGames, setDisabledGames] = useState<string[]>([]);
  const [togglingGame, setTogglingGame] = useState<string | null>(null);

  const adjustedAmount = balanceMode === "subtract"
    ? -(parseFloat(playerRefillAmount) || 0)
    : (parseFloat(playerRefillAmount) || 0);
  const refillPreviewBalance = selectedPlayer ? selectedPlayer.balance + adjustedAmount : null;

  useEffect(() => {
    if (adminSettings) {
      setAdminUsernameCost(adminSettings.usernameChangeCost.toString());
      setAdminAvatarCost(adminSettings.avatarChangeCost.toString());
      setDisabledGames(adminSettings.disabledGames ?? []);
    }
  }, [adminSettings]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (!user?.isAdmin) return null;

  const handleRefillPool = () => {
    const amount = parseFloat(poolRefillAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    refillPoolMut.mutate({ data: { amount } }, {
      onSuccess: (data) => {
        toast({ title: "Pool Refilled!", description: data.message, className: "bg-success text-success-foreground border-none" });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleRefillPlayer = () => {
    if (!selectedPlayer) { toast({ title: "No player selected", variant: "destructive" }); return; }
    const rawAmount = parseFloat(playerRefillAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    const amount = balanceMode === "subtract" ? -rawAmount : rawAmount;
    refillPlayerMut.mutate({ data: { userId: selectedPlayer.id, amount } }, {
      onSuccess: (data) => {
        const verb = balanceMode === "subtract" ? "Subtracted!" : "Added!";
        toast({ title: `Balance ${verb}`, description: data.message, className: "bg-success text-success-foreground border-none" });
        setSelectedPlayer((prev) => (prev ? { ...prev, balance: prev.balance + amount } : null));
        refetchPlayers();
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleResetAllBalances = () => {
    const newBalance = parseFloat(resetBalanceAmount);
    if (isNaN(newBalance) || newBalance < 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    resetAllBalancesMut.mutate({ data: { newBalance } }, {
      onSuccess: (data) => {
        toast({ title: "Balances Reset!", description: data.message, className: "bg-success text-success-foreground border-none" });
        setConfirmReset(false);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        refetchPlayers();
      },
      onError: (err: any) => { toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }); setConfirmReset(false); },
    });
  };

  const handleSeize = () => {
    if (!seizePlayers) { toast({ title: "Select a player", variant: "destructive" }); return; }
    const amount = parseFloat(seizeAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (seizeDestination === "user" && !seizeToUserId) { toast({ title: "Select destination user", variant: "destructive" }); return; }
    seizesMut.mutate({ data: { fromUserId: seizePlayers.id, amount, destination: seizeDestination, toUserId: seizeToUserId ?? undefined } }, {
      onSuccess: (data) => {
        toast({ title: "Assets Seized!", description: data.message, className: "bg-success text-success-foreground border-none" });
        setSeizePlayers(null);
        setSeizeAmount("10000");
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        refetchPlayers();
      },
      onError: (err: any) => toast({ title: "Seize Failed", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleForceReload = async () => {
    setForceReloadPending(true);
    try {
      const res = await fetch(`${BASE}api/admin/force-reload`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Reload Signal Sent!", description: "All connected players will reload within 3 seconds.", className: "bg-success text-success-foreground border-none" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed", variant: "destructive" });
      }
    } catch { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
    finally { setForceReloadPending(false); }
  };

  const handleUpdateSettings = () => {
    const usernameChangeCost = parseFloat(adminUsernameCost);
    const avatarChangeCost = parseFloat(adminAvatarCost);
    if (isNaN(usernameChangeCost) || isNaN(avatarChangeCost)) { toast({ title: "Invalid costs", variant: "destructive" }); return; }
    updateSettingsMut.mutate({ data: { usernameChangeCost, avatarChangeCost } }, {
      onSuccess: () => {
        toast({ title: "Settings Saved!", className: "bg-success text-success-foreground border-none" });
        refetchSettings();
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleToggleGame = async (gameId: string) => {
    setTogglingGame(gameId);
    const isDisabled = disabledGames.includes(gameId);
    const newDisabled = isDisabled
      ? disabledGames.filter((g) => g !== gameId)
      : [...disabledGames, gameId];
    try {
      updateSettingsMut.mutate({ data: { disabledGames: newDisabled } }, {
        onSuccess: (data) => {
          const enabled = !isDisabled;
          toast({
            title: `${ALL_GAMES.find(g => g.id === gameId)?.name} ${enabled ? "Enabled" : "Disabled"}`,
            className: enabled ? "bg-success text-success-foreground border-none" : "",
          });
          setDisabledGames(data.disabledGames ?? []);
          qc.invalidateQueries({ queryKey: ["/api/pool"] });
          setTogglingGame(null);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" });
          setTogglingGame(null);
        },
      });
    } catch { setTogglingGame(null); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-yellow-400">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage games, economy, and players</p>
        </div>
        <div className="ml-auto">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
            {user.username}
          </Badge>
        </div>
      </div>

      {/* ── Game Controls ─────────────────────────────────────────────────────── */}
      <Card className="bg-black/60 border-yellow-500/20">
        <CardHeader className="border-b border-yellow-500/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-yellow-300">
            <Gamepad2 className="w-5 h-5" /> Game Controls
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Toggle games on or off. Disabled games show a maintenance overlay to players.</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_GAMES.map((game) => {
              const isOff = disabledGames.includes(game.id);
              const isToggling = togglingGame === game.id;
              return (
                <div
                  key={game.id}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
                    isOff
                      ? "bg-red-950/20 border-red-500/20"
                      : "bg-emerald-950/20 border-emerald-500/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${isOff ? "grayscale opacity-40" : ""}`}>{game.emoji}</span>
                    <div>
                      <p className={`text-sm font-medium ${isOff ? "text-muted-foreground" : "text-white"}`}>{game.name}</p>
                      <p className={`text-xs ${isOff ? "text-red-400" : "text-emerald-400"}`}>
                        {isOff ? "Disabled" : "Live"}
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isToggling}
                    onClick={() => handleToggleGame(game.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                      isOff
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                        : "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30"
                    }`}
                  >
                    {isToggling ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : isOff ? (
                      <><Power className="w-3 h-3" /> Enable</>
                    ) : (
                      <><PowerOff className="w-3 h-3" /> Disable</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Economy ───────────────────────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20">
        <CardHeader className="border-b border-yellow-500/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-yellow-300">
            <RefreshCw className="w-5 h-5" /> Economy Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">

          {/* Refill Pool */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">Refill Global Pool</h3>
            <p className="text-xs text-muted-foreground">Current pool: <span className="text-primary font-mono">{formatCurrency(pool?.totalAmount ?? 0)}</span></p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" min="1" value={poolRefillAmount} onChange={(e) => setPoolRefillAmount(e.target.value)}
                  className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" placeholder="Amount" />
              </div>
              <Button onClick={handleRefillPool} disabled={refillPoolMut.isPending} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                {refillPoolMut.isPending ? "Refilling..." : "Refill Pool"}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[100000, 500000, 1000000, 5000000].map((amt) => (
                <button key={amt} onClick={() => setPoolRefillAmount(amt.toString())}
                  className="text-xs px-3 py-1 rounded-full border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                  ${(amt / 1000000).toFixed(1)}M
                </button>
              ))}
            </div>
          </div>

          {/* Force Reload */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-orange-400 uppercase tracking-widest">Force Reload All Players</h3>
            <p className="text-xs text-muted-foreground">Sends a signal to every connected browser — they will all refresh within 3 seconds.</p>
            <Button onClick={handleForceReload} disabled={forceReloadPending} variant="outline"
              className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 gap-2">
              <RefreshCw className={`w-4 h-4 ${forceReloadPending ? "animate-spin" : ""}`} />
              {forceReloadPending ? "Sending Signal..." : "Reload Everyone's Browser"}
            </Button>
          </div>

          {/* Seize Assets */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-purple-400 uppercase tracking-widest">Seize Player Assets</h3>
            <p className="text-xs text-muted-foreground">Take money from a player and send it to the pool or another account.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Seize from</label>
                <select value={seizePlayers?.id ?? ""} onChange={(e) => {
                    const p = playersData?.players.find((pl) => pl.id === parseInt(e.target.value));
                    setSeizePlayers(p ? { id: p.id, username: p.username } : null);
                  }}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50">
                  <option value="">— Select player —</option>
                  {playersData?.players.filter((p) => !p.isAdmin).map((p) => (
                    <option key={p.id} value={p.id}>{p.username} ({formatCurrency(p.balance)})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount to seize</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400">$</span>
                  <Input type="number" min="1" value={seizeAmount} onChange={(e) => setSeizeAmount(e.target.value)}
                    className="pl-7 bg-black/40 border-purple-500/20 font-mono focus:border-purple-500/50" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Send seized funds to</label>
              <div className="flex gap-2">
                <button onClick={() => setSeizeDestination("pool")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "pool" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                  The Pool
                </button>
                <button onClick={() => setSeizeDestination("user")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "user" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                  Another Player
                </button>
              </div>
              {seizeDestination === "user" && (
                <select value={seizeToUserId ?? ""} onChange={(e) => setSeizeToUserId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50">
                  <option value="">— Select destination player —</option>
                  {playersData?.players.filter((p) => p.id !== seizePlayers?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              )}
            </div>
            <Button onClick={handleSeize} disabled={seizesMut.isPending || !seizePlayers || !parseFloat(seizeAmount)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2">
              <ShieldAlert className="w-4 h-4" />
              {seizesMut.isPending ? "Seizing..." : seizePlayers ? `Seize ${formatCurrency(parseFloat(seizeAmount) || 0)} from ${seizePlayers.username}` : "Seize Assets"}
            </Button>
          </div>

          {/* Force Reset All Balances */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-red-400 uppercase tracking-widest">Force Reset All Balances</h3>
            <p className="text-xs text-muted-foreground">Set every non-admin player's balance to a specific amount. This cannot be undone.</p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" min="0" value={resetBalanceAmount}
                  onChange={(e) => { setResetBalanceAmount(e.target.value); setConfirmReset(false); }}
                  className="pl-7 bg-black/40 border-red-500/20 focus:border-red-500/50 font-mono" placeholder="10000" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[0, 1000, 10000, 100000].map((amt) => (
                  <button key={amt} onClick={() => { setResetBalanceAmount(amt.toString()); setConfirmReset(false); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            {!confirmReset ? (
              <Button onClick={() => setConfirmReset(true)} variant="outline"
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                Reset All Player Balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}
              </Button>
            ) : (
              <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 rounded-xl p-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-300">Are you sure?</p>
                  <p className="text-xs text-muted-foreground">This will reset ALL player balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)} className="text-muted-foreground">Cancel</Button>
                <Button size="sm" onClick={handleResetAllBalances} disabled={resetAllBalancesMut.isPending}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold">
                  {resetAllBalancesMut.isPending ? "Resetting..." : "Confirm Reset"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Players ───────────────────────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20">
        <CardHeader className="border-b border-yellow-500/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-yellow-300">
            <Users className="w-5 h-5" /> Players
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Adjust Player Balance */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">Adjust Balance</h3>
              <div className="flex rounded-lg overflow-hidden border border-yellow-500/30 text-xs font-medium">
                <button onClick={() => setBalanceMode("add")}
                  className={`px-3 py-1.5 transition-colors ${balanceMode === "add" ? "bg-yellow-500 text-black" : "bg-black/40 text-yellow-400 hover:bg-yellow-500/10"}`}>
                  + Add
                </button>
                <button onClick={() => setBalanceMode("subtract")}
                  className={`px-3 py-1.5 transition-colors ${balanceMode === "subtract" ? "bg-red-500 text-white" : "bg-black/40 text-red-400 hover:bg-red-500/10"}`}>
                  − Subtract
                </button>
              </div>
            </div>

            {selectedPlayer ? (
              <div className="bg-black/40 border border-yellow-500/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/40 to-yellow-700/40 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-300 text-sm">
                      {selectedPlayer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{selectedPlayer.username}</p>
                      <p className="text-xs text-muted-foreground">ID #{selectedPlayer.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPlayer(null)} className="text-muted-foreground hover:text-white p-1 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${balanceMode === "subtract" ? "text-red-400" : "text-yellow-400"}`}>$</span>
                      <Input type="number" min="1" value={playerRefillAmount} onChange={(e) => setPlayerRefillAmount(e.target.value)}
                        className={`pl-7 bg-black/60 font-mono text-lg h-11 ${balanceMode === "subtract" ? "border-red-500/30 focus:border-red-500/60" : "border-yellow-500/30 focus:border-yellow-500/60"}`} placeholder="0" />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[1000, 10000, 50000, 100000].map((amt) => (
                      <button key={amt} onClick={() => setPlayerRefillAmount(amt.toString())}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          playerRefillAmount === amt.toString()
                            ? balanceMode === "subtract" ? "bg-red-500/20 border-red-500/60 text-red-300" : "bg-yellow-500/20 border-yellow-500/60 text-yellow-300"
                            : balanceMode === "subtract" ? "border-red-500/20 text-red-500 hover:bg-red-500/10" : "border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10"
                        }`}>
                        {balanceMode === "subtract" ? "-" : "+"}${amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Current</p>
                    <p className="font-mono font-bold text-white">{formatCurrency(selectedPlayer.balance)}</p>
                  </div>
                  <div className={balanceMode === "subtract" ? "text-red-400" : "text-yellow-500"}>
                    {balanceMode === "subtract" ? <span className="font-bold text-lg">−</span> : <Plus className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{balanceMode === "subtract" ? "Subtracting" : "Adding"}</p>
                    <p className={`font-mono font-bold ${balanceMode === "subtract" ? "text-red-400" : "text-yellow-400"}`}>
                      {balanceMode === "subtract" ? "-" : "+"}{formatCurrency(parseFloat(playerRefillAmount) || 0)}
                    </p>
                  </div>
                  <div className="text-muted-foreground"><ArrowRight className="w-4 h-4" /></div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">New Balance</p>
                    <p className={`font-mono font-bold ${(refillPreviewBalance || 0) < 0 ? "text-destructive" : "text-primary"}`}>
                      {formatCurrency(Math.max(0, refillPreviewBalance || 0))}
                    </p>
                  </div>
                </div>
                <Button onClick={handleRefillPlayer} disabled={refillPlayerMut.isPending || !parseFloat(playerRefillAmount)}
                  className={`w-full font-bold h-11 ${balanceMode === "subtract" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-black"}`}>
                  {refillPlayerMut.isPending
                    ? (balanceMode === "subtract" ? "Subtracting..." : "Adding Funds...")
                    : balanceMode === "subtract"
                      ? `Subtract ${formatCurrency(parseFloat(playerRefillAmount) || 0)} from ${selectedPlayer.username}`
                      : `Add ${formatCurrency(parseFloat(playerRefillAmount) || 0)} to ${selectedPlayer.username}`}
                </Button>
              </div>
            ) : (
              <div className="border border-dashed border-yellow-500/20 rounded-xl p-6 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 text-yellow-500/30" />
                <p className="text-sm">Click <span className="text-yellow-400 font-medium">Select</span> on any player below.</p>
              </div>
            )}
          </div>

          {/* Players Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">All Players</h3>
              <Button variant="ghost" size="sm" onClick={() => refetchPlayers()} className="text-yellow-400 hover:text-yellow-300">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            <div className="rounded-xl overflow-hidden border border-yellow-500/10">
              <table className="w-full text-sm">
                <thead className="bg-yellow-950/40 text-yellow-400 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Username</th>
                    <th className="px-4 py-3 text-left font-medium">Balance</th>
                    <th className="px-4 py-3 text-left font-medium">Games</th>
                    <th className="px-4 py-3 text-left font-medium">W/L</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-500/5">
                  {playersLoading ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading players...</td></tr>
                  ) : (
                    playersData?.players.map((player) => {
                      const isSelected = selectedPlayer?.id === player.id;
                      return (
                        <tr key={player.id} onClick={() => setSelectedPlayer(isSelected ? null : player)}
                          className={`transition-colors cursor-pointer ${isSelected ? "bg-yellow-950/40 border-l-2 border-yellow-500" : "hover:bg-yellow-950/20"}`}>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{player.id}</td>
                          <td className="px-4 py-3 font-medium">{player.username}</td>
                          <td className="px-4 py-3 font-mono text-primary">{formatCurrency(player.balance)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{player.gamesPlayed}</td>
                          <td className="px-4 py-3 text-muted-foreground">{player.totalWins}W / {player.totalLosses}L</td>
                          <td className="px-4 py-3">
                            {player.isAdmin
                              ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">Admin</Badge>
                              : <Badge variant="outline" className="text-xs text-muted-foreground">Player</Badge>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedPlayer(isSelected ? null : player); }}
                              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isSelected ? "bg-yellow-500/20 text-yellow-300" : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"}`}>
                              {isSelected ? "Selected ✓" : "Select"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Settings ──────────────────────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20">
        <CardHeader className="border-b border-yellow-500/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-yellow-300">
            <Settings className="w-5 h-5" /> Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">Set what players pay to customize their profile.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-yellow-400 uppercase tracking-wider">Username Change Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" min="0" value={adminUsernameCost} onChange={(e) => setAdminUsernameCost(e.target.value)}
                  className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-yellow-400 uppercase tracking-wider">Avatar Change Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" min="0" value={adminAvatarCost} onChange={(e) => setAdminAvatarCost(e.target.value)}
                  className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" />
              </div>
            </div>
          </div>
          <Button onClick={handleUpdateSettings} disabled={updateSettingsMut.isPending}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
            {updateSettingsMut.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
