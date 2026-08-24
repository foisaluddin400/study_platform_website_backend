import { Router } from "express";
import {
  getDashboardAnalytics,
  getReportsAnalytics,
} from "../controllers/analytics.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/dashboard", restrictTo("AGENCY_ADMIN", "COUNSELOR"), getDashboardAnalytics);
router.get("/reports", restrictTo("AGENCY_ADMIN"), getReportsAnalytics);

export default router;
