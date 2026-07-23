import { Router } from "express";

import healthRouter from "./health.routes.js";
import authRouter from "./auth.routes.js";
import userRouter from "./user.routes.js";
import courseRouter from "./course.routes.js";
import categoryRouter from "./category.routes.js";
import lessonRouter from "./lesson.routes.js";
import enrollmentRouter from "./enrollment.routes.js";
import uploadRouter from "./upload.routes.js";

import {
  getApiInfo,
} from "../controllers/system.controller.js";


const router = Router();

/**
 * Root API endpoint.
 */
router.get("/", getApiInfo);

/**
 * Feature routes.
 */
router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/courses", courseRouter);
router.use("/categories", categoryRouter);
router.use("/lessons", lessonRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/uploads", uploadRouter);

export default router;