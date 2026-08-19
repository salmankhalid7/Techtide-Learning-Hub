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
import taskRouter from "./task.routes.js";
import reviewRouter from "./review.routes.js";
import notificationRouter from "./notification.routes.js";
import announcementRouter from "./announcement.routes.js";import certificateRouter from "./certificate.routes.js";import paymentRouter from "./payment.routes.js";
import orderRouter from "./order.routes.js";
import couponRouter from "./coupon.routes.js";
import walletRouter from "./wallet.routes.js";
import payoutRouter from "./payout.routes.js";
import invoiceRouter from "./invoice.routes.js";
import { getApiInfo } from "../controllers/system.controller.js";
import dashboardRoutes from "./dashboard.routes.js";
import adminDashboardRoutes from "./admin-dashboard.routes.js";

const router = Router();

// ── API info ──────────────────────────────────────────────────────────────

router.get("/", getApiInfo);

// ── Platform ──────────────────────────────────────────────────────────────

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/uploads", uploadRouter);

// ── Course content (relative-path routers) ────────────────────────────────

// REVIEW + ANNOUNCEMENT + CERTIFICATE routers register course-scoped routes
// under /courses BEFORE courseRouter so their /courses/:courseId/reviews,
// .../rating, .../announcements and .../certificates are not shadowed by
// courseRouter's use(authenticate) guard.
router.use(reviewRouter);
router.use(announcementRouter);
router.use(certificateRouter);
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
router.use(taskRouter);
router.use(notificationRouter);
router.use(paymentRouter);
router.use(orderRouter);
router.use(couponRouter);
router.use(walletRouter);
router.use(payoutRouter);
router.use(invoiceRouter);
router.use("/instructor/dashboard", dashboardRoutes);
router.use("/admin/dashboard", adminDashboardRoutes);
export default router;