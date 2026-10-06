import httpStatus from "http-status";
import {
	PaymentStatus,
	Role,
	ShipmentStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
	IAssignCourierPayload,
	ICancelShipmentPayload,
	ICreateShipmentPayload,
	IUpdateStatusPayload,
} from "./shipment.interface";
import {
	ALLOWED_TRANSITIONS,
	COURIER_ALLOWED_STATUSES,
	calculatePrice,
	generateTrackingNumber,
	isSameCity,
} from "./shipment.utils";
import { getPagination } from "../../utils/pagination";

const getBkashHeaders = async () => {
	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No bKash access token found");
	}

	return {
		"Content-Type": "application/json",
		Accept: "application/json",
		Authorization: bkashIdToken,
		"X-App-Key": config.bkash_app_key,
	};
};


const createShipment = async (
	user: IRequestUser,
	payload: ICreateShipmentPayload,
) => {
	const customer = await prisma.customer.findUnique({
		where: { userId: user.userId },
	});

	if (!customer) {
		throw new AppError(httpStatus.FORBIDDEN, "Customer profile not found");
	}

	const { pickup, receiver, weightKg, deliveryType } = payload;

	const price = calculatePrice({
		weightKg,
		deliveryType,
		sameCity: isSameCity(pickup.city, receiver.city),
	});
	const trackingNumber = generateTrackingNumber();

	// 1. create the payment at bKash
	const bkashResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: await getBkashHeaders(),
			body: JSON.stringify({
				mode: "0011",
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_api}/shipments/payment/callback`,
				amount: price.toFixed(2),
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: trackingNumber,
			}),
		},
	);

	const bkashResult = await bkashResponse.json();

	if (bkashResult.statusCode !== "0000") {
		throw new AppError(httpStatus.BAD_GATEWAY, "bKash payment failed to start");
	}

	// 2. save shipment + payment + first tracking event
	const shipment = await prisma.shipment.create({
		data: {
			trackingNumber,
			customerId: customer.id,
			deliveryType,
			weightKg,
			price,
			parcelDescription: payload.parcelDescription,
			pickupScheduledAt: payload.pickupScheduledAt,
			pickupName: pickup.name,
			pickupPhone: pickup.phone,
			pickupAddress: pickup.address,
			pickupCity: pickup.city,
			receiverName: receiver.name,
			receiverPhone: receiver.phone,
			receiverAddress: receiver.address,
			receiverCity: receiver.city,
			payment: {
				create: {
					amount: price,
					bkashPaymentId: bkashResult.paymentID,
					payerReference: user.email,
					gatewayResponse: bkashResult,
				},
			},
			trackingEvents: {
				create: {
					status: ShipmentStatus.PENDING_PAYMENT,
					note: "Shipment created. Waiting for payment.",
					updatedById: user.userId,
				},
			},
		},
		include: { payment: true },
	});

	return { shipment, paymentUrl: bkashResult.bkashURL };
};

// retry payment for a shipment that is still waiting for payment
const payShipment = async (user: IRequestUser, shipmentId: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { payment: true, customer: true },
	});

	if (!shipment || shipment.customer.userId !== user.userId) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (shipment.status !== ShipmentStatus.PENDING_PAYMENT || !shipment.payment) {
		throw new AppError(httpStatus.BAD_REQUEST, "Shipment is not pending payment");
	}

	const bkashResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: await getBkashHeaders(),
			body: JSON.stringify({
				mode: "0011",
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_api}/shipments/payment/callback`,
				amount: Number(shipment.payment.amount).toFixed(2), // amount from DB
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: shipment.trackingNumber,
			}),
		},
	);

	const bkashResult = await bkashResponse.json();

	if (bkashResult.statusCode !== "0000") {
		throw new AppError(httpStatus.BAD_GATEWAY, "bKash payment failed to start");
	}

	await prisma.payment.update({
		where: { shipmentId: shipment.id },
		data: {
			bkashPaymentId: bkashResult.paymentID,
			status: PaymentStatus.PENDING,
			gatewayResponse: bkashResult,
		},
	});

	return { paymentUrl: bkashResult.bkashURL };
};

// bKash sends the customer's browser here: ?paymentID=...&status=success|failure|cancel
const paymentCallback = async (query: Record<string, any>) => {
	const paymentID = query.paymentID;
	const status = query.status;

	if (!paymentID) {
		throw new AppError(httpStatus.BAD_REQUEST, "paymentID is missing");
	}

	const payment = await prisma.payment.findUnique({
		where: { bkashPaymentId: paymentID },
		include: { shipment: true },
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	const base = `${config.frontend_url}/dashboard/my-shipments`;

	// callback opened twice (page refresh) -> do nothing
	if (payment.status === PaymentStatus.PAID) {
		return { redirectUrl: `${base}?status=success` };
	}

	if (status === "cancel") {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.CANCELLED },
		});
		return { redirectUrl: `${base}?status=cancel` };
	}

	if (status === "failure") {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
		return { redirectUrl: `${base}?status=failure` };
	}

	if (status !== "success") {
		return { redirectUrl: `${base}?error=payment-failed` };
	}

	// success: always confirm with bKash, never trust the URL
	const executeResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: await getBkashHeaders(),
			body: JSON.stringify({ paymentID }),
		},
	);

	const executeResult = await executeResponse.json();

	const isPaid =
		executeResult.statusCode === "0000" &&
		executeResult.transactionStatus === "Completed" &&
		Number(executeResult.amount) === Number(payment.amount) &&
		executeResult.merchantInvoiceNumber === payment.shipment.trackingNumber;

	if (!isPaid) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED, gatewayResponse: executeResult },
		});
		return { redirectUrl: `${base}?status=failure` };
	}

	await prisma.$transaction(async (tx) => {
		await tx.payment.update({
			where: { id: payment.id },
			data: {
				status: PaymentStatus.PAID,
				bkashTrxId: executeResult.trxID,
				paidAt: new Date(),
				gatewayResponse: executeResult,
			},
		});

		await tx.shipment.update({
			where: { id: payment.shipmentId },
			data: { status: ShipmentStatus.PICKUP_REQUESTED },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId: payment.shipmentId,
				status: ShipmentStatus.PICKUP_REQUESTED,
				note: "Payment received. Pickup requested.",
			},
		});
	});

	return { redirectUrl: `${base}?status=success` };
};

const cancelShipment = async (
	user: IRequestUser,
	shipmentId: string,
	payload: ICancelShipmentPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { payment: true, customer: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

	if (!isAdmin && shipment.customer.userId !== user.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "This is not your shipment");
	}

	if (shipment.status === ShipmentStatus.CANCELLED) {
		throw new AppError(httpStatus.CONFLICT, "Shipment already cancelled");
	}

	const cancellable: ShipmentStatus[] = [
		ShipmentStatus.PENDING_PAYMENT,
		ShipmentStatus.PICKUP_REQUESTED,
		ShipmentStatus.COURIER_ASSIGNED,
	];

	if (!cancellable.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Shipment cannot be cancelled after pickup",
		);
	}

	const reason = payload?.reason ?? "Shipment cancelled";
	const payment = shipment.payment;

	let refundResult: any = null;

	// refund only if the customer already paid
	if (payment?.status === PaymentStatus.PAID) {
		const refundResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: await getBkashHeaders(),
				body: JSON.stringify({
					paymentID: payment.bkashPaymentId,
					trxID: payment.bkashTrxId,
					amount: Number(payment.amount).toFixed(2),
					sku: shipment.trackingNumber,
					reason,
				}),
			},
		);

		refundResult = await refundResponse.json();

		if (refundResult.statusCode !== "0000") {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				"Refund failed. Shipment was not cancelled.",
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updatedShipment = await tx.shipment.update({
			where: { id: shipment.id },
			data: { status: ShipmentStatus.CANCELLED, courierId: null },
		});

		if (payment && refundResult) {
			await tx.payment.update({
				where: { id: payment.id },
				data: {
					status: PaymentStatus.REFUNDED,
					refundTrxId: refundResult.refundTrxID,
					refundAmount: refundResult.amount,
					refundReason: reason,
					refundedAt: new Date(),
					gatewayResponse: refundResult,
				},
			});
		} else if (payment) {
			await tx.payment.update({
				where: { id: payment.id },
				data: { status: PaymentStatus.CANCELLED },
			});
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId: shipment.id,
				status: ShipmentStatus.CANCELLED,
				note: refundResult ? `${reason}. Payment refunded.` : reason,
				updatedById: user.userId,
			},
		});

		return updatedShipment;
	});
};

// public: only city names and status history, no personal data
const trackShipment = async (trackingNumber: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { trackingNumber },
		select: {
			trackingNumber: true,
			status: true,
			deliveryType: true,
			pickupCity: true,
			receiverCity: true,
			createdAt: true,
			deliveredAt: true,
			trackingEvents: {
				select: { status: true, note: true, location: true, createdAt: true },
				orderBy: { createdAt: "asc" },
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	return shipment;
};

const getMyShipments = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const customer = await prisma.customer.findUnique({
		where: { userId: user.userId },
	});

	if (!customer) {
		throw new AppError(httpStatus.FORBIDDEN, "Customer profile not found");
	}

	const { page, limit, skip } = getPagination(query);
	const where = { customerId: customer.id };

	const [data, total] = await Promise.all([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: { payment: { select: { status: true, amount: true } } },
		}),
		prisma.shipment.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getAllShipments = async (query: Record<string, any>) => {
	const { page, limit, skip } = getPagination(query);

	const where = {
		...(query.status ? { status: query.status as ShipmentStatus } : {}),
		...(query.courierId ? { courierId: query.courierId as string } : {}),
	};

	const [data, total] = await Promise.all([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				payment: { select: { status: true, amount: true } },
				courier: { include: { user: { select: { name: true, phone: true } } } },
			},
		}),
		prisma.shipment.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getShipmentById = async (user: IRequestUser, id: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id },
		include: {
			customer: { select: { userId: true } },
			courier: { select: { userId: true } },
			payment: true,
			trackingEvents: { orderBy: { createdAt: "desc" } },
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
	const isOwner =
		user.role === Role.CUSTOMER && shipment.customer.userId === user.userId;
	const isCourier =
		user.role === Role.COURIER && shipment.courier?.userId === user.userId;

	if (!isAdmin && !isOwner && !isCourier) {
		throw new AppError(httpStatus.FORBIDDEN, "You cannot view this shipment");
	}

	return shipment;
};

const assignCourier = async (
	shipmentId: string,
	payload: IAssignCourierPayload,
) => {
	const courier = await prisma.courier.findUnique({
		where: { id: payload.courierId },
		include: { user: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier not found");
	}

	if (!courier.isAvailable || courier.user.status !== UserStatus.ACTIVE) {
		throw new AppError(httpStatus.BAD_REQUEST, "Courier is not available");
	}

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	const assignable: ShipmentStatus[] = [
		ShipmentStatus.PICKUP_REQUESTED,
		ShipmentStatus.COURIER_ASSIGNED,
	];

	if (!assignable.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Courier can only be assigned to a paid shipment waiting for pickup",
		);
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: { courierId: courier.id, status: ShipmentStatus.COURIER_ASSIGNED },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: ShipmentStatus.COURIER_ASSIGNED,
				note: `Courier ${courier.user.name} assigned for pickup`,
			},
		});

		return updated;
	});
};

const updateShipmentStatus = async (
	user: IRequestUser,
	shipmentId: string,
	payload: IUpdateStatusPayload,
) => {
	const { status: nextStatus, note, location } = payload;

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { courier: { select: { userId: true } } },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	// a courier can only update own shipments and only some statuses
	if (user.role === Role.COURIER) {
		if (shipment.courier?.userId !== user.userId) {
			throw new AppError(httpStatus.FORBIDDEN, "This shipment is not assigned to you");
		}

		if (!COURIER_ALLOWED_STATUSES.includes(nextStatus)) {
			throw new AppError(httpStatus.FORBIDDEN, "Couriers cannot set this status");
		}
	}

	if (!ALLOWED_TRANSITIONS[shipment.status].includes(nextStatus)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot change status from ${shipment.status} to ${nextStatus}`,
		);
	}

	return prisma.$transaction(async (tx) => {
		// "where status = old status" stops two people updating at the same time
		const result = await tx.shipment.updateMany({
			where: { id: shipmentId, status: shipment.status },
			data: {
				status: nextStatus,
				...(nextStatus === ShipmentStatus.DELIVERED
					? { deliveredAt: new Date() }
					: {}),
			},
		});

		if (result.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Shipment was updated by someone else. Please refresh.",
			);
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: nextStatus,
				note,
				location,
				updatedById: user.userId,
			},
		});

		return tx.shipment.findUnique({
			where: { id: shipmentId },
			include: { trackingEvents: { orderBy: { createdAt: "desc" } } },
		});
	});
};

export const ShipmentService = {
	createShipment,
	payShipment,
	paymentCallback,
	cancelShipment,
	trackShipment,
	getMyShipments,
	getAllShipments,
	getShipmentById,
	assignCourier,
	updateShipmentStatus,
};