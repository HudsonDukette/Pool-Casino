import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import { MatchmakingBar } from "@/components/MatchmakingBar";
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
import HighLow from "@/pages/highlow";
import DoubleDice from "@/pages/doubledice";
import Ladder from "@/pages/ladder";
import War from "@/pages/war";
import Target from "@/pages/target";
import IceBreak from "@/pages/icebreak";
import AdvWheel from "@/pages/advwheel";
import RangeBet from "@/pages/range";
import Pyramid from "@/pages/pyramid";
import Lightning from "@/pages/lightning";
import Multiplayer from "@/pages/multiplayer";
import WarPvP from "@/pages/war-pvp";
import HighLowPvP from "@/pages/highlow-pvp";
import Badges from "@/pages/badges";
import Casinos from "@/pages/casinos";
import Profile from "@/pages/profile";
import PlayerProfile from "@/pages/player";
import Admin from "@/pages/admin";
import Chat from "@/pages/chat";
import Notifications from "@/pages/notifications";
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
        <Route path="/games/highlow" component={HighLow} />
        <Route path="/games/doubledice" component={DoubleDice} />
        <Route path="/games/ladder" component={Ladder} />
        <Route path="/games/war" component={War} />
        <Route path="/games/target" component={Target} />
        <Route path="/games/icebreak" component={IceBreak} />
        <Route path="/games/advwheel" component={AdvWheel} />
        <Route path="/games/range" component={RangeBet} />
        <Route path="/games/pyramid" component={Pyramid} />
        <Route path="/games/lightning" component={Lightning} />
        <Route path="/multiplayer" component={Multiplayer} />
        <Route path="/multiplayer/war" component={WarPvP} />
        <Route path="/multiplayer/highlow" component={HighLowPvP} />
        <Route path="/badges" component={Badges} />
        <Route path="/casinos" component={Casinos} />
        <Route path="/profile" component={Profile} />
        <Route path="/player/:username" component={PlayerProfile} />
        <Route path="/admin" component={Admin} />
        <Route path="/chat" component={Chat} />
        <Route path="/notifications" component={Notifications} />
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
          <MultiplayerProvider>
            <Router />
            <MatchmakingBar />
          </MultiplayerProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
