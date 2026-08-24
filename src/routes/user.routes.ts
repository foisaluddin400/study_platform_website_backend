import { Router } from "express";
import {
  getTeam,
  inviteTeamMember,
  updateTeamMember,
  blockTeamMember,
  unblockTeamMember,
  deleteTeamMember,
} from "../controllers/user.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/team", restrictTo("AGENCY_ADMIN", "COUNSELOR"), getTeam);
router.post("/team", restrictTo("AGENCY_ADMIN"), inviteTeamMember);
router.post("/invite", restrictTo("AGENCY_ADMIN"), inviteTeamMember);
router.patch("/team/:id", restrictTo("AGENCY_ADMIN"), updateTeamMember);
router.patch("/team/:id/block", restrictTo("AGENCY_ADMIN"), blockTeamMember);
router.patch("/team/:id/unblock", restrictTo("AGENCY_ADMIN"), unblockTeamMember);
router.delete("/team/:id", restrictTo("AGENCY_ADMIN"), deleteTeamMember);
router.get("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), getTeam);

export default router;

