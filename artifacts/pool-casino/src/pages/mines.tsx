import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function Mines() {
  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-6">
      <Card className="bg-card/40 border-yellow-500/20">
        <CardContent className="p-10 space-y-4">
          <p className="text-5xl">🔧</p>
          <h2 className="text-2xl font-display font-bold text-white">Mines — Under Maintenance</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This game is temporarily unavailable while we rebalance it. Check back soon!
          </p>
          <Link href="/games">
            <Button variant="outline" className="gap-2 border-white/10 mt-2">
              <ArrowLeft className="w-4 h-4" /> Back to Games
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
