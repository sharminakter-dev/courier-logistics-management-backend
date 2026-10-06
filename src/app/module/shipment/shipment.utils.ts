import crypto from "node:crypto";
import { DeliveryType, ShipmentStatus } from "../../../generated/prisma/enums";

export const generateTrackingNumber = () => {
	const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const random = crypto.randomBytes(4).toString("hex").toUpperCase();
	return `CLG-${date}-${random}`;
};

export const isSameCity = (a: string, b: string) =>
	a.trim().toLowerCase() === b.trim().toLowerCase();

// Price in BDT: base (same city 60, other city 100) + 25 per extra kg after 1 kg
// Express = 1.5x
export const calculatePrice = (input: {
	weightKg: number;
	deliveryType: DeliveryType;
	sameCity: boolean;
}) => {
	const base = input.sameCity ? 60 : 100;
	const extraKg = Math.max(0, Math.ceil(input.weightKg - 1));
	const subtotal = base + extraKg * 25;
	const total =
		input.deliveryType === DeliveryType.EXPRESS ? subtotal * 1.5 : subtotal;

	return Math.round(total * 100) / 100;
};

// current status -> statuses it can move to
export const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
	PENDING_PAYMENT: [],
	PICKUP_REQUESTED: [],
	COURIER_ASSIGNED: [ShipmentStatus.PICKED_UP],
	PICKED_UP: [ShipmentStatus.AT_ORIGIN_HUB],
	AT_ORIGIN_HUB: [ShipmentStatus.IN_TRANSIT],
	IN_TRANSIT: [ShipmentStatus.AT_DESTINATION_HUB],
	AT_DESTINATION_HUB: [ShipmentStatus.OUT_FOR_DELIVERY],
	OUT_FOR_DELIVERY: [ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED],
	DELIVERY_FAILED: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.RETURNING],
	RETURNING: [ShipmentStatus.RETURNED],
	DELIVERED: [],
	RETURNED: [],
	CANCELLED: [],
};

// statuses a COURIER can set (admin can set any valid next status)
export const COURIER_ALLOWED_STATUSES: ShipmentStatus[] = [
	ShipmentStatus.PICKED_UP,
	ShipmentStatus.OUT_FOR_DELIVERY,
	ShipmentStatus.DELIVERED,
	ShipmentStatus.DELIVERY_FAILED,
];