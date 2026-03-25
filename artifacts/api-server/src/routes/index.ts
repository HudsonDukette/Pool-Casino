import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import poolRouter from "./pool";
import gamesRouter from "./games";
import transactionsRouter from "./transactions";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(poolRouter);
router.use(gamesRouter);
router.use(transactionsRouter);
router.use(leaderboardRouter);

export default router;
