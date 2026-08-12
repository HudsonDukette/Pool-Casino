import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, safeLocaleDate } from "@/lib/utils";
import { Gift, HandCoins } from "lucide-react";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Orders & Donations | Pool Casino" },
      {
        name: "description",
        content:
          "Fund coin requests from other Pool Casino players, or send a direct donation and grow your donated stat.",
      },
      { property: "og:title", content: "Orders & Donations | Pool Casino" },
      {
        property: "og:description",
        content: "Open coin requests from Pool Casino players — donate and climb the generosity board.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type OpenRequest = {
  id: string;
  username: string;
  avatar_url: string | null;
  amount: number;
  filled_amount: number;
  note: string;
  audience: string;
  status: string;
  created_at: string;
};

function OrdersPage() {
  const { user, isAuthenticated, loading, refresh } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [directUser, setDirectUser] = React.useState("");
  const [directAmount, setDirectAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  const { data: requests, refetch } = useQuery({
    queryKey: ["open-requests"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("open_money_requests", { _limit: 50 });
      if (error) throw error;
      return (data ?? []) as OpenRequest[];
    },
    refetchInterval: 15000,
  });

  async function donate(username: string, raw: string, requestId?: string) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("donate_coins", {
      _to_username: username,
      _amount: value,
      ...(requestId ? { _request_id: requestId } : {}),
    });
    setBusy(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({
        title: "Donation failed",
        description: error?.message ?? result?.error ?? "Try again",
        variant: "destructive",
      });
      return;
    }
    toast({ title: `Sent ${formatCurrency(value)} to ${username}` });
    setAmounts((a) => ({ ...a, [requestId ?? "direct"]: "" }));
    if (!requestId) setDirectAmount("");
    await refresh();
    refetch();
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 py-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            <span className="text-primary neon-text-primary">Orders</span> board
          </h1>
          <p className="text-muted-foreground mt-2">
            Players asking for a lift. Fund an order and your donated stat climbs.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-white/5 font-display font-bold flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-accent" />
                Open requests
              </div>
              {!requests?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  No open orders right now.{" "}
                  <Link to="/wallet" className="text-primary hover:underline">
                    Post one
                  </Link>
                  .
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {requests.map((r) => (
                    <li key={r.id} className="p-6 space-y-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar
                          username={r.username}
                          avatarUrl={r.avatar_url}
                          className="w-10 h-10"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/players/$username"
                            params={{ username: r.username }}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {r.username}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {safeLocaleDate(r.created_at)} · for {r.audience}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold">{formatCurrency(r.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(r.filled_amount)} funded
                          </div>
                        </div>
                      </div>
                      {r.note ? <p className="text-sm text-muted-foreground">{r.note}</p> : null}
                      {r.username !== user?.username ? (
                        <div className="flex gap-2">
                          <Input
                            inputMode="decimal"
                            placeholder="Amount"
                            value={amounts[r.id] ?? ""}
                            onChange={(e) =>
                              setAmounts((a) => ({ ...a, [r.id]: e.target.value }))
                            }
                          />
                          <Button
                            disabled={busy}
                            onClick={() => donate(r.username, amounts[r.id] ?? "", r.id)}
                          >
                            <Gift className="w-4 h-4 mr-1" />
                            Donate
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">This is your request.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/40 backdrop-blur-xl h-fit">
            <CardContent className="p-6 space-y-3">
              <div className="font-display font-bold flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                Direct donation
              </div>
              <Input
                placeholder="Username"
                value={directUser}
                onChange={(e) => setDirectUser(e.target.value)}
              />
              <Input
                inputMode="decimal"
                placeholder="Amount"
                value={directAmount}
                onChange={(e) => setDirectAmount(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={busy || !directUser.trim()}
                onClick={() => donate(directUser.trim(), directAmount)}
              >
                Send coins
              </Button>
              <p className="text-xs text-muted-foreground">
                Your balance: {formatCurrency(user?.balance ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
