import { Router } from "express";

import {
  getHealthStatus,
} from "../controllers/system.controller.js";

const router = Router();

/**
 * Health check endpoint.
 */
router.get("/", getHealthStatus);

export default router;