import { Router } from "express";
import {
  getAgencyProfile,
  updateAgencyProfile,
  getBranches,
  addBranch,
  updateNotificationsConfig,
  updateOperatingCountries,
} from "../controllers/agency.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";
import { upload } from "../config/multer";

const router = Router();

router.use(protect, requireAgency);

router.get("/profile", getAgencyProfile);
router.patch("/profile", checkSubscription, restrictTo("AGENCY_ADMIN"), upload.single("logo"), updateAgencyProfile);
router.patch("/operating-countries", checkSubscription, restrictTo("AGENCY_ADMIN"), updateOperatingCountries);
router.get("/branches", getBranches);
router.post("/branches", checkSubscription, restrictTo("AGENCY_ADMIN"), addBranch);
router.patch("/notifications-config", checkSubscription, restrictTo("AGENCY_ADMIN"), updateNotificationsConfig);

export default router;
