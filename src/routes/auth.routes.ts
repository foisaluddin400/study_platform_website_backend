import { Router } from "express";
import {
  registerAgency,
  login,
  getMe,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  testEmailDelivery,
  changePassword,
  updateProfile,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth";
import { upload } from "../config/multer";

const router = Router();

router.post("/register-agency", registerAgency);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/test-email", testEmailDelivery);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);
router.patch("/update-profile", protect, upload.single("avatar"), updateProfile);

export default router;
