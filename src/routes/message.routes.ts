import { Router } from "express";
import {
  getMessages,
  sendMessage,
  getChatConversations,
  markMessagesSeen,
  deleteMessage,
} from "../controllers/message.controller";
import { protect, checkSubscription } from "../middlewares/auth";
import { requireAgency } from "../middlewares/tenant";

const router = Router();

router.use(protect, requireAgency, checkSubscription);

router.get("/conversations", getChatConversations);
router.get("/", getMessages);
router.post("/", sendMessage);
router.patch("/seen", markMessagesSeen);
router.post("/seen", markMessagesSeen);
router.delete("/:id", deleteMessage);

export default router;

