import { Router } from "express";
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/course.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/", getCourses);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createCourse);
router.get("/:id", getCourseById);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updateCourse);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteCourse);

export default router;

