import { Router } from "express";

import healthRouter from "./health.routes.js";
import authRouter from "./auth.routes.js";
import userRouter from "./user.routes.js";
import courseRouter from "./course.routes.js";
import categoryRouter from "./category.routes.js";
import lessonRouter from "./lesson.routes.js";
import enrollmentRouter from "./enrollment.routes.js";
import uploadRouter from "./upload.routes.js";
import moduleRouter from "./module.routes.js";
import quizRouter from "./quiz.routes.js";
import questionRouter from "./question.routes.js";
import attemptRouter from "./attempt.routes.js";
import progressRouter from "./progress.routes.js";
import { getApiInfo } from "../controllers/system.controller.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

// ── API info ──────────────────────────────────────────────────────────────

router.get("/", getApiInfo);

// ── Platform ──────────────────────────────────────────────────────────────

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/uploads", uploadRouter);

// ── Course content (relative-path routers) ────────────────────────────────

router.use("/courses", courseRouter);
router.use("/categories", categoryRouter);
router.use("/modules", moduleRouter);
router.use("/lessons", lessonRouter);

// ── Fully-qualified routers (define their own resource paths) ─────────────

router.use(quizRouter);
router.use(questionRouter);
router.use(attemptRouter);
router.use(enrollmentRouter);
router.use(progressRouter);
router.use("/instructor/dashboard", dashboardRoutes);
export default router;