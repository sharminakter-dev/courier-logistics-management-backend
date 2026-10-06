import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

// auth() with no roles = any logged-in user
router.get("/", auth(), NotificationController.getMyNotifications);
router.get("/unread-count", auth(), NotificationController.getUnreadCount);
router.patch("/read-all", auth(), NotificationController.markAllAsRead);
router.patch("/:id/read", auth(), NotificationController.markAsRead);

export const NotificationRoutes = router;