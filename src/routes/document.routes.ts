import { Router } from "express";
import {
  getDocuments,
  getMyDocuments,
  getDocumentById,
  uploadDocument,
  reviewDocumentStatus,
  downloadDocument,
  streamDocument,
  deleteDocument,
} from "../controllers/document.controller";
import { upload } from "../config/multer";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-documents", getMyDocuments);
router.get("/stream/:filename", streamDocument);
router.get("/", getDocuments);
router.post("/upload", upload.single("file"), uploadDocument);
router.get("/:id", getDocumentById);
router.patch("/:id/status", restrictTo("AGENCY_ADMIN", "COUNSELOR"), reviewDocumentStatus);
router.patch("/:id/review", restrictTo("AGENCY_ADMIN", "COUNSELOR"), reviewDocumentStatus);
router.get("/:id/download", downloadDocument);
router.delete("/:id", deleteDocument);

export default router;
