import { z } from "zod";

const vehicleType = z.enum(["BICYCLE", "MOTORBIKE", "VAN", "TRUCK"]);

const createCourier = z.object({
	body: z.object({
		name: z.string("Name is required").trim().min(2).max(100),
		email: z.email("Please provide a valid email address"),
		password: z
			.string("Password is required")
			.min(8, "Password must be at least 8 characters")
			.regex(/[a-z]/, "Password must contain a lowercase letter")
			.regex(/[A-Z]/, "Password must contain an uppercase letter")
			.regex(/[0-9]/, "Password must contain a number"),
		phone: z
			.string("Phone is required")
			.trim()
			.regex(/^\+?[0-9]{7,15}$/, "Please provide a valid phone number"),
		vehicleType,
		hubId: z.uuid().optional(),
	}),
});

const updateCourier = z.object({
	body: z
		.object({
			vehicleType: vehicleType.optional(),
			hubId: z.uuid().nullable().optional(),
			isAvailable: z.boolean().optional(),
			status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
		})
		.refine((b) => Object.keys(b).length > 0, "Provide at least one field"),
});

const updateAvailability = z.object({
	body: z.object({
		isAvailable: z.boolean("isAvailable must be true or false"),
	}),
});

export const CourierValidation = {
	createCourier,
	updateCourier,
	updateAvailability,
};