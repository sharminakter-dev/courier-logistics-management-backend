import { z } from "zod";

const hubFields = {
	name: z.string("Name is required").trim().min(2).max(100),
	code: z
		.string("Code is required")
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9-]{2,10}$/, "Code must be 2-10 letters, numbers or -"),
	city: z.string("City is required").trim().min(2).max(100),
	address: z.string("Address is required").trim().min(5).max(255),
	phone: z
		.string()
		.trim()
		.regex(/^\+?[0-9]{7,15}$/, "Please provide a valid phone number")
		.optional(),
};

const createHub = z.object({ body: z.object(hubFields) });

const updateHub = z.object({
	body: z
		.object({
			name: hubFields.name.optional(),
			code: hubFields.code.optional(),
			city: hubFields.city.optional(),
			address: hubFields.address.optional(),
			phone: hubFields.phone,
			isActive: z.boolean().optional(),
		})
		.refine((b) => Object.keys(b).length > 0, "Provide at least one field"),
});

const areas = z.array(z.string().trim().min(2)).min(1).max(50);

const createZone = z.object({
	body: z.object({
		name: z.string("Name is required").trim().min(2).max(100),
		areas,
	}),
});

const updateZone = z.object({
	body: z
		.object({
			name: z.string().trim().min(2).max(100).optional(),
			areas: areas.optional(),
			isActive: z.boolean().optional(),
		})
		.refine((b) => Object.keys(b).length > 0, "Provide at least one field"),
});

export const HubValidation = { createHub, updateHub, createZone, updateZone };