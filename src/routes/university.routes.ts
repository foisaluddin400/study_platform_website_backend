import { Router } from "express";
import {
  getUniversities,
  getUniversityById,
  createUniversity,
  updateUniversity,
  deleteUniversity,
} from "../controllers/university.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/", getUniversities);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createUniversity);
router.get("/:id", getUniversityById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updateUniversity);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteUniversity);

export default router;

