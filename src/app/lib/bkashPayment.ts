import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";
import { getBkashIdToken } from "./bkash";

export interface IBkashCreateResponse {
	paymentID: string;
	bkashURL: string;
	statusCode: string;
	statusMessage?: string;
}

export interface IBkashExecuteResponse {
	paymentID: string;
	trxID?: string;
	transactionStatus?: string;
	amount?: string;
	merchantInvoiceNumber?: string;
	statusCode: string;
	statusMessage?: string;
}

const getHeaders = async () => {
	const idToken = await getBkashIdToken();

	if (!idToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "Could not get bKash token");
	}

	return {
		"Content-Type": "application/json",
		Accept: "application/json",
		Authorization: idToken,
		"X-APP-Key": config.bkash_app_key,
	};
};

export const createBkashPayment = async (input: {
	amount: number;
	invoiceNumber: string;
	payerReference: string;
}) => {
	const response = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: await getHeaders(),
			body: JSON.stringify({
				mode: "0011",
				payerReference: input.payerReference,
                callbackURL: `${config.bkash_callback_api}/shipments/payment/callback`,
				amount: input.amount.toFixed(2),
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: input.invoiceNumber,
			}),
		},
	);

	const data = (await response.json()) as IBkashCreateResponse;

	if (!response.ok || data.statusCode !== "0000" || !data.bkashURL) {
		console.error("bKash create payment failed:", data);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"Failed to start bKash payment. Please try again.",
		);
	}

	return data;
};

export const executeBkashPayment = async (paymentID: string) => {
	const response = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: await getHeaders(),
			body: JSON.stringify({ paymentID }),
		},
	);

	return (await response.json()) as IBkashExecuteResponse;
};


export interface IBkashRefundResponse {
	statusCode: string;
	statusMessage?: string;
	refundTrxID?: string;
	transactionStatus?: string;
	amount?: string;
	completedTime?: string;
}

export const refundBkashPayment = async (input: {
	paymentID: string;
	trxID: string;
	amount: number;
	sku: string;
	reason: string;
}) => {
	const response = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
		{
			method: "POST",
			headers: await getHeaders(),
			body: JSON.stringify({
				paymentID: input.paymentID,
				trxID: input.trxID,
				amount: input.amount.toFixed(2),
				sku: input.sku,
				reason: input.reason,
			}),
		},
	);

	return (await response.json()) as IBkashRefundResponse;
};