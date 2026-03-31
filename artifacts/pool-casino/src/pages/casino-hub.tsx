import React, { useState, useEffect, useCallback } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { formatNumber } from "@/lib/utils";
import {
  Building2, ArrowLeft, Gamepad2, BarChart2, ScrollText,
  Settings, Plus, Coins, TrendingUp, TrendingDown, PauseCircle,
  PlayCircle, ShoppingCart, Check, X, AlertCircle, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Pencil, Save, Wine, ExternalLink,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

type Tab = "games" | "stats" | "logs" | "owner";

interface Casino {
  id: number;
  name: string;
  description: string;
  emoji: string;
  bankroll: string;
  minBet: string;
  maxBet: string;
  isPaused: boolean;
  totalBets: number;
  totalWagered: string;
  totalPaidOut: string;
  ownerId: number;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  createdAt: string;
}

interface GameOwned {
  id: number;
  casinoId: number;
  gameType: string;
  isEnabled: boolean;
  purchasedAt: string;
}

interface Drink {
  id: number;
  casinoId: number;
  name: string;
  emoji: string;
  price: string;
  tier: string;
  isAvailable: boolean;
}

interface BetLog {
  id: number;
  gameType: string;
  betAmount: string;
  result: string;
  payout: string;
  multiplier: string;
  createdAt: string;
  username: string | null;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
}

const PURCHASABLE_GAMES = [
  { type: "slots", name: "Neon Slots", emoji: "🎰", route: "slots" },
  { type: "roulette", name: "Roulette", emoji: "🎡", route: null },
  { type: "blackjack", name: "Blackjack", emoji: "🃏", route: "blackjack" },
  { type: "crash", name: "Crash", emoji: "🚀", route: "crash" },
  { type: "plinko", name: "Plinko", emoji: "🎪", route: null },
  { type: "dice", name: "Dice Roll", emoji: "🎲", route: "dice" },
  { type: "coinflip", name: "Coin Flip", emoji: "🪙", route: "coinflip" },
  { type: "wheel", name: "Fortune Wheel", emoji: "🎠", route: "wheel" },
  { type: "mines", name: "Mines", emoji: "💣", route: "mines" },
  { type: "highlow", name: "High-Low", emoji: "🃏", route: null },
  { type: "doubledice", name: "Double Dice", emoji: "🎲", route: null },
  { type: "ladder", name: "Risk Ladder", emoji: "🪜", route: null },
  { type: "war", name: "War", emoji: "⚔️", route: null },
  { type: "icebreak", name: "Ice Break", emoji: "🧊", route: "icebreak" },
  { type: "lightning", name: "Lightning Round", emoji: "⚡", route: null },
  { type: "advwheel", name: "Advanced Wheel", emoji: "🎡", route: "advwheel" },
  { type: "guess", name: "Number Guess", emoji: "🔢", route: "guess" },
  { type: "pyramid", name: "Pyramid", emoji: "🔺", route: "pyramid" },
];

function fmt(v: string | number) {
  return formatNumber(parseFloat(String(v)));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function txTypeLabel(type: string) {
  switch (type) {
    case "deposit": return { label: "Deposit", color: "text-green-400" };
    case "withdraw": return { label: "Withdrawal", color: "text-red-400" };
    case "tax": return { label: "Monthly Tax", color: "text-orange-400" };
    case "bet_win": return { label: "Casino Win", color: "text-green-400" };
    case "bet_loss": return { label: "Casino Loss", color: "text-red-400" };
    case "drink_sale": return { label: "Drink Sale", color: "text-purple-400" };
    default: return { label: type, color: "text-muted-foreground" };
  }
}

// ─── Drinks Panel ─────────────────────────────────────────────────────────────
function DrinkPanel({ drinks, casinoId, isOwner, onPurchase }: {
  drinks: Drink[];
  casinoId: number;
  isOwner: boolean;
  onPurchase: (drinkId: number) => void;
}) {
  const { toast } = useToast();
  const [buying, setBuying] = useState<number | null>(null);

  const buy = async (drink: Drink) => {
    setBuying(drink.id);
    try {
      const res = await fetch(`${BASE}api/casinos/${casinoId}/drinks/${drink.id}/buy`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      toast({ title: `${drink.emoji} ${drink.name} purchased!`, description: `Balance: ${fmt(data.newBalance)} chips` });
      onPurchase(drink.id);
    } finally {
      setBuying(null);
    }
  };

  const available = drinks.filter(d => d.isAvailable);
  if (available.length === 0 && !isOwner) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Wine className="w-3.5 h-3.5" /> Bar Menu
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {available.map(drink => (
          <div key={drink.id} className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{drink.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{drink.name}</p>
                <p className="text-[10px] text-amber-400">{fmt(drink.price)} chips</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 h-7 px-2 text-xs"
              disabled={buying === drink.id}
              onClick={() => buy(drink)}
            >
              Buy
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Games Tab ────────────────────────────────────────────────────────────────
function GamesTab({ casino, games, drinks, isOwner, onRefresh }: {
  casino: Casino;
  games: GameOwned[];
  drinks: Drink[];
  isOwner: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [buying, setBuying] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const GAME_COST = 1_000_000;

  const ownedTypes = new Set(games.map(g => g.gameType));
  const enabledTypes = new Set(games.filter(g => g.isEnabled).map(g => g.gameType));

  const purchase = async (gameType: string) => {
    setBuying(gameType);
    try {
      const res = await fetch(`${BASE}api/casinos/${casino.id}/games`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      toast({ title: "Game added!", description: `${gameType} is now available at your casino.` });
      onRefresh();
    } finally {
      setBuying(null);
    }
  };

  const toggle = async (gameType: string, isEnabled: boolean) => {
    setToggling(gameType);
    try {
      const res = await fetch(`${BASE}api/casinos/${casino.id}/games/${gameType}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) { toast({ title: "Failed to update", variant: "destructive" }); return; }
      onRefresh();
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current game library */}
      {games.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary" /> Game Library ({games.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {games.map(g => {
              const meta = PURCHASABLE_GAMES.find(p => p.type === g.gameType);
              return (
                <div key={g.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${g.isEnabled ? "bg-primary/5 border-primary/20" : "bg-card/30 border-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{meta?.emoji ?? "🎮"}</span>
                    <div>
                      <p className="text-sm font-medium">{meta?.name ?? g.gameType}</p>
                      <p className="text-[10px] text-muted-foreground">{g.isEnabled ? "Live" : "Disabled"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {g.isEnabled && meta?.route && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate(`${BASE}games/${meta.route}?casinoId=${casino.id}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Play
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant={g.isEnabled ? "outline" : "ghost"}
                        className="h-7 px-2 text-xs"
                        disabled={toggling === g.gameType}
                        onClick={() => toggle(g.gameType, !g.isEnabled)}
                      >
                        {g.isEnabled ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drinks menu */}
      <DrinkPanel
        drinks={drinks}
        casinoId={casino.id}
        isOwner={isOwner}
        onPurchase={onRefresh}
      />

      {/* Bet info */}
      <div className="rounded-xl border border-white/5 bg-background/20 p-4">
        <p className="text-sm text-muted-foreground mb-1">Betting Limits</p>
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground">Min Bet</p>
            <p className="text-sm font-bold text-amber-400">{fmt(casino.minBet)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Max Bet</p>
            <p className="text-sm font-bold text-amber-400">{fmt(casino.maxBet)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Bankroll</p>
            <p className="text-sm font-bold text-green-400">{fmt(casino.bankroll)}</p>
          </div>
        </div>
      </div>

      {/* Game shop — owner only */}
      {isOwner && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" /> Purchase Games
            <span className="text-xs text-muted-foreground ml-1">1,000,000 chips each</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PURCHASABLE_GAMES.filter(g => !ownedTypes.has(g.type)).map(g => (
              <div key={g.type} className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-white/5 hover:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{g.emoji}</span>
                  <p className="text-xs font-medium">{g.name}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={buying === g.type}
                  onClick={() => purchase(g.type)}
                >
                  {buying === g.type ? "..." : "Buy"}
                </Button>
              </div>
            ))}
            {PURCHASABLE_GAMES.filter(g => !ownedTypes.has(g.type)).length === 0 && (
              <p className="col-span-full text-center text-muted-foreground text-sm py-4">You own all available games! 🎉</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ casino }: { casino: Casino }) {
  const wagered = parseFloat(casino.totalWagered);
  const paidOut = parseFloat(casino.totalPaidOut);
  const profit = wagered - paidOut;
  const profitPct = wagered > 0 ? (profit / wagered) * 100 : 0;
  const bankroll = parseFloat(casino.bankroll);

  const stats = [
    { label: "Total Bankroll", value: fmt(casino.bankroll), sub: "chips", color: "text-amber-400", icon: "💰" },
    { label: "Total Bets Placed", value: formatNumber(casino.totalBets), sub: "bets", color: "text-blue-400", icon: "🎯" },
    { label: "Total Wagered", value: fmt(casino.totalWagered), sub: "chips wagered", color: "text-purple-400", icon: "📊" },
    { label: "Total Paid Out", value: fmt(casino.totalPaidOut), sub: "chips paid", color: "text-orange-400", icon: "💸" },
    {
      label: "Casino Profit",
      value: `${profit >= 0 ? "+" : ""}${fmt(profit)}`,
      sub: `${profitPct.toFixed(1)}% house edge`,
      color: profit >= 0 ? "text-green-400" : "text-red-400",
      icon: profit >= 0 ? "📈" : "📉"
    },
    {
      label: "Avg Bet Size",
      value: casino.totalBets > 0 ? fmt(wagered / casino.totalBets) : "0",
      sub: "per bet",
      color: "text-teal-400",
      icon: "🎲"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-card/30 border border-white/5 rounded-xl p-4">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className={`text-xl font-bold font-display ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly tax info */}
      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-sm">
        <p className="font-medium text-orange-300 mb-1">💰 Monthly Tax Info</p>
        <p className="text-muted-foreground">
          On the 1st of each month, <strong className="text-white/70">10% of your bankroll</strong> is collected as tax and added to the prize pool.
          Current tax estimate: <span className="text-orange-400 font-semibold">{fmt(bankroll * 0.1)} chips</span>.
        </p>
      </div>

      <div className="text-center text-muted-foreground text-sm py-2">
        Casino opened {new Date(casino.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab({ casinoId }: { casinoId: number }) {
  const [bets, setBets] = useState<BetLog[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"bets" | "txns">("bets");

  const load = useCallback(async () => {
    setLoading(true);
    const [betsRes, txnsRes] = await Promise.all([
      fetch(`${BASE}api/casinos/${casinoId}/bets`, { credentials: "include" }),
      fetch(`${BASE}api/casinos/${casinoId}/transactions`, { credentials: "include" }),
    ]);
    if (betsRes.ok) { const d = await betsRes.json(); setBets(d.bets ?? []); }
    if (txnsRes.ok) { const d = await txnsRes.json(); setTxns(d.transactions ?? []); }
    setLoading(false);
  }, [casinoId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={view === "bets" ? "default" : "outline"} size="sm" onClick={() => setView("bets")}>Bet History</Button>
        <Button variant={view === "txns" ? "default" : "outline"} size="sm" onClick={() => setView("txns")}>Transactions</Button>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-card/20 animate-pulse" />
          ))}
        </div>
      ) : view === "bets" ? (
        bets.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No bets yet</div>
        ) : (
          <div className="space-y-2">
            {bets.map(b => {
              const game = PURCHASABLE_GAMES.find(g => g.type === b.gameType);
              return (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-white/5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{game?.emoji ?? "🎮"}</span>
                    <div>
                      <p className="font-medium">{b.username ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{game?.name ?? b.gameType} · {timeAgo(b.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={b.result === "win" ? "text-red-400" : "text-green-400"}>
                      {b.result === "win" ? `-${fmt(b.payout)}` : `+${fmt(b.betAmount)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Bet: {fmt(b.betAmount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        txns.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {txns.map(tx => {
              const { label, color } = txTypeLabel(tx.type);
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-white/5 text-sm">
                  <div>
                    <p className={`font-medium ${color}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{tx.description} · {timeAgo(tx.createdAt)}</p>
                  </div>
                  <p className={`font-semibold ${color}`}>{fmt(tx.amount)}</p>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Owner Controls Tab ────────────────────────────────────────────────────────
function OwnerTab({ casino, drinks, onRefresh }: {
  casino: Casino;
  drinks: Drink[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();

  // Settings form
  const [name, setName] = useState(casino.name);
  const [description, setDescription] = useState(casino.description);
  const [emoji, setEmoji] = useState(casino.emoji);
  const [minBet, setMinBet] = useState(casino.minBet);
  const [maxBet, setMaxBet] = useState(casino.maxBet);
  const [savingSettings, setSavingSettings] = useState(false);

  // Bankroll
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [bankrolling, setBankrolling] = useState(false);

  // Drinks
  const [showDrinkForm, setShowDrinkForm] = useState(false);
  const [drinkName, setDrinkName] = useState("");
  const [drinkEmoji, setDrinkEmoji] = useState("🍹");
  const [drinkPrice, setDrinkPrice] = useState("500");
  const [drinkTier, setDrinkTier] = useState<"cheap" | "standard" | "expensive">("standard");
  const [addingDrink, setAddingDrink] = useState(false);

  const EMOJIS = ["🏦", "🎰", "🎲", "🃏", "💎", "👑", "🌟", "🔥", "💜", "🎪", "🏛️", "🌙"];
  const DRINK_EMOJIS = ["🍹", "🍺", "🍸", "🥂", "🍾", "🥃", "🍷", "🧃", "☕", "🧉"];

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${BASE}api/casinos/${casino.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, emoji, minBet: parseFloat(minBet), maxBet: parseFloat(maxBet) }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      toast({ title: "Settings saved!" });
      onRefresh();
    } finally {
      setSavingSettings(false);
    }
  };

  const togglePause = async () => {
    const res = await fetch(`${BASE}api/casinos/${casino.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaused: !casino.isPaused }),
    });
    if (!res.ok) { toast({ title: "Failed", variant: "destructive" }); return; }
    toast({ title: casino.isPaused ? "Casino reopened!" : "Casino paused" });
    onRefresh();
  };

  const bankrollAction = async (action: "deposit" | "withdraw") => {
    const amount = parseFloat(action === "deposit" ? depositAmt : withdrawAmt);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setBankrolling(true);
    try {
      const res = await fetch(`${BASE}api/casinos/${casino.id}/${action}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      toast({ title: action === "deposit" ? "Deposited!" : "Withdrawn!", description: `Bankroll: ${fmt(data.newBankroll)} chips` });
      action === "deposit" ? setDepositAmt("") : setWithdrawAmt("");
      onRefresh();
    } finally {
      setBankrolling(false);
    }
  };

  const addDrink = async () => {
    if (!drinkName.trim()) { toast({ title: "Enter drink name", variant: "destructive" }); return; }
    setAddingDrink(true);
    try {
      const res = await fetch(`${BASE}api/casinos/${casino.id}/drinks`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: drinkName.trim(), emoji: drinkEmoji, price: parseFloat(drinkPrice), tier: drinkTier }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed", variant: "destructive" }); return; }
      toast({ title: `${drinkEmoji} ${drinkName} added to menu!` });
      setDrinkName(""); setShowDrinkForm(false);
      onRefresh();
    } finally {
      setAddingDrink(false);
    }
  };

  const toggleDrink = async (drink: Drink) => {
    const res = await fetch(`${BASE}api/casinos/${casino.id}/drinks/${drink.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !drink.isAvailable }),
    });
    if (!res.ok) { toast({ title: "Failed", variant: "destructive" }); return; }
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Pause/Resume */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-card/30">
        <div>
          <p className="font-medium">Casino Status</p>
          <p className="text-sm text-muted-foreground">{casino.isPaused ? "Your casino is paused — no bets accepted" : "Your casino is accepting bets"}</p>
        </div>
        <Button
          variant={casino.isPaused ? "default" : "outline"}
          onClick={togglePause}
          className="shrink-0"
        >
          {casino.isPaused ? <><PlayCircle className="w-4 h-4 mr-2" /> Resume</> : <><PauseCircle className="w-4 h-4 mr-2" /> Pause</>}
        </Button>
      </div>

      {/* Bankroll management */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" /> Bankroll Management
          <span className="text-sm text-muted-foreground font-normal">Current: {fmt(casino.bankroll)} chips</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Input type="number" placeholder="Deposit amount" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} className="bg-background/50" />
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => bankrollAction("deposit")} disabled={bankrolling}>
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Deposit
            </Button>
          </div>
          <div className="space-y-2">
            <Input type="number" placeholder="Withdraw amount" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} className="bg-background/50" />
            <Button className="w-full" variant="outline" size="sm" onClick={() => bankrollAction("withdraw")} disabled={bankrolling}>
              <TrendingDown className="w-3.5 h-3.5 mr-1.5" /> Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" /> Casino Settings
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-xl p-1.5 rounded-lg border transition-colors ${emoji === e ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={40} className="bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Bet</label>
              <Input type="number" value={minBet} onChange={e => setMinBet(e.target.value)} className="bg-background/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Bet</label>
              <Input type="number" value={maxBet} onChange={e => setMaxBet(e.target.value)} className="bg-background/50" />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings} className="w-full bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" /> {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Drinks management */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Wine className="w-4 h-4 text-purple-400" /> Bar Menu ({drinks.length})
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowDrinkForm(!showDrinkForm)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Drink
          </Button>
        </div>

        <AnimatePresence>
          {showDrinkForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl border border-white/10 bg-card/30 space-y-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Drink Emoji</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DRINK_EMOJIS.map(e => (
                      <button key={e} onClick={() => setDrinkEmoji(e)}
                        className={`text-xl p-1 rounded-lg border transition-colors ${drinkEmoji === e ? "border-primary bg-primary/10" : "border-white/10"}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                    <Input value={drinkName} onChange={e => setDrinkName(e.target.value)} placeholder="e.g. Lucky Mojito" className="bg-background/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Price (chips)</label>
                    <Input type="number" value={drinkPrice} onChange={e => setDrinkPrice(e.target.value)} className="bg-background/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tier</label>
                  <div className="flex gap-2">
                    {(["cheap", "standard", "expensive"] as const).map(t => (
                      <button key={t} onClick={() => setDrinkTier(t)}
                        className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${drinkTier === t ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-muted-foreground"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={addDrink} disabled={addingDrink} className="w-full" size="sm">
                  {addingDrink ? "Adding..." : `Add ${drinkEmoji} ${drinkName || "Drink"}`}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {drinks.length > 0 ? (
          <div className="space-y-2">
            {drinks.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{d.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(d.price)} chips · {d.tier}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleDrink(d)}>
                  {d.isAvailable ? "Hide" : "Show"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No drinks on the menu yet. Add one above!</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Hub Page ─────────────────────────────────────────────────────────────
export default function CasinoHub() {
  const [, params] = useRoute("/casino/:id");
  const casinoId = parseInt(params?.id ?? "0");
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const { toast } = useToast();

  const [casino, setCasino] = useState<Casino | null>(null);
  const [games, setGames] = useState<GameOwned[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("games");

  const load = useCallback(async () => {
    if (!casinoId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/casinos/${casinoId}`, { credentials: "include" });
      if (!res.ok) { navigate("/casinos"); return; }
      const data = await res.json();
      setCasino(data.casino);
      setGames(data.games ?? []);
      setDrinks(data.drinks ?? []);
    } catch {
      toast({ title: "Failed to load casino", variant: "destructive" });
      navigate("/casinos");
    } finally {
      setLoading(false);
    }
  }, [casinoId]);

  useEffect(() => { load(); }, [load]);

  const meId = me?.id;
  const isOwner = !!casino && !!meId && casino.ownerId === meId;

  const tabs = [
    { key: "games" as Tab, label: "Games", icon: Gamepad2 },
    { key: "stats" as Tab, label: "Stats", icon: BarChart2 },
    ...(isOwner ? [
      { key: "logs" as Tab, label: "Logs", icon: ScrollText },
      { key: "owner" as Tab, label: "Controls", icon: Settings },
    ] : []),
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-2xl bg-card/20" />
          <div className="h-12 rounded-xl bg-card/20" />
          <div className="h-64 rounded-2xl bg-card/20" />
        </div>
      </div>
    );
  }

  if (!casino) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Back */}
      <Link href="/casinos">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Casinos
        </button>
      </Link>

      {/* Casino header */}
      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-primary/10 via-card/40 to-card/20 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="text-6xl">{casino.emoji}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-display font-bold">{casino.name}</h1>
                {casino.isPaused && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Owned by <span className="text-white/70">{casino.ownerUsername ?? "Unknown"}</span>
              </p>
              {casino.description && (
                <p className="text-sm text-muted-foreground max-w-xl">{casino.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="text-center bg-background/20 rounded-xl p-3">
              <p className="text-lg font-bold text-amber-400">{fmt(casino.bankroll)}</p>
              <p className="text-[10px] text-muted-foreground">Bankroll</p>
            </div>
            <div className="text-center bg-background/20 rounded-xl p-3">
              <p className="text-lg font-bold text-purple-400">{games.filter(g => g.isEnabled).length}</p>
              <p className="text-[10px] text-muted-foreground">Games</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card/30 rounded-xl border border-white/5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "games" && (
            <GamesTab casino={casino} games={games} drinks={drinks} isOwner={isOwner} onRefresh={load} />
          )}
          {activeTab === "stats" && <StatsTab casino={casino} />}
          {activeTab === "logs" && <LogsTab casinoId={casino.id} />}
          {activeTab === "owner" && (
            <OwnerTab casino={casino} drinks={drinks} onRefresh={load} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
