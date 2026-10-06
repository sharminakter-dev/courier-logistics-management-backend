import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getOverview = catchAsync(async (_req: Request, res: Response) => {
	const result = await AnalyticsService.getOverview();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard overview fetched successfully",
		data: result,
	});
});

const getShipmentsTrend = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsService.getShipmentsTrend(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipments trend fetched successfully",
		data: result,
	});
});

const getTopCouriers = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsService.getTopCouriers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Top couriers fetched successfully",
		data: result,
	});
});

export const AnalyticsController = {
	getOverview,
	getShipmentsTrend,
	getTopCouriers,
};