export interface ICreateHubPayload {
	name: string;
	code: string;
	city: string;
	address: string;
	phone?: string;
}

export interface IUpdateHubPayload extends Partial<ICreateHubPayload> {
	isActive?: boolean;
}

export interface ICreateZonePayload {
	name: string;
	areas: string[];
}

export interface IUpdateZonePayload {
	name?: string;
	areas?: string[];
	isActive?: boolean;
}