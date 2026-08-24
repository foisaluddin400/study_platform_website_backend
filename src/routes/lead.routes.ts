import { Router } from "express";
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  convertLeadToStudent,
  deleteLead,
} from "../controllers/lead.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/", getLeads);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createLead);
router.get("/:id", getLeadById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updateLead);
router.post("/:id/convert", restrictTo("AGENCY_ADMIN", "COUNSELOR"), convertLeadToStudent);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteLead);

export default router;

