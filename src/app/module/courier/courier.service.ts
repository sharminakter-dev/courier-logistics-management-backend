import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import {
	AuthProvider,
	Role,
	ShipmentStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
import type { IRequestUser } from "../auth/auth.interface";
import type {
	ICreateCourierPayload,
	IUpdateCourierPayload,
} from "./courier.interface";

const userSelect = {
	id: true,
	name: true,
	email: true,
	phone: true,
	status: true,
};

// admin creates courier accounts (couriers cannot self-register)
const createCourier = async (payload: ICreateCourierPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existing = await prisma.user.findUnique({
		where: { email },
		select: { id: true },
	});

	if (existing) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}

	if (payload.hubId) {
		const hub = await prisma.hub.findUnique({ where: { id: payload.hubId } });

		if (!hub || !hub.isActive) {
			throw new AppError(httpStatus.BAD_REQUEST, "Hub not found or inactive");
		}
	}

	const hashedPassword = await bcrypt.hash(payload.password, config.bcrypt_salt_rounds);

	// user + courier profile are created in one query (one transaction)
	return prisma.user.create({
		data: {
			name: payload.name,
			email,
			phone: payload.phone,
			password: hashedPassword,
			role: Role.COURIER,
			status: UserStatus.ACTIVE,
			authProvider: AuthProvider.CREDENTIAL,
			emailVerified: true,
			courier: {
				create: { vehicleType: payload.vehicleType, hubId: payload.hubId },
			},
		},
		omit: { password: true },
		include: { courier: true },
	});
};

const getAllCouriers = async (query: Record<string, any>) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		...(query.isAvailable ? { isAvailable: query.isAvailable === "true" } : {}),
		...(query.hubId ? { hubId: String(query.hubId) } : {}),
		...(query.searchTerm
			? {
					user: {
						name: {
							contains: String(query.searchTerm),
							mode: "insensitive" as const,
						},
					},
				}
			: {}),
	};

	const [data, total] = await Promise.all([
		prisma.courier.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				user: { select: userSelect },
				hub: { select: { id: true, name: true, city: true } },
			},
		}),
		prisma.courier.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const getCourierById = async (id: string) => {
	const courier = await prisma.courier.findUnique({
		where: { id },
		include: { user: { select: userSelect }, hub: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
	}

	return courier;
};

const getMyProfile = async (user: IRequestUser) => {
	const courier = await prisma.courier.findUnique({
		where: { userId: user.userId },
		include: { user: { select: userSelect }, hub: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found");
	}

	const [delivered, active] = await Promise.all([
		prisma.shipment.count({
			where: { courierId: courier.id, status: ShipmentStatus.DELIVERED },
		}),
		prisma.shipment.count({
			where: {
				courierId: courier.id,
				status: {
					in: [
						ShipmentStatus.COURIER_ASSIGNED,
						ShipmentStatus.PICKED_UP,
						ShipmentStatus.AT_ORIGIN_HUB,
						ShipmentStatus.IN_TRANSIT,
						ShipmentStatus.AT_DESTINATION_HUB,
						ShipmentStatus.OUT_FOR_DELIVERY,
					],
				},
			},
		}),
	]);

	return { ...courier, stats: { delivered, active } };
};

const updateAvailability = async (user: IRequestUser, isAvailable: boolean) => {
	const courier = await prisma.courier.findUnique({
		where: { userId: user.userId },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found");
	}

	return prisma.courier.update({
		where: { id: courier.id },
		data: { isAvailable },
		select: { id: true, isAvailable: true },
	});
};

// the courier's own tasks
const getMyShipments = async (user: IRequestUser, query: Record<string, any>) => {
	const courier = await prisma.courier.findUnique({
		where: { userId: user.userId },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found");
	}

	const { page, limit, skip } = getPagination(query);

	const where = {
		courierId: courier.id,
		...(query.status ? { status: query.status as ShipmentStatus } : {}),
	};

	const [data, total] = await Promise.all([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				trackingNumber: true,
				status: true,
				deliveryType: true,
				deliveryAttempts: true,
				pickupName: true,
				pickupPhone: true,
				pickupAddress: true,
				pickupCity: true,
				pickupScheduledAt: true,
				receiverName: true,
				receiverPhone: true,
				receiverAddress: true,
				receiverCity: true,
				parcelDescription: true,
				weightKg: true,
			},
		}),
		prisma.shipment.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const updateCourier = async (id: string, payload: IUpdateCourierPayload) => {
	const courier = await getCourierById(id);
	const { status, ...courierData } = payload;

	return prisma.$transaction(async (tx) => {
		if (status) {
			await tx.user.update({ where: { id: courier.userId }, data: { status } });
		}

		return tx.courier.update({
			where: { id },
			data: courierData,
			include: { user: { select: userSelect } },
		});
	});
};

export const CourierService = {
	createCourier,
	getAllCouriers,
	getCourierById,
	getMyProfile,
	updateAvailability,
	getMyShipments,
	updateCourier,
};