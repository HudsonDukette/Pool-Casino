import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Games from "@/pages/games";
import Roulette from "@/pages/roulette";
import Plinko from "@/pages/plinko";
import Dice from "@/pages/dice";
import CoinFlip from "@/pages/coinflip";
import Crash from "@/pages/crash";
import Slots from "@/pages/slots";
import Wheel from "@/pages/wheel";
import Guess from "@/pages/guess";
import Mines from "@/pages/mines";
import Blackjack from "@/pages/blackjack";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import Chat from "@/pages/chat";
import Leaderboard from "@/pages/leaderboard";
import { Login, Register } from "@/pages/auth";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/games" component={Games} />
        <Route path="/games/roulette" component={Roulette} />
        <Route path="/games/plinko" component={Plinko} />
        <Route path="/games/dice" component={Dice} />
        <Route path="/games/coinflip" component={CoinFlip} />
        <Route path="/games/crash" component={Crash} />
        <Route path="/games/slots" component={Slots} />
        <Route path="/games/wheel" component={Wheel} />
        <Route path="/games/guess" component={Guess} />
        <Route path="/games/mines" component={Mines} />
        <Route path="/games/blackjack" component={Blackjack} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin" component={Admin} />
        <Route path="/chat" component={Chat} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
