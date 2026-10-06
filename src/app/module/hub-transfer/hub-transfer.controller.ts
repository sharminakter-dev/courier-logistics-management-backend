import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { getUser } from "../../utils/getUser";
import { sendResponse } from "../../utils/sendResponse";
import { HubTransferService } from "./hub-transfer.service";

const createTransfer = catchAsync(async (req: Request, res: Response) => {
	const result = await HubTransferService.createTransfer(getUser(req), req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Shipment dispatched to destination hub",
		data: result,
	});
});

const receiveTransfer = catchAsync(async (req: Request, res: Response) => {
	const result = await HubTransferService.receiveTransfer(
		getUser(req),
		req.params.id as string,
		req.body ?? {},
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment received at destination hub",
		data: result,
	});
});

const getTransfers = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await HubTransferService.getTransfers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Transfers fetched successfully",
		data,
		meta,
	});
});

const getTransferById = catchAsync(async (req: Request, res: Response) => {
	const result = await HubTransferService.getTransferById(
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Transfer fetched successfully",
		data: result,
	});
});

export const HubTransferController = {
	createTransfer,
	receiveTransfer,
	getTransfers,
	getTransferById,
};