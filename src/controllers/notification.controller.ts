import { Request, Response, NextFunction } from "express";
import { Notification } from "../models/Notification";
import { sendSuccess } from "../utils/apiResponse";

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notifications = await Notification.find({
      agencyId: req.user?.agencyId,
      user: req.user?.userId,
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    sendSuccess(res, "Notifications retrieved", {
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId, user: req.user?.userId },
      { isRead: true },
      { new: true }
    );

    const unreadCount = await Notification.countDocuments({
      agencyId: req.user?.agencyId,
      user: req.user?.userId,
      isRead: false,
    });

    sendSuccess(res, "Notification marked as read", {
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await Notification.updateMany(
      { agencyId: req.user?.agencyId, user: req.user?.userId, isRead: false },
      { isRead: true }
    );

    sendSuccess(res, "All notifications marked as read", {
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
      user: req.user?.userId,
    });

    const unreadCount = await Notification.countDocuments({
      agencyId: req.user?.agencyId,
      user: req.user?.userId,
      isRead: false,
    });

    sendSuccess(res, "Notification deleted successfully.", {
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};
