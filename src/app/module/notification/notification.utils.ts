import type { Prisma } from "../../../generated/prisma/client";

export const notifyUser = (
	db: Prisma.TransactionClient,
	input: {
		userId: string;
		title: string;
		message: string;
		shipmentId?: string;
	},
) => db.notification.create({ data: input });