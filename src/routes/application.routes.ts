import { Router } from "express";
import {
  getApplications,
  getMyApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../controllers/application.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-applications", getMyApplications);
router.get("/", getApplications);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createApplication);
router.get("/:id", getApplicationById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updateApplication);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteApplication);

export default router;


