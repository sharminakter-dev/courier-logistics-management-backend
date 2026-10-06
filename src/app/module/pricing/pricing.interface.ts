import type { DeliveryType } from "../../../generated/prisma/enums";

export interface IPricingNumbers {
	sameCityBase: number;
	interCityBase: number;
	freeWeightKg: number;
	perExtraKg: number;
	expressMultiplier: number;
}

export interface IUpdatePricingPayload extends Partial<IPricingNumbers> {}

export interface IQuotePayload {
	pickupCity: string;
	receiverCity: string;
	weightKg: number;
	deliveryType: DeliveryType;
}