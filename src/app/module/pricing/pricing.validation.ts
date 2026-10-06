import { z } from "zod";

const updatePricing = z.object({
	body: z
		.object({
			sameCityBase: z.number().positive().optional(),
			interCityBase: z.number().positive().optional(),
			freeWeightKg: z.number().positive().optional(),
			perExtraKg: z.number().positive().optional(),
			expressMultiplier: z.number().min(1).max(5).optional(),
		})
		.refine((b) => Object.keys(b).length > 0, "Provide at least one field"),
});

const quote = z.object({
	body: z.object({
		pickupCity: z.string("Pickup city is required").trim().min(2),
		receiverCity: z.string("Receiver city is required").trim().min(2),
		weightKg: z.number("Weight is required").positive().max(50),
		deliveryType: z.enum(["STANDARD", "EXPRESS"]).default("STANDARD"),
	}),
});

export const PricingValidation = { updatePricing, quote };