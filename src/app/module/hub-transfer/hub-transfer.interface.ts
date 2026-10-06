export interface ICreateTransferPayload {
	shipmentId: string;
	fromHubId: string;
	toHubId: string;
	note?: string;
}

export interface IReceiveTransferPayload {
	note?: string;
}