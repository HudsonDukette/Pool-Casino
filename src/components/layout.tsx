import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";

// Routes not yet ported keep working links without failing the typed-route check.
const AnyLink = Link as unknown as React.ComponentType<any>;
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Coins,
  LogOut,

  Menu,
  X,
  Dices,
  Crown,
  LayoutDashboard,
  MessageSquare,
  ShieldAlert,
  Gift,
  Heart,
  Sparkles,
  Smile,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPool } from "@/lib/pool.functions";
import { useSession } from "@/hooks/use-session";
import { PlayerAvatar } from "@/components/player-avatar";

const navLinks = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: "/chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
  { to: "/orders", label: "Orders", icon: <Gift className="w-4 h-4" /> },
  { to: "/leaderboard", label: "Leaderboards", icon: <Crown className="w-4 h-4" /> },
];


export function Layout({ children }: { children: React.ReactNode }) {
  const state = useRouterState();
  const location = state.location.pathname;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [gamesDropdownOpen, setGamesDropdownOpen] = React.useState(false);
  const gamesDropdownRef = React.useRef<HTMLDivElement>(null);
  const { user, isGuest } = useSession();

  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => getPool(),
    refetchInterval: 10000,
  });



  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        gamesDropdownRef.current &&
        !gamesDropdownRef.current.contains(e.target as Node)
      ) {
        setGamesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleLogout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast({ title: "Logged out", variant: "default" });
  };

  const isGamesActive =
    location.startsWith("/games") ||
    location === "/multiplayer" ||
    location === "/casinos";

  const isAdmin = user?.isAdmin === true;

  return (
    <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 min-h-screen overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-pink-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                to="/"
                className="flex items-center gap-3 group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all"
                >
                  <Dices className="w-6 h-6 text-white" />
                </motion.div>
                <div className="hidden sm:block">
                  <span className="font-display font-bold text-2xl tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    Pool
                  </span>
                  <span className="font-display font-bold text-2xl tracking-tight text-purple-600">
                    Casino
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-2 items-center">
              {navLinks.slice(0, 1).map((link) => {
                const isActive = location === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-medium transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? "bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-md" 
                        : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}

              {/* Games dropdown */}
              <div ref={gamesDropdownRef} className="relative">
                <button
                  onClick={() => setGamesDropdownOpen((o) => !o)}
                  className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-medium transition-all duration-300 cursor-pointer ${
                    isGamesActive
                      ? "bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-md"
                      : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                  }`}
                >
                  <Dices className="w-4 h-4" />
                  Games
                  <motion.span
                    animate={{ rotate: gamesDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-0.5"
                  >
                    ▼
                  </motion.span>
                </button>
                <AnimatePresence>
                  {gamesDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-3 w-64 rounded-3xl border border-pink-100 bg-white/95 backdrop-blur-2xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-3 space-y-1">
                        <Link
                          to="/games"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-4 py-3 rounded-2xl text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-pink-400" />
                          All Games
                        </Link>
                        <Link
                          to="/multiplayer"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-4 py-3 rounded-2xl text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2"
                        >
                          <Heart className="w-4 h-4 text-red-400" />
                          Multiplayer
                        </Link>
                        <AnyLink
                          to="/casinos"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-4 py-3 rounded-2xl text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2"
                        >
                          <Crown className="w-4 h-4 text-yellow-400" />
                          Player Casinos
                        </AnyLink>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navLinks.slice(1).map((link) => {
                const isActive = location === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-medium transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? "bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-md" 
                        : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}

              {isAdmin && (
                <AnyLink
                  to="/admin"
                  className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-medium transition-all duration-300 cursor-pointer ${
                    location === "/admin" 
                      ? "bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-md" 
                      : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Admin
                </AnyLink>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Pool stat */}
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200">
                <Coins className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Pool</span>
                <span className="text-sm font-mono font-bold text-purple-700">
                  {formatCurrency(pool?.totalAmount ?? 0)}
                </span>
              </div>

              {user && !isGuest ? (
                <div className="hidden sm:flex items-center gap-2">
                  <AnyLink
                    to="/wallet"
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 hover:shadow-md transition-all"
                  >
                    <Coins className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-mono font-bold text-purple-700">
                      {formatCurrency(user.balance)}
                    </span>
                  </AnyLink>
                  <AnyLink
                    to="/profile"
                    className="flex items-center gap-2 pl-2 pr-4 py-2 rounded-2xl bg-white border border-pink-200 hover:shadow-md transition-all text-sm font-medium"
                    aria-label="Your profile"
                  >
                    <PlayerAvatar
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      className="w-9 h-9 rounded-2xl text-xs"
                    />
                    <span className="max-w-[100px] truncate text-gray-700">{user.username}</span>
                  </AnyLink>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-2xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                    <Coins className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-mono font-bold text-purple-700">
                      {formatCurrency(user?.balance ?? 0)}
                    </span>
                    <span className="text-xs text-purple-500 font-semibold">Guest</span>
                  </div>
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="rounded-2xl text-gray-600 hover:text-purple-600">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 shadow-md">
                      Sign up
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2.5 rounded-2xl text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-pink-100 bg-white/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                      location === link.to 
                        ? "bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700" 
                        : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/games"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <Dices className="w-4 h-4" />
                  All Games
                </Link>
                {user && !isGuest ? (
                  <>
                    <AnyLink
                      to="/wallet"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      <Coins className="w-4 h-4 text-purple-500" />
                      Wallet
                    </AnyLink>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </>
                ) : (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                      <span className="text-sm text-gray-600">Guest tokens</span>
                      <span className="text-sm font-mono font-bold text-purple-700">
                        {formatCurrency(user?.balance ?? 0)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/login" className="flex-1">
                        <Button variant="outline" className="w-full rounded-2xl">
                          Log in
                        </Button>
                      </Link>
                      <Link to="/register" className="flex-1">
                        <Button className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500">
                          Sign up
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-pink-100 bg-white/50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center shadow-md"
            >
              <Dices className="w-5 h-5 text-white" />
            </motion.div>
            <span className="font-display font-bold text-gray-800">
              Pool<span className="text-purple-600">Casino</span>
            </span>
          </div>
          <p className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-pink-400" />
            Play responsibly. Every bet affects the Global Economy.
          </p>
          <div className="flex gap-4">
            <AnyLink to="/terms" className="hover:text-purple-600 transition-colors">
              Terms
            </AnyLink>
            <AnyLink to="/privacy" className="hover:text-purple-600 transition-colors">
              Privacy
            </AnyLink>
          </div>
        </div>
      </footer>
    </div>
  );
}