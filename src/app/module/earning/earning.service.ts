import httpStatus from "http-status";
import { EarningStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
import type { IRequestUser } from "../auth/auth.interface";
import { notifyUser } from "../notification/notification.utils";
import type { IPayoutPayload } from "./earning.interface";

const getMyEarnings = async (user: IRequestUser, query: Record<string, any>) => {
	const courier = await prisma.courier.findUnique({
		where: { userId: user.userId },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found");
	}

	const { page, limit, skip } = getPagination(query);

	const where = {
		courierId: courier.id,
		...(query.status ? { status: query.status as EarningStatus } : {}),
	};

	const [data, total, grouped] = await Promise.all([
		prisma.courierEarning.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true, deliveredAt: true } },
			},
		}),
		prisma.courierEarning.count({ where }),
		prisma.courierEarning.groupBy({
			by: ["status"],
			where: { courierId: courier.id },
			_sum: { amount: true },
		}),
	]);

	const pending = Number(
		grouped.find((g) => g.status === EarningStatus.PENDING)?._sum.amount ?? 0,
	);
	const paid = Number(
		grouped.find((g) => g.status === EarningStatus.PAID)?._sum.amount ?? 0,
	);

	return {
		data,
		summary: { pending, paid, total: pending + paid },
		meta: buildMeta(page, limit, total),
	};
};

const getAllEarnings = async (query: Record<string, any>) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		...(query.status ? { status: query.status as EarningStatus } : {}),
		...(query.courierId ? { courierId: String(query.courierId) } : {}),
	};

	const [data, total] = await Promise.all([
		prisma.courierEarning.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true } },
				courier: { include: { user: { select: { name: true } } } },
			},
		}),
		prisma.courierEarning.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

// pay all pending earnings of one courier
const payoutCourier = async (payload: IPayoutPayload) => {
	const courier = await prisma.courier.findUnique({
		where: { id: payload.courierId },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
	}

	return prisma.$transaction(async (tx) => {
		const pending = await tx.courierEarning.findMany({
			where: { courierId: courier.id, status: EarningStatus.PENDING },
			select: { id: true, amount: true },
		});

		if (pending.length === 0) {
			throw new AppError(httpStatus.BAD_REQUEST, "No pending earnings to pay");
		}

		const updated = await tx.courierEarning.updateMany({
			where: {
				id: { in: pending.map((e) => e.id) },
				status: EarningStatus.PENDING,
			},
			data: { status: EarningStatus.PAID, paidAt: new Date() },
		});

		// someone else paid some of them at the same time -> rollback
		if (updated.count !== pending.length) {
			throw new AppError(httpStatus.CONFLICT, "Earnings changed. Please try again.");
		}

		const totalPaid = pending.reduce((sum, e) => sum + Number(e.amount), 0);

		await notifyUser(tx, {
			userId: courier.userId,
			title: "Payout sent",
			message: `Your earnings of BDT ${totalPaid.toFixed(2)} have been paid.`,
		});

		return { courierId: courier.id, count: updated.count, totalPaid };
	});
};

export const EarningService = {
	getMyEarnings,
	getAllEarnings,
	payoutCourier,
};