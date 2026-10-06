import crypto from "node:crypto";
import { DeliveryType, ShipmentStatus } from "../../../generated/prisma/enums";
import { IPricingNumbers } from "../pricing/pricing.interface";

export const generateTrackingNumber = () => {
	const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const random = crypto.randomBytes(4).toString("hex").toUpperCase();
	return `CLG-${date}-${random}`;
};

export const isSameCity = (a: string, b: string) =>
	a.trim().toLowerCase() === b.trim().toLowerCase();

export const MAX_DELIVERY_ATTEMPTS = 3;

export const getPriceBreakdown = (
	input: { weightKg: number; deliveryType: DeliveryType; sameCity: boolean },
	rule: IPricingNumbers,
) => {
	const base = input.sameCity ? rule.sameCityBase : rule.interCityBase;
	const extraKg = Math.max(0, Math.ceil(input.weightKg - rule.freeWeightKg));
	const extraCharge = extraKg * rule.perExtraKg;
	const subtotal = base + extraCharge;
	const multiplier =
		input.deliveryType === DeliveryType.EXPRESS ? rule.expressMultiplier : 1;
	const total = Math.round(subtotal * multiplier * 100) / 100;

	return { base, extraKg, extraCharge, subtotal, multiplier, total };
};

export const calculatePrice = (
	input: { weightKg: number; deliveryType: DeliveryType; sameCity: boolean },
	rule: IPricingNumbers,
) => getPriceBreakdown(input, rule).total;

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