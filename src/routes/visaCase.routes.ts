import { Router } from "express";
import {
  getVisaCases,
  getMyVisaCase,
  getVisaCaseById,
  createVisaCase,
  updateVisaCase,
  deleteVisaCase,
} from "../controllers/visaCase.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-case", getMyVisaCase);
router.get("/my-visa-case", getMyVisaCase);
router.get("/", getVisaCases);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createVisaCase);
router.get("/:id", getVisaCaseById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updateVisaCase);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteVisaCase);

export default router;
