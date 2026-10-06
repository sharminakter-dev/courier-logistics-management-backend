import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { getUser } from "../../utils/getUser";
import { sendResponse } from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await NotificationService.getMyNotifications(
		getUser(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notifications fetched successfully",
		data,
		meta,
	});
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
	const result = await NotificationService.getUnreadCount(getUser(req));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Unread count fetched successfully",
		data: result,
	});
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
	const result = await NotificationService.markAsRead(
		getUser(req),
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification marked as read",
		data: result,
	});
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
	const result = await NotificationService.markAllAsRead(getUser(req));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All notifications marked as read",
		data: result,
	});
});

export const NotificationController = {
	getMyNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
};