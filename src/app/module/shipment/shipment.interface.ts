import type {
	DeliveryType,
	ShipmentStatus,
} from "../../../generated/prisma/enums";

export interface IContactPayload {
	name: string;
	phone: string;
	address: string;
	city: string;
}

export interface ICreateShipmentPayload {
	pickup: IContactPayload;
	receiver: IContactPayload;
	weightKg: number;
	deliveryType: DeliveryType;
	parcelDescription?: string;
	pickupScheduledAt?: Date;
}

export interface IAssignCourierPayload {
	courierId: string;
}

export interface IUpdateStatusPayload {
	status: ShipmentStatus;
	note?: string;
	location?: string;
}

export interface ICancelShipmentPayload {
	reason?: string;
}