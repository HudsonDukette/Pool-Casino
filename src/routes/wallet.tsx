import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, safeLocaleDate } from "@/lib/utils";
import { Coins, HandCoins, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "Wallet & Transactions | Pool Casino" },
      {
        name: "description",
        content:
          "Track your Pool Casino balance, every bet and donation, and request coins from admins or fellow players.",
      },
      { property: "og:title", content: "Wallet & Transactions | Pool Casino" },
      {
        property: "og:description",
        content: "Your Pool Casino transaction history and coin requests in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Txn = {
  kind: string;
  description: string;
  amount: number;
  created_at: string;
};

function WalletPage() {
  const { user, isAuthenticated, loading, refresh } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [audience, setAudience] = React.useState<"anyone" | "admins" | "players">("anyone");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  const { data: txns } = useQuery({
    queryKey: ["my-transactions", user?.id],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_transactions", { _limit: 100 });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
    refetchInterval: 20000,
  });

  const { data: myRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("money_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("money_requests").insert({
      user_id: user!.id,
      amount: value,
      note,
      audience,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not post request", description: error.message, variant: "destructive" });
      return;
    }
    setAmount("");
    setNote("");
    toast({ title: "Request posted", description: "Generous players can now fund it in Orders." });
    refetchRequests();
    queryClient.invalidateQueries({ queryKey: ["open-requests"] });
  }

  async function cancelRequest(id: string) {
    const { error } = await supabase
      .from("money_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
      return;
    }
    refetchRequests();
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Your <span className="text-primary neon-text-primary">Wallet</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Every coin in and out, plus requests for help from the community.
            </p>
          </div>
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
            <CardContent className="px-6 py-4 flex items-center gap-3">
              <Coins className="w-5 h-5 text-accent" />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
                <div className="font-mono text-2xl font-bold">{formatCurrency(user?.balance ?? 0)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-white/5 font-display font-bold">
                Transaction history
              </div>
              {!txns?.length ? (
                <div className="p-8 text-center text-muted-foreground">No transactions yet.</div>
              ) : (
                <ul className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
                  {txns.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 px-6 py-3">
                      {Number(t.amount) >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{t.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.kind} · {safeLocaleDate(t.created_at)}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-bold ${
                          Number(t.amount) >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {formatCurrency(t.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 font-display font-bold">
                  <HandCoins className="w-4 h-4 text-accent" />
                  Request coins
                </div>
                <form onSubmit={submitRequest} className="space-y-3">
                  <Input
                    inputMode="decimal"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Input
                    placeholder="Why do you need it?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    {(["anyone", "admins", "players"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAudience(a)}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
                          audience === a
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-white/5 text-muted-foreground border border-white/5 hover:text-white"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Posting…" : "Post request"}
                  </Button>
                </form>
                <Link to="/orders" className="block text-xs text-muted-foreground hover:text-white">
                  Browse open orders →
                </Link>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
              <CardContent className="p-6 space-y-3">
                <div className="font-display font-bold">Your requests</div>
                {!myRequests?.length ? (
                  <p className="text-sm text-muted-foreground">No requests posted.</p>
                ) : (
                  myRequests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold">{formatCurrency(r.amount)}</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Funded {formatCurrency(r.filled_amount)} · {r.audience}
                      </div>
                      {r.note ? <p className="text-sm">{r.note}</p> : null}
                      {r.status === "open" ? (
                        <Button variant="ghost" size="sm" onClick={() => cancelRequest(r.id)}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
