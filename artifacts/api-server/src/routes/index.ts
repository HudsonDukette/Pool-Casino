import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import poolRouter from "./pool";
import gamesRouter from "./games";
import miniGamesRouter from "./mini-games";
import transactionsRouter from "./transactions";
import leaderboardRouter from "./leaderboard";
import adminRouter from "./admin";
import transferRouter from "./transfer";
import chatRouter from "./chat";
import friendsRouter from "./friends";
import moneyRequestsRouter from "./money-requests";
import pushRouter from "./push";
import reportsRouter from "./reports";
import newGamesRouter from "./new-games";
import newGames2Router from "./newgames2";
import badgesRouter from "./badges";
import casinosRouter from "./casinos";
import casinoChatRouter from "./casino-chat";
import multiplayerLobbiesRouter from "./multiplayer-lobbies";
import { isPoolPaused } from "../lib/pool-guard";

const router: IRouter = Router();

async function poolGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const paused = await isPoolPaused();
    if (paused) {
      res.status(503).json({
        error: "pool_paused",
        message: "The prize pool has been emptied. All house games are temporarily paused until an admin refills the pool.",
      });
      return;
    }
  } catch {
    // If the check fails, allow the request through so a DB hiccup doesn't kill all games
  }
  next();
}

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(poolRouter);
// Block all pool-backed game requests when pool is paused
router.use(["/games", "/mini-games"], poolGuard);
router.use(gamesRouter);
router.use(miniGamesRouter);
router.use(transactionsRouter);
router.use(leaderboardRouter);
router.use(adminRouter);
router.use(transferRouter);
router.use(chatRouter);
router.use(friendsRouter);
router.use(moneyRequestsRouter);
router.use(pushRouter);
router.use(reportsRouter);
// newGamesRouter uses /games/* paths so poolGuard above covers it
router.use(newGamesRouter);
// newGames2Router uses its own short paths — poolGuard applied inline (see pool-guard import in that file)
router.use(newGames2Router);
router.use(badgesRouter);
router.use(casinosRouter);
router.use(casinoChatRouter);
router.use(multiplayerLobbiesRouter);

export default router;
