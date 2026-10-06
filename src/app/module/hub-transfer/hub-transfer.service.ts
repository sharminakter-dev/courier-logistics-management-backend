import httpStatus from "http-status";
import {
	ShipmentStatus,
	TransferStatus,
} from "../../../generated/prisma/enums";
import { cache } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
import type { IRequestUser } from "../auth/auth.interface";
import { notifyUser } from "../notification/notification.utils";
import type {
	ICreateTransferPayload,
	IReceiveTransferPayload,
} from "./hub-transfer.interface";

const transferInclude = {
	fromHub: { select: { id: true, name: true, city: true } },
	toHub: { select: { id: true, name: true, city: true } },
	shipment: { select: { id: true, trackingNumber: true, status: true } },
};

// dispatch: AT_ORIGIN_HUB -> IN_TRANSIT
const createTransfer = async (
	user: IRequestUser,
	payload: ICreateTransferPayload,
) => {
	const { shipmentId, fromHubId, toHubId, note } = payload;

	if (fromHubId === toHubId) {
		throw new AppError(httpStatus.BAD_REQUEST, "From and to hub must be different");
	}

	const [fromHub, toHub, shipment] = await Promise.all([
		prisma.hub.findUnique({ where: { id: fromHubId } }),
		prisma.hub.findUnique({ where: { id: toHubId } }),
		prisma.shipment.findUnique({
			where: { id: shipmentId },
			include: { customer: { select: { userId: true } } },
		}),
	]);

	if (!fromHub || !toHub) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found");
	}

	if (!fromHub.isActive || !toHub.isActive) {
		throw new AppError(httpStatus.BAD_REQUEST, "Hub is not active");
	}

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (shipment.status !== ShipmentStatus.AT_ORIGIN_HUB) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Shipment must be at the origin hub before it can be dispatched",
		);
	}

	const transfer = await prisma.$transaction(async (tx) => {
		// "where status = AT_ORIGIN_HUB" stops double dispatch
		const updated = await tx.shipment.updateMany({
			where: { id: shipmentId, status: ShipmentStatus.AT_ORIGIN_HUB },
			data: { status: ShipmentStatus.IN_TRANSIT },
		});

		if (updated.count === 0) {
			throw new AppError(httpStatus.CONFLICT, "Shipment was already dispatched");
		}

		const created = await tx.hubTransfer.create({
			data: { shipmentId, fromHubId, toHubId, note, dispatchedById: user.userId },
			include: transferInclude,
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: ShipmentStatus.IN_TRANSIT,
				note: `Dispatched from ${fromHub.name} to ${toHub.name}`,
				location: fromHub.city,
				updatedById: user.userId,
			},
		});

		await notifyUser(tx, {
			userId: shipment.customer.userId,
			title: "Shipment in transit",
			message: `Your shipment ${shipment.trackingNumber} left ${fromHub.name} and is on its way to ${toHub.name}.`,
			shipmentId,
		});

		return created;
	});

	await cache.del(`tracking:${shipment.trackingNumber}`);

	return transfer;
};

// receive: IN_TRANSIT -> AT_DESTINATION_HUB
const receiveTransfer = async (
	user: IRequestUser,
	id: string,
	payload: IReceiveTransferPayload,
) => {
	const transfer = await prisma.hubTransfer.findUnique({
		where: { id },
		include: {
			toHub: true,
			shipment: { include: { customer: { select: { userId: true } } } },
		},
	});

	if (!transfer) {
		throw new AppError(httpStatus.NOT_FOUND, "Transfer not found");
	}

	if (transfer.status !== TransferStatus.IN_TRANSIT) {
		throw new AppError(httpStatus.CONFLICT, "Transfer is already received");
	}

	const result = await prisma.$transaction(async (tx) => {
		const transferUpdate = await tx.hubTransfer.updateMany({
			where: { id, status: TransferStatus.IN_TRANSIT },
			data: {
				status: TransferStatus.RECEIVED,
				receivedAt: new Date(),
				receivedById: user.userId,
			},
		});

		const shipmentUpdate = await tx.shipment.updateMany({
			where: { id: transfer.shipmentId, status: ShipmentStatus.IN_TRANSIT },
			data: { status: ShipmentStatus.AT_DESTINATION_HUB },
		});

		// if either update did nothing the whole transaction is rolled back
		if (transferUpdate.count === 0 || shipmentUpdate.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Transfer or shipment was updated by someone else. Please refresh.",
			);
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId: transfer.shipmentId,
				status: ShipmentStatus.AT_DESTINATION_HUB,
				note: payload?.note ?? `Arrived at ${transfer.toHub.name}`,
				location: transfer.toHub.city,
				updatedById: user.userId,
			},
		});

		await notifyUser(tx, {
			userId: transfer.shipment.customer.userId,
			title: "Shipment arrived at destination hub",
			message: `Your shipment ${transfer.shipment.trackingNumber} arrived at ${transfer.toHub.name}.`,
			shipmentId: transfer.shipmentId,
		});

		return tx.hubTransfer.findUnique({
			where: { id },
			include: transferInclude,
		});
	});

	await cache.del(`tracking:${transfer.shipment.trackingNumber}`);

	return result;
};

const getTransfers = async (query: Record<string, any>) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		...(query.status ? { status: query.status as TransferStatus } : {}),
		...(query.shipmentId ? { shipmentId: String(query.shipmentId) } : {}),
		...(query.fromHubId ? { fromHubId: String(query.fromHubId) } : {}),
		...(query.toHubId ? { toHubId: String(query.toHubId) } : {}),
	};

	const [data, total] = await Promise.all([
		prisma.hubTransfer.findMany({
			where,
			skip,
			take: limit,
			orderBy: { dispatchedAt: "desc" },
			include: transferInclude,
		}),
		prisma.hubTransfer.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const getTransferById = async (id: string) => {
	const transfer = await prisma.hubTransfer.findUnique({
		where: { id },
		include: transferInclude,
	});

	if (!transfer) {
		throw new AppError(httpStatus.NOT_FOUND, "Transfer not found");
	}

	return transfer;
};

export const HubTransferService = {
	createTransfer,
	receiveTransfer,
	getTransfers,
	getTransferById,
};