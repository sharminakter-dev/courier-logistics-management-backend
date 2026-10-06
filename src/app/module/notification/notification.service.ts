import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
import type { IRequestUser } from "../auth/auth.interface";

const getMyNotifications = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		userId: user.userId,
		...(query.isRead ? { isRead: query.isRead === "true" } : {}),
	};

	const [data, total] = await Promise.all([
		prisma.notification.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.notification.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const getUnreadCount = async (user: IRequestUser) => {
	const unreadCount = await prisma.notification.count({
		where: { userId: user.userId, isRead: false },
	});

	return { unreadCount };
};

const markAsRead = async (user: IRequestUser, id: string) => {
	const result = await prisma.notification.updateMany({
		where: { id, userId: user.userId },
		data: { isRead: true },
	});

	if (result.count === 0) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	return { id };
};

const markAllAsRead = async (user: IRequestUser) => {
	const result = await prisma.notification.updateMany({
		where: { userId: user.userId, isRead: false },
		data: { isRead: true },
	});

	return { updated: result.count };
};

export const NotificationService = {
	getMyNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
};