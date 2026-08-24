import { Router } from "express";
import {
  getTasks,
  getMyTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/task.controller";
import { protect, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-tasks", getMyTasks);
router.get("/", getTasks);
router.post("/", createTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
