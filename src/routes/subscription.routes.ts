import { Router } from "express";
import {
  getCurrentSubscription,
  upgradeSubscription,
  activateFreeAccess,
} from "../controllers/subscription.controller";
import { protect, restrictTo } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency);

router.get("/current", getCurrentSubscription);
router.post("/activate-free-access", restrictTo("AGENCY_ADMIN", "PLATFORM_SUPER_ADMIN"), activateFreeAccess);
router.post("/upgrade", restrictTo("AGENCY_ADMIN", "PLATFORM_SUPER_ADMIN"), upgradeSubscription);

export default router;
