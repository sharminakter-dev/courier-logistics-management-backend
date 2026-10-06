import type { UserStatus, VehicleType } from "../../../generated/prisma/enums";

export interface ICreateCourierPayload {
	name: string;
	email: string;
	password: string;
	phone: string;
	vehicleType: VehicleType;
	hubId?: string;
}

export interface IUpdateCourierPayload {
	vehicleType?: VehicleType;
	hubId?: string | null;
	isAvailable?: boolean;
	status?: UserStatus;
}