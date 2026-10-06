import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { getUser } from "../../utils/getUser";
import { sendResponse } from "../../utils/sendResponse";
import { EarningService } from "./earning.service";

const getMyEarnings = catchAsync(async (req: Request, res: Response) => {
	const { data, summary, meta } = await EarningService.getMyEarnings(
		getUser(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Earnings fetched successfully",
		data: { summary, earnings: data },
		meta,
	});
});

const getAllEarnings = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await EarningService.getAllEarnings(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Earnings fetched successfully",
		data,
		meta,
	});
});

const payoutCourier = catchAsync(async (req: Request, res: Response) => {
	const result = await EarningService.payoutCourier(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payout completed successfully",
		data: result,
	});
});

export const EarningController = {
	getMyEarnings,
	getAllEarnings,
	payoutCourier,
};