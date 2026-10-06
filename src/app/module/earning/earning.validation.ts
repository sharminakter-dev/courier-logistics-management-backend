import { z } from "zod";

const payout = z.object({
	body: z.object({
		courierId: z.uuid("Valid courierId is required"),
	}),
});

export const EarningValidation = { payout };