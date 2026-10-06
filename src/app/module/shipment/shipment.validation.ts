import { z } from "zod";

const contact = z.object({
	name: z.string("Name is required").trim().min(2).max(100),
	phone: z
		.string("Phone is required")
		.trim()
		.regex(/^\+?[0-9]{7,15}$/, "Please provide a valid phone number"),
	address: z.string("Address is required").trim().min(5).max(255),
	city: z.string("City is required").trim().min(2).max(100),
});

const createShipment = z.object({
	body: z.object({
		pickup: contact,
		receiver: contact,
		weightKg: z
			.number("Weight is required")
			.positive("Weight must be greater than 0")
			.max(50, "Maximum weight is 50 kg"),
		deliveryType: z.enum(["STANDARD", "EXPRESS"]).default("STANDARD"),
		parcelDescription: z.string().trim().max(500).optional(),
		pickupScheduledAt: z.coerce.date().optional(),
	}),
});

const assignCourier = z.object({
	body: z.object({
		courierId: z.uuid("Valid courierId is required"),
	}),
});

// CANCELLED is not here on purpose: cancelling goes through /cancel (it refunds)
const updateStatus = z.object({
	body: z.object({
		status: z.enum([
			"PICKED_UP",
			"AT_ORIGIN_HUB",
			"IN_TRANSIT",
			"AT_DESTINATION_HUB",
			"OUT_FOR_DELIVERY",
			"DELIVERED",
			"DELIVERY_FAILED",
			"RETURNING",
			"RETURNED",
		]),
		note: z.string().trim().max(255).optional(),
		location: z.string().trim().max(150).optional(),
	}),
});

const cancelShipment = z.object({
	body: z
		.object({
			reason: z.string().trim().max(255).optional(),
		})
		.optional(),
});

export const ShipmentValidation = {
	createShipment,
	assignCourier,
	updateStatus,
	cancelShipment,
};