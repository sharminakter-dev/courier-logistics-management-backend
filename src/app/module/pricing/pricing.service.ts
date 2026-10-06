import { prisma } from "../../lib/prisma";
import {
	getPriceBreakdown,
	isSameCity,
} from "../shipment/shipment.utils";
import type {
	IPricingNumbers,
	IQuotePayload,
	IUpdatePricingPayload,
} from "./pricing.interface";

// the active rule; created with default values the first time
const getActiveRule = async () => {
	const rule = await prisma.pricingRule.findFirst({
		where: { isActive: true },
		orderBy: { createdAt: "desc" },
	});

	if (rule) return rule;

	return prisma.pricingRule.create({ data: {} });
};

// used by the shipment module
const getPricingNumbers = async (): Promise<IPricingNumbers> => {
	const rule = await getActiveRule();

	return {
		sameCityBase: Number(rule.sameCityBase),
		interCityBase: Number(rule.interCityBase),
		freeWeightKg: Number(rule.freeWeightKg),
		perExtraKg: Number(rule.perExtraKg),
		expressMultiplier: Number(rule.expressMultiplier),
	};
};

// old rule is kept as history, a new active rule is created
const updatePricing = async (payload: IUpdatePricingPayload) => {
	const current = await getPricingNumbers();

	return prisma.$transaction(async (tx) => {
		await tx.pricingRule.updateMany({
			where: { isActive: true },
			data: { isActive: false },
		});

		return tx.pricingRule.create({ data: { ...current, ...payload } });
	});
};

const quote = async (payload: IQuotePayload) => {
	const rule = await getPricingNumbers();

	return getPriceBreakdown(
		{
			weightKg: payload.weightKg,
			deliveryType: payload.deliveryType,
			sameCity: isSameCity(payload.pickupCity, payload.receiverCity),
		},
		rule,
	);
};

export const PricingService = {
	getActiveRule,
	getPricingNumbers,
	updatePricing,
	quote,
};