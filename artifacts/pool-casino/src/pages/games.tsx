import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Games() {
  const games = [
    {
      id: "roulette",
      name: "Neon Roulette",
      description: "Classic red or black with dynamic odds based on the global pool.",
      image: "roulette-icon.png",
      href: "/games/roulette",
      active: true,
      color: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(0,255,170,0.15)]",
      titleColor: "group-hover:text-primary",
      imageEffect: "group-hover:rotate-180 transition-transform duration-1000",
    },
    {
      id: "plinko",
      name: "Drop Plinko",
      description: "Drop the ball through the pegs. Control your risk for massive multipliers.",
      image: "plinko-icon.png",
      href: "/games/plinko",
      active: true,
      color: "group-hover:border-secondary/50 group-hover:shadow-[0_0_30px_rgba(255,0,255,0.15)]",
      titleColor: "group-hover:text-secondary",
      imageEffect: "group-hover:-translate-y-2 transition-transform duration-500",
    },
    {
      id: "blackjack",
      name: "Blackjack",
      description: "Race to 21 against the dealer. High stakes table games.",
      image: "roulette-icon.png", // reusing as placeholder
      href: "#",
      active: false,
      color: "opacity-60 cursor-not-allowed",
      titleColor: "",
      imageEffect: "grayscale opacity-50",
    },
    {
      id: "crash",
      name: "Crash",
      description: "Watch the multiplier climb and cash out before it crashes.",
      image: "plinko-icon.png", // reusing as placeholder
      href: "#",
      active: false,
      color: "opacity-60 cursor-not-allowed",
      titleColor: "",
      imageEffect: "grayscale opacity-50",
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-4 pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-display font-bold">Casino Games</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Choose your game. Every bet affects the global pool economy.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {games.map((game) => {
          const content = (
            <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/5 relative ${game.color}`}>
              {!game.active && (
                <div className="absolute top-4 right-4 z-20">
                  <Badge variant="outline" className="bg-black/80 backdrop-blur-md">Coming Soon</Badge>
                </div>
              )}
              <CardContent className="p-0 flex flex-col h-[360px]">
                <div className="h-3/5 bg-black/40 flex items-center justify-center p-8 relative overflow-hidden border-b border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
                  <img 
                    src={`${import.meta.env.BASE_URL}images/${game.image}`} 
                    alt={game.name} 
                    className={`w-32 h-32 object-contain relative z-20 ${game.imageEffect}`} 
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center">
                  <h3 className={`text-2xl font-display font-bold transition-colors ${game.titleColor}`}>
                    {game.name}
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm line-clamp-2">
                    {game.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );

          if (game.active) {
            return (
              <Link key={game.id} href={game.href} className="block group">
                {content}
              </Link>
            );
          }

          return <div key={game.id} className="group">{content}</div>;
        })}
      </div>
    </div>
  );
}
