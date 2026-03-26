import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(poolRouter);
router.use(gamesRouter);
router.use(miniGamesRouter);
router.use(transactionsRouter);
router.use(leaderboardRouter);
router.use(adminRouter);
router.use(transferRouter);

export default router;
