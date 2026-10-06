import { Prisma } from "../../../generated/prisma/client";
import {
	EarningStatus,
	PaymentStatus,
	ShipmentStatus,
} from "../../../generated/prisma/enums";
import { cache } from "../../lib/cache";
import { prisma } from "../../lib/prisma";

// cached in Redis for 60 seconds
const getOverview = async () => {
	return cache.getOrSet("analytics:overview", 60, async () => {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [
			totalShipments,
			todayShipments,
			byStatus,
			paid,
			refunded,
			totalCouriers,
			availableCouriers,
			totalCustomers,
			pendingEarnings,
			activeHubs,
		] = await Promise.all([
			prisma.shipment.count(),
			prisma.shipment.count({ where: { createdAt: { gte: todayStart } } }),
			prisma.shipment.groupBy({ by: ["status"], _count: { _all: true } }),
			prisma.payment.aggregate({
				where: { status: PaymentStatus.PAID },
				_sum: { amount: true },
			}),
			prisma.payment.aggregate({
				where: { status: PaymentStatus.REFUNDED },
				_sum: { amount: true },
			}),
			prisma.courier.count(),
			prisma.courier.count({ where: { isAvailable: true } }),
			prisma.customer.count(),
			prisma.courierEarning.aggregate({
				where: { status: EarningStatus.PENDING },
				_sum: { amount: true },
			}),
			prisma.hub.count({ where: { isActive: true } }),
		]);

		// every status is listed, even when the count is 0
		const statusCounts = Object.fromEntries(
			Object.values(ShipmentStatus).map((s) => [s, 0]),
		) as Record<string, number>;

		for (const row of byStatus) {
			statusCounts[row.status] = row._count._all;
		}

		const delivered = statusCounts[ShipmentStatus.DELIVERED] ?? 0;
		const returned = statusCounts[ShipmentStatus.RETURNED] ?? 0;
		const finished = delivered + returned;

		return {
			shipments: {
				total: totalShipments,
				today: todayShipments,
				byStatus: statusCounts,
				deliverySuccessRate:
					finished === 0 ? 0 : Math.round((delivered / finished) * 1000) / 10,
			},
			revenue: {
				// revenue = payments that are still PAID (refunded ones are excluded)
				total: Number(paid._sum.amount ?? 0),
				refunded: Number(refunded._sum.amount ?? 0),
			},
			couriers: {
				total: totalCouriers,
				available: availableCouriers,
				pendingEarnings: Number(pendingEarnings._sum.amount ?? 0),
			},
			customers: { total: totalCustomers },
			hubs: { active: activeHubs },
		};
	});
};

// shipments + revenue per day
const getShipmentsTrend = async (query: Record<string, any>) => {
	const days = Math.min(90, Math.max(1, Number(query.days) || 30));
	const since = new Date();
	since.setDate(since.getDate() - days);

	const rows = await prisma.$queryRaw<
		{ date: string; shipments: number; revenue: number }[]
	>(Prisma.sql`
		SELECT TO_CHAR(DATE(s."createdAt"), 'YYYY-MM-DD') AS date,
		       COUNT(*)::int AS shipments,
		       COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END), 0)::float AS revenue
		FROM shipments s
		LEFT JOIN payments p ON p."shipmentId" = s.id
		WHERE s."createdAt" >= ${since}
		GROUP BY DATE(s."createdAt")
		ORDER BY DATE(s."createdAt") ASC
	`);

	return { days, trend: rows };
};

const getTopCouriers = async (query: Record<string, any>) => {
	const limit = Math.min(20, Math.max(1, Number(query.limit) || 5));

	const grouped = await prisma.shipment.groupBy({
		by: ["courierId"],
		where: { status: ShipmentStatus.DELIVERED, courierId: { not: null } },
		_count: { _all: true },
		orderBy: { _count: { courierId: "desc" } },
		take: limit,
	});

	const ids = grouped.map((g) => g.courierId as string);

	const couriers = await prisma.courier.findMany({
		where: { id: { in: ids } },
		include: { user: { select: { name: true } } },
	});

	return grouped.map((g) => ({
		courierId: g.courierId,
		name: couriers.find((c) => c.id === g.courierId)?.user.name ?? "Unknown",
		delivered: g._count._all,
	}));
};

export const AnalyticsService = {
	getOverview,
	getShipmentsTrend,
	getTopCouriers,
};