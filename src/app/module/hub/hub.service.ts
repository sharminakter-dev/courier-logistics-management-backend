import httpStatus from "http-status";
import { TransferStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
import type {
	ICreateHubPayload,
	ICreateZonePayload,
	IUpdateHubPayload,
	IUpdateZonePayload,
} from "./hub.interface";

// duplicate name/code -> Prisma P2002 -> 409 from the global error handler
const createHub = async (payload: ICreateHubPayload) => {
	return prisma.hub.create({ data: payload });
};

const getAllHubs = async (query: Record<string, any>) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		...(query.isActive ? { isActive: query.isActive === "true" } : {}),
		...(query.city
			? { city: { equals: String(query.city), mode: "insensitive" as const } }
			: {}),
	};

	const [data, total] = await Promise.all([
		prisma.hub.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: { _count: { select: { zones: true, couriers: true } } },
		}),
		prisma.hub.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const getHubById = async (id: string) => {
	const hub = await prisma.hub.findUnique({
		where: { id },
		include: { zones: true, _count: { select: { couriers: true } } },
	});

	if (!hub) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found");
	}

	return hub;
};

const updateHub = async (id: string, payload: IUpdateHubPayload) => {
	await getHubById(id);
	return prisma.hub.update({ where: { id }, data: payload });
};

// deactivate (soft delete) so old shipments keep their history
const deleteHub = async (id: string) => {
	await getHubById(id);

	const activeTransfers = await prisma.hubTransfer.count({
		where: {
			status: TransferStatus.IN_TRANSIT,
			OR: [{ fromHubId: id }, { toHubId: id }],
		},
	});

	if (activeTransfers > 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Hub has transfers in progress and cannot be deactivated",
		);
	}

	return prisma.hub.update({ where: { id }, data: { isActive: false } });
};

const createZone = async (hubId: string, payload: ICreateZonePayload) => {
	await getHubById(hubId);
	return prisma.zone.create({ data: { hubId, ...payload } });
};

const getZones = async (hubId: string) => {
	await getHubById(hubId);
	return prisma.zone.findMany({ where: { hubId }, orderBy: { name: "asc" } });
};

const updateZone = async (zoneId: string, payload: IUpdateZonePayload) => {
	const zone = await prisma.zone.findUnique({ where: { id: zoneId } });

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
	}

	return prisma.zone.update({ where: { id: zoneId }, data: payload });
};

const deleteZone = async (zoneId: string) => {
	const zone = await prisma.zone.findUnique({ where: { id: zoneId } });

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
	}

	await prisma.zone.delete({ where: { id: zoneId } });
	return { id: zoneId };
};

export const HubService = {
	createHub,
	getAllHubs,
	getHubById,
	updateHub,
	deleteHub,
	createZone,
	getZones,
	updateZone,
	deleteZone,
};