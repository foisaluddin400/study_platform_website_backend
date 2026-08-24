import { Router } from "express";
import {
  getMyPayments,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../controllers/payment.controller";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-payments", getMyPayments);
router.get("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), getPayments);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), createPayment);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), updatePayment);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deletePayment);

export default router;

