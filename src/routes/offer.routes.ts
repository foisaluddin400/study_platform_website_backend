import { Router } from "express";
import {
  getOffers,
  getMyOffers,
  getOfferById,
  createOffer,
  respondToOffer,
  updateOffer,
  deleteOffer,
  streamOfferLetter,
  downloadOfferLetter,
} from "../controllers/offer.controller";
import { upload } from "../config/multer";
import { protect, restrictTo, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/my-offers", getMyOffers);
router.get("/stream/:filename", streamOfferLetter);
router.get("/:id/download", downloadOfferLetter);
router.get("/", getOffers);
router.post("/", restrictTo("AGENCY_ADMIN", "COUNSELOR"), upload.single("offerLetter"), createOffer);
router.get("/:id", getOfferById);
router.patch("/:id/respond", respondToOffer);
router.patch("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), upload.single("offerLetter"), updateOffer);
router.delete("/:id", restrictTo("AGENCY_ADMIN", "COUNSELOR"), deleteOffer);

export default router;
