import { Router } from "express";
import {
  getStudents,
  getStudentById,
  getStudentMe,
  getStudentDashboardSummary,
  createStudent,
  updateStudent,
  deleteStudent,
  blockStudent,
  unblockStudent,
} from "../controllers/student.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";
import { upload } from "../config/multer";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/me", getStudentMe);
router.patch("/me", upload.single("avatar"), updateStudent);
router.get("/dashboard-summary", getStudentDashboardSummary);
router.get("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), getStudents);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createStudent);
router.get("/:id", getStudentById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR", "STUDENT"), upload.single("avatar"), updateStudent);
router.patch("/:id/block", restrictTo("AGENCY_ADMIN", "COUNSELOR"), blockStudent);
router.patch("/:id/unblock", restrictTo("AGENCY_ADMIN", "COUNSELOR"), unblockStudent);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteStudent);

export default router;

