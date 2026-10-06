import { z } from "zod";

const createTransfer = z.object({
	body: z.object({
		shipmentId: z.uuid("Valid shipmentId is required"),
		fromHubId: z.uuid("Valid fromHubId is required"),
		toHubId: z.uuid("Valid toHubId is required"),
		note: z.string().trim().max(255).optional(),
	}),
});

const receiveTransfer = z.object({
	body: z
		.object({ note: z.string().trim().max(255).optional() })
		.optional(),
});

export const HubTransferValidation = { createTransfer, receiveTransfer };