import { Router } from "express";
import { getCommissions, updateCommission } from "../controllers/commission.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/", restrictTo("AGENCY_ADMIN"), getCommissions);
router.patch("/:id", restrictTo("AGENCY_ADMIN"), updateCommission);

export default router;
