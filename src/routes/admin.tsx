import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  getAdminOverview,
  refillPool,
  adjustPlayerBalance,
  setModeration,
  setUsername,
  setRole,
  updateCasinoSettings,
  resetEconomy,
  triggerFakePlayerSimulation,
} from "@/lib/admin.functions";
import {
  initializeFakePlayersSystem,
  createRealFakePlayers,
  startAutomatedBettingSystem,
  stopAutomatedBettingSystem,
} from "@/lib/fake-players.functions";
import { Shield, Crown, Coins, Users, AlertTriangle, Ban, RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — PoolCasino" },
      { name: "description", content: "Staff console for the PoolCasino economy: pool, players, moderation and settings." },
      { property: "og:title", content: "Admin Panel — PoolCasino" },
      { property: "og:description", content: "Staff console for the PoolCasino economy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPanel,
});

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="border-white/10 bg-black/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-display font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getAdminOverview);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("100000");
  const [resetPlayer, setResetPlayer] = useState("10000");
  const [resetPool, setResetPool] = useState("1000000");

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });
  const onError = (e: unknown) =>
    toast({ title: "Action failed", description: String((e as Error)?.message ?? e), variant: "destructive" });

  const mPool = useMutation({ mutationFn: useServerFn(refillPool), onSuccess: () => { toast({ title: "Pool updated" }); invalidate(); }, onError });
  const mBalance = useMutation({ mutationFn: useServerFn(adjustPlayerBalance), onSuccess: () => { toast({ title: "Balance updated" }); invalidate(); }, onError });
  const mMod = useMutation({ mutationFn: useServerFn(setModeration), onSuccess: () => { toast({ title: "Moderation applied" }); invalidate(); }, onError });
  const mName = useMutation({ mutationFn: useServerFn(setUsername), onSuccess: () => { toast({ title: "Username changed" }); invalidate(); }, onError });
  const mRole = useMutation({ mutationFn: useServerFn(setRole), onSuccess: () => { toast({ title: "Role updated" }); invalidate(); }, onError });
  const mSettings = useMutation({ mutationFn: useServerFn(updateCasinoSettings), onSuccess: () => { toast({ title: "Settings saved" }); invalidate(); }, onError });
  const mReset = useMutation({ mutationFn: useServerFn(resetEconomy), onSuccess: () => { toast({ title: "Economy reset" }); invalidate(); }, onError });
  const mFakeSim = useMutation({ mutationFn: useServerFn(triggerFakePlayerSimulation), onSuccess: (data) => { toast({ title: "Simulation complete", description: `Created ${data.playersCreated} players, ${data.betsPlaced} bets, ${data.donationsMade} donations` }); invalidate(); }, onError });
  const mInitFake = useMutation({ mutationFn: useServerFn(initializeFakePlayersSystem), onSuccess: (data) => { 
    const created = data?.created ?? 0;
    const target = data?.targetCount ?? 0;
    const errors = data?.errors;
    
    if (errors && errors.length > 0) {
      toast({ 
        title: "Fake players partially created", 
        description: `Target: ${target}, Created: ${created}, Errors: ${errors.length}`,
        variant: "destructive"
      });
    } else {
      toast({ title: "Fake players initialized", description: `Target: ${target}, Created: ${created}` }); 
    }
    invalidate(); 
  }, onError });
  const mCreateFake = useMutation({ mutationFn: useServerFn(createRealFakePlayers), onSuccess: (data) => { toast({ title: "Fake players created", description: `Created ${data.created} real auth accounts` }); invalidate(); }, onError });
  const mStartAutoBet = useMutation({ mutationFn: useServerFn(startAutomatedBettingSystem), onSuccess: (data) => { toast({ title: "Automated betting started", description: data.message }); invalidate(); }, onError });
  const mStopAutoBet = useMutation({ mutationFn: useServerFn(stopAutomatedBettingSystem), onSuccess: (data) => { toast({ title: "Automated betting stopped", description: data.message }); invalidate(); }, onError });

  const data = overview.data;
  const isOwner = data?.me.isOwner ?? false;

  const players = useMemo(() => {
    const list = data?.players ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.username.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q));
  }, [data, search]);

  if (overview.isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading console…</div>
      </Layout>
    );
  }

  if (overview.isError || !data) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-2xl font-display font-bold">Staff access only</h1>
          <p className="text-sm text-muted-foreground">
            This console is restricted to designated admins and owners.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Back to casino</Button>
        </div>
      </Layout>
    );
  }

  const numericAmount = Number(amount) || 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-3">
          {isOwner ? <Crown className="w-8 h-8 text-yellow-400" /> : <Shield className="w-8 h-8 text-primary" />}
          <div>
            <h1 className="text-3xl font-display font-bold">{isOwner ? "Owner Panel" : "Admin Panel"}</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {data.me.username} · {isOwner ? "Owner" : "Admin"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => invalidate()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Pool" value={formatCurrency(data.stats.poolAmount)} icon={Coins} />
          <Stat label="Player money" value={formatCurrency(data.stats.playerMoney)} icon={Users} />
          <Stat label="Money supply" value={formatCurrency(data.stats.moneySupply)} icon={Coins} />
          <Stat label="Players" value={String(data.stats.playerCount)} icon={Users} />
        </div>

        <Tabs defaultValue="players">
          <TabsList className="bg-black/50 border border-white/10">
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="fake-players">Fake Players</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            {isOwner && <TabsTrigger value="owner">Owner</TabsTrigger>}
          </TabsList>

          <TabsContent value="players" className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search players by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-black/50"
                />
              </div>
              <div className="relative w-40">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="pl-9 bg-black/50 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              {players.map((p) => (
                <Card key={p.user_id} className="border-white/10 bg-black/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.username}</span>
                      {p.is_owner && <Badge className="bg-yellow-500/20 text-yellow-300">Owner</Badge>}
                      {!p.is_owner && p.is_admin && <Badge className="bg-primary/20 text-primary">Admin</Badge>}
                      {p.is_perma_banned && <Badge variant="destructive">Perma-banned</Badge>}
                      {!p.is_perma_banned && p.is_banned && <Badge variant="destructive">Banned</Badge>}
                      {p.is_suspended && <Badge className="bg-orange-500/20 text-orange-300">Suspended</Badge>}
                      <span className="ml-auto font-mono text-primary">{formatCurrency(Number(p.balance))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.email ?? "no email"} · {p.games_played} games · {p.total_wins}W/{p.total_losses}L
                      {p.ban_reason ? ` · reason: ${p.ban_reason}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => mBalance.mutate({ data: { userId: p.user_id, amount: numericAmount, mode: "add" } })}>
                        Add {formatCurrency(numericAmount)}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mBalance.mutate({ data: { userId: p.user_id, amount: numericAmount, mode: "set" } })}>
                        Set to {formatCurrency(numericAmount)}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const name = window.prompt("New username", p.username);
                        if (name) mName.mutate({ data: { userId: p.user_id, username: name } });
                      }}>
                        Rename
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mMod.mutate({ data: { userId: p.user_id, action: "suspend", reason: window.prompt("Reason?") ?? undefined, days: 1 } })}>
                        Suspend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => mMod.mutate({ data: { userId: p.user_id, action: "ban", reason: window.prompt("Reason?") ?? undefined, days: 7 } })}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Ban
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => mMod.mutate({ data: { userId: p.user_id, action: "perma_ban", reason: window.prompt("Reason?") ?? undefined } })}>
                        Perma-ban
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => mMod.mutate({ data: { userId: p.user_id, action: "unban" } })}>
                        Unban
                      </Button>
                      {isOwner && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => mRole.mutate({ data: { userId: p.user_id, role: "admin" } })}>
                            Make admin
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => mRole.mutate({ data: { userId: p.user_id, role: "owner" } })}>
                            Make owner
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => mRole.mutate({ data: { userId: p.user_id, role: "player" } })}>
                            Demote
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {players.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No players found.</p>}
            </div>
          </TabsContent>

          <TabsContent value="economy">
            <Card className="border-white/10 bg-black/50">
              <CardHeader>
                <CardTitle>Pool bankroll</CardTitle>
                <CardDescription>Amount applies to pool refills and player balance actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-black/50 font-mono" />
                <div className="flex gap-2">
                  <Button onClick={() => mPool.mutate({ data: { amount: numericAmount, mode: "add" } })}>Add to pool</Button>
                  <Button variant="outline" onClick={() => mPool.mutate({ data: { amount: numericAmount, mode: "set" } })}>
                    Set pool
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wagered (last 500 bets): {formatCurrency(data.stats.wagered)} · Paid out:{" "}
                  {formatCurrency(data.stats.paidOut)}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border-white/10 bg-black/50">
              <CardHeader>
                <CardTitle>Casino settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pause the pool</p>
                    <p className="text-xs text-muted-foreground">Blocks all pool-backed betting.</p>
                  </div>
                  <Switch
                    checked={data.pool?.pool_paused ?? false}
                    onCheckedChange={(v) => mSettings.mutate({ data: { poolPaused: v } })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Disabled games</p>
                  <Input
                    defaultValue={(data.pool?.disabled_games ?? []).join(", ")}
                    placeholder="roulette, plinko"
                    className="bg-black/50"
                    onBlur={(e) =>
                      mSettings.mutate({
                        data: {
                          disabledGames: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Comma separated game ids. Saves on blur.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fake-players">
            <Card className="border-white/10 bg-black/50">
              <CardHeader>
                <CardTitle>Fake Player System</CardTitle>
                <CardDescription>Manage automated fake players for testing and activity simulation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="font-medium">Initialize Fake Players</p>
                  <p className="text-xs text-muted-foreground">Creates real Supabase auth accounts with random usernames and balances.</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => mInitFake.mutate({ data: { targetCount: 15 } })}
                      disabled={mInitFake.isPending}
                    >
                      {mInitFake.isPending ? "Initializing..." : "Initialize 15 Players"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => mInitFake.mutate({ data: { targetCount: 30 } })}
                      disabled={mInitFake.isPending}
                    >
                      Initialize 30 Players
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-medium">Create Additional Fake Players</p>
                  <p className="text-xs text-muted-foreground">Add more fake players to the existing pool.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => mCreateFake.mutate({ data: { count: 5 } })}
                      disabled={mCreateFake.isPending}
                    >
                      {mCreateFake.isPending ? "Creating..." : "Add 5 Players"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => mCreateFake.mutate({ data: { count: 10 } })}
                      disabled={mCreateFake.isPending}
                    >
                      Add 10 Players
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-medium">Automated Betting</p>
                  <p className="text-xs text-muted-foreground">Fake players will automatically place random bets at intervals.</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => mStartAutoBet.mutate({ data: { intervalMinutes: 3 } })}
                      disabled={mStartAutoBet.isPending}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      {mStartAutoBet.isPending ? "Starting..." : "Start (3 min intervals)"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => mStartAutoBet.mutate({ data: { intervalMinutes: 5 } })}
                      disabled={mStartAutoBet.isPending}
                    >
                      Start (5 min intervals)
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => mStopAutoBet.mutate({ data: {} })}
                      disabled={mStopAutoBet.isPending}
                    >
                      {mStopAutoBet.isPending ? "Stopping..." : "Stop Betting"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-medium">Legacy Simulation</p>
                  <p className="text-xs text-muted-foreground">One-time simulation that creates fake players and places bets immediately.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm("Run fake player simulation? This will create new fake players and simulate bets/donations.")) return;
                      mFakeSim.mutate({ data: {} });
                    }}
                    disabled={mFakeSim.isPending}
                  >
                    {mFakeSim.isPending ? "Running..." : "Run Legacy Simulation"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="border-white/10 bg-black/50">
              <CardHeader>
                <CardTitle>Money ledger</CardTitle>
                <CardDescription>Most recent 50 economy events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.ledger.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                    <Badge variant="outline">{l.event_type}</Badge>
                    <span className={l.direction === "out" ? "text-destructive" : "text-primary"}>
                      {formatCurrency(Number(l.amount))}
                    </span>
                    <span className="text-muted-foreground truncate">{l.description}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
                {data.ledger.length === 0 && <p className="text-sm text-muted-foreground">No ledger entries yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {isOwner && (
            <TabsContent value="owner">
              <Card className="border-yellow-500/30 bg-black/50">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex items-center gap-2">
                    <Crown className="w-5 h-5" /> Owner controls
                  </CardTitle>
                  <CardDescription>Destructive economy-wide actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Every player balance</p>
                      <Input value={resetPlayer} onChange={(e) => setResetPlayer(e.target.value)} className="bg-black/50 font-mono" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Pool total</p>
                      <Input value={resetPool} onChange={(e) => setResetPool(e.target.value)} className="bg-black/50 font-mono" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!window.confirm("Reset the entire economy? This cannot be undone.")) return;
                        mReset.mutate({ data: { playerBalance: Number(resetPlayer) || 0, poolAmount: Number(resetPool) || 0 } });
                      }}
                    >
                      Reset economy
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm("Run fake player simulation? This will create new fake players and simulate bets/donations.")) return;
                        mFakeSim.mutate({ data: {} });
                      }}
                      disabled={mFakeSim.isPending}
                    >
                      {mFakeSim.isPending ? "Running..." : "Run Fake Player Sim"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
